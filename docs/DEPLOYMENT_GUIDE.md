# デプロイガイド

このドキュメントは、Google Meet 多言語リアルタイム翻訳エージェントを本番環境にデプロイする手順を説明します。

## 前提条件

- Docker と Docker Compose がインストールされていること
- 各種APIキーが取得済みであること
- ドメイン名とSSL証明書（本番環境の場合）

## 環境変数の設定

### バックエンド

`backend/.env.production` ファイルを作成し、以下の環境変数を設定します:

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Recall.ai API
RECALL_API_KEY=your_production_recall_api_key

# ElevenLabs API
ELEVENLABS_API_KEY=your_production_elevenlabs_api_key

# Google Cloud Translation API
GOOGLE_APPLICATION_CREDENTIALS=/app/credentials/google-credentials.json
GOOGLE_PROJECT_ID=your_google_project_id

# DeepL API (Optional)
DEEPL_API_KEY=your_production_deepl_api_key

# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=meet_translator
DB_USER=postgres
DB_PASSWORD=secure_password_here

# Logging
LOG_LEVEL=info
```

## Docker を使用したデプロイ

### 1. Dockerfile の作成

#### バックエンド Dockerfile

`backend/Dockerfile`:

```dockerfile
FROM node:20-alpine AS base

# 依存関係のインストール
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# ビルド
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable pnpm && pnpm build

# 本番環境
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./package.json

USER appuser
EXPOSE 3001

CMD ["node", "dist/index.js"]
```

#### フロントエンド Dockerfile

`frontend/Dockerfile`:

```dockerfile
FROM node:20-alpine AS base

# 依存関係のインストール
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# ビルド
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable pnpm && pnpm build

# 本番環境
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

CMD ["node_modules/.bin/next", "start"]
```

### 2. Docker Compose の設定

`docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    env_file:
      - ./backend/.env.production
    volumes:
      - ./credentials:/app/credentials:ro
      - ./backend/logs:/app/logs
    restart: unless-stopped
    depends_on:
      - postgres

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_WS_URL=ws://backend:3001
    restart: unless-stopped
    depends_on:
      - backend

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=meet_translator
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=secure_password_here
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    restart: unless-stopped
    depends_on:
      - frontend
      - backend

volumes:
  postgres_data:
```

### 3. Nginx の設定

`nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:3001;
    }

    upstream frontend {
        server frontend:3000;
    }

    # HTTP から HTTPS へリダイレクト
    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS サーバー
    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # フロントエンド
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # バックエンド API
        location /api {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket
        location /ws {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 86400;
        }
    }
}
```

### 4. デプロイの実行

```bash
# イメージのビルド
docker-compose build

# コンテナの起動
docker-compose up -d

# ログの確認
docker-compose logs -f

# ステータスの確認
docker-compose ps
```

## Kubernetes を使用したデプロイ

### 1. Deployment の作成

`k8s/backend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: meet-translator-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: meet-translator-backend
  template:
    metadata:
      labels:
        app: meet-translator-backend
    spec:
      containers:
      - name: backend
        image: your-registry/meet-translator-backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - secretRef:
            name: backend-secrets
        volumeMounts:
        - name: credentials
          mountPath: /app/credentials
          readOnly: true
      volumes:
      - name: credentials
        secret:
          secretName: google-credentials
```

### 2. Service の作成

`k8s/backend-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: meet-translator-backend
spec:
  selector:
    app: meet-translator-backend
  ports:
  - protocol: TCP
    port: 3001
    targetPort: 3001
  type: ClusterIP
```

### 3. デプロイの実行

```bash
# Secret の作成
kubectl create secret generic backend-secrets \
  --from-env-file=backend/.env.production

kubectl create secret generic google-credentials \
  --from-file=google-credentials.json

# デプロイ
kubectl apply -f k8s/

# ステータスの確認
kubectl get pods
kubectl get services

# ログの確認
kubectl logs -f deployment/meet-translator-backend
```

## 監視とロギング

### ログの収集

ログは以下の場所に保存されます:

- コンテナ内: `/app/logs/`
- ホスト側: `./backend/logs/` (Docker Compose の場合)

### メトリクスの監視

以下のメトリクスを監視することを推奨します:

- CPU使用率
- メモリ使用率
- WebSocket接続数
- レイテンシ (STT, 翻訳, TTS)
- エラー率

### ヘルスチェック

```bash
# バックエンドのヘルスチェック
curl http://localhost:3001/health

# レスポンス例
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345.67
}
```

## スケーリング

### 水平スケーリング

Docker Compose:
```bash
docker-compose up -d --scale backend=3
```

Kubernetes:
```bash
kubectl scale deployment meet-translator-backend --replicas=5
```

### 自動スケーリング (Kubernetes)

`k8s/backend-hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: meet-translator-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: meet-translator-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## バックアップ

### データベースのバックアップ

```bash
# PostgreSQL のバックアップ
docker-compose exec postgres pg_dump -U postgres meet_translator > backup.sql

# リストア
docker-compose exec -T postgres psql -U postgres meet_translator < backup.sql
```

## トラブルシューティング

### コンテナが起動しない

```bash
# ログを確認
docker-compose logs backend

# コンテナに入る
docker-compose exec backend sh
```

### WebSocket接続エラー

- Nginx の WebSocket プロキシ設定を確認
- ファイアウォールの設定を確認
- SSL証明書が正しく設定されているか確認

## セキュリティ

### 推奨事項

- すべての環境変数を Secret として管理
- SSL/TLS を必ず有効化
- ファイアウォールで不要なポートを閉じる
- 定期的なセキュリティアップデート
- ログの定期的な監査

## パフォーマンスチューニング

### Node.js の最適化

```bash
# メモリ制限の設定
NODE_OPTIONS="--max-old-space-size=4096"

# クラスタモードの有効化
NODE_ENV=production node --experimental-worker dist/index.js
```

### データベースの最適化

- インデックスの適切な設定
- 接続プールのサイズ調整
- クエリの最適化

## まとめ

本番環境へのデプロイには、適切な監視、ログ収集、バックアップ体制が不可欠です。定期的なメンテナンスとセキュリティアップデートを実施してください。
