# 開発ガイド

このドキュメントは、Google Meet 多言語リアルタイム翻訳エージェントの開発を進めるためのガイドです。

## 開発環境のセットアップ

### 必要なツール

- **Node.js**: v20.x 以上
- **pnpm**: v8.x 以上
- **TypeScript**: v5.x
- **Git**: バージョン管理

### エディタ推奨設定

VSCode を使用する場合、以下の拡張機能をインストールすることを推奨します:

- ESLint
- Prettier
- TypeScript and JavaScript Language Features

## プロジェクト構造

### バックエンド (`backend/`)

```
backend/
├── src/
│   ├── config/           # 設定管理
│   │   └── index.ts      # 環境変数の読み込みと設定
│   ├── services/         # ビジネスロジック
│   │   ├── AudioPipeline.ts      # 音声処理パイプライン
│   │   ├── WebSocketServer.ts    # WebSocketサーバー
│   │   ├── ElevenLabsSTT.ts      # STTサービス
│   │   ├── GoogleTranslation.ts  # 翻訳サービス
│   │   ├── ElevenLabsTTS.ts      # TTSサービス
│   │   └── RecallAI.ts           # Recall.ai連携
│   ├── utils/            # ユーティリティ
│   │   ├── logger.ts     # ロギング
│   │   └── metrics.ts    # メトリクス測定
│   ├── types/            # 型定義
│   │   └── index.ts      # 共通型定義
│   └── index.ts          # エントリーポイント
├── package.json
└── tsconfig.json
```

### フロントエンド (`frontend/`)

```
frontend/
├── app/
│   ├── page.tsx          # メインページ
│   ├── layout.tsx        # レイアウト
│   └── globals.css       # グローバルスタイル
├── package.json
└── next.config.js
```

## コーディング規約

### TypeScript

- **厳格な型付け**: `strict: true` を使用
- **明示的な型注釈**: 関数の引数と戻り値には必ず型を指定
- **インターフェースの活用**: オブジェクトの構造を明確に定義

### 命名規則

- **変数・関数**: camelCase (`getUserData`, `isActive`)
- **クラス・インターフェース**: PascalCase (`AudioPipeline`, `STTResult`)
- **定数**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- **ファイル名**: PascalCase (クラス) または camelCase (ユーティリティ)

### エラーハンドリング

すべての非同期処理には適切なエラーハンドリングを実装してください:

```typescript
try {
  const result = await someAsyncOperation();
  logger.info('Operation succeeded', { result });
} catch (error) {
  logger.error('Operation failed', { error });
  throw error; // または適切な処理
}
```

### ロギング

Winston ロガーを使用し、適切なログレベルで出力してください:

```typescript
import { logger } from '../utils/logger';

logger.debug('Detailed debug information');
logger.info('General information');
logger.warn('Warning message');
logger.error('Error occurred', { error });
```

## 外部API連携の実装

### ElevenLabs STT

WebSocket を使用したストリーミング音声認識:

```typescript
const stt = new ElevenLabsSTT();
await stt.connect();

stt.on('result', (result: STTResult) => {
  console.log('Transcription:', result.text);
});

await stt.sendAudioChunk(audioChunk);
```

### Google Cloud Translation

用語集を使用した翻訳:

```typescript
const translation = new GoogleTranslation();
const result = await translation.translate(
  'こんにちは',
  'ja',
  'fr',
  'my-glossary-id'
);
console.log(result.translatedText); // "Bonjour"
```

### ElevenLabs TTS

低遅延音声合成:

```typescript
const tts = new ElevenLabsTTS();
const result = await tts.synthesize('Hello', 'ja', 'eleven_flash_v2_5');
// result.audioData は Buffer 型
```

### Recall.ai

会議への参加と音声入出力:

```typescript
const recall = new RecallAI();
const botId = await recall.joinMeeting('https://meet.google.com/xxx-yyyy-zzz');

recall.on('ready', () => {
  console.log('Bot is ready in the meeting');
});

// 音声送信
await recall.sendAudio(audioBuffer);

// 会議から退出
await recall.leaveMeeting();
```

## テスト

### 単体テスト

Jest を使用した単体テストの例:

```typescript
import { LatencyTracker } from '../utils/metrics';

describe('LatencyTracker', () => {
  it('should track checkpoint correctly', () => {
    const tracker = new LatencyTracker();
    tracker.checkpoint('start');
    tracker.checkpoint('end');
    
    const duration = tracker.getDuration('start', 'end');
    expect(duration).toBeGreaterThanOrEqual(0);
  });
});
```

### 統合テスト

実際の会議でのエンドツーエンドテスト:

1. Google Meet の会議を作成
2. フロントエンドから会議URLを入力
3. ボットが参加することを確認
4. 音声を発話し、翻訳結果が表示されることを確認

## デバッグ

### バックエンドのデバッグ

VSCode のデバッグ設定 (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "cwd": "${workspaceFolder}/backend",
      "console": "integratedTerminal"
    }
  ]
}
```

### ログの確認

ログファイルは `backend/logs/` に保存されます:

- `combined.log`: すべてのログ
- `error.log`: エラーログのみ

## パフォーマンス最適化

### レイテンシの測定

`LatencyTracker` を使用してボトルネックを特定:

```typescript
const tracker = new LatencyTracker();

tracker.checkpoint('stt_start');
await performSTT(audio);
tracker.checkpoint('stt_end');

tracker.checkpoint('translation_start');
await performTranslation(text);
tracker.checkpoint('translation_end');

tracker.logMetrics();
```

### メトリクスの集計

`MetricsAggregator` で統計情報を収集:

```typescript
const aggregator = new MetricsAggregator();

// 各処理のレイテンシを記録
aggregator.addMetric('stt', 150);
aggregator.addMetric('translation', 200);
aggregator.addMetric('tts', 100);

// 統計情報を出力
aggregator.logStats();
```

## トラブルシューティング

### よくある問題

#### 1. WebSocket接続が確立できない

**原因**: バックエンドが起動していない、またはポートが使用中

**解決策**:
```bash
# バックエンドが起動しているか確認
ps aux | grep node

# ポートの使用状況を確認
lsof -i :3001

# バックエンドを再起動
cd backend && pnpm dev
```

#### 2. API認証エラー

**原因**: 環境変数が正しく設定されていない

**解決策**:
```bash
# .env ファイルの確認
cat backend/.env

# 環境変数が読み込まれているか確認
cd backend && node -e "require('dotenv').config(); console.log(process.env.ELEVENLABS_API_KEY)"
```

#### 3. 翻訳が動作しない

**原因**: Google Cloud の認証情報が正しくない

**解決策**:
```bash
# 認証情報ファイルの存在確認
ls -la /path/to/google-credentials.json

# 環境変数の確認
echo $GOOGLE_APPLICATION_CREDENTIALS
```

## 今後の開発タスク

### 優先度: 高

- [ ] 実際のAPI連携のテストと調整
- [ ] エラーハンドリングの強化
- [ ] レイテンシ最適化

### 優先度: 中

- [ ] 用語集管理UI の実装
- [ ] データベース連携
- [ ] ログ保存・エクスポート機能

### 優先度: 低

- [ ] PSTN/SIP フォールバック実装
- [ ] Google Meet Media API 対応
- [ ] 多言語UI対応

## 参考リンク

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
