# Google Meet 多言語リアルタイム翻訳エージェント

Google Meet 上で動作する多言語（日本語、台湾華語、フランス語）リアルタイム翻訳エージェントのMVP実装です。会議にボットとして参加し、参加者の発話をリアルタイムで文字起こし・翻訳し、合成音声と字幕で提供します。

## 機能

- **リアルタイム音声認識 (STT)**: ElevenLabs Scribe v2 Realtime を使用した低遅延の音声文字起こし
- **多言語翻訳**: Google Cloud Translation API v3 による高品質な翻訳（用語集対応）
- **音声合成 (TTS)**: ElevenLabs Flash v2.5 による自然な音声合成
- **Google Meet 連携**: Recall.ai Bot API を使用した会議への参加と音声入出力
- **リアルタイム字幕**: Web UI でのライブ字幕表示

## システム構成

```
meet-translator/
├── backend/          # Node.js/TypeScript バックエンド
│   ├── src/
│   │   ├── services/     # 各種サービス (STT, 翻訳, TTS, Recall.ai)
│   │   ├── utils/        # ユーティリティ (ロガー, メトリクス)
│   │   ├── types/        # 型定義
│   │   ├── config/       # 設定管理
│   │   └── index.ts      # メインエントリーポイント
│   └── package.json
├── frontend/         # Next.js/React フロントエンド
│   ├── app/
│   │   └── page.tsx      # メインUI
│   └── package.json
└── docs/             # ドキュメント
```

## 前提条件

- **Node.js**: v20 以上
- **pnpm**: v8 以上
- **APIキー**:
  - Recall.ai API キー
  - ElevenLabs API キー
  - Google Cloud Translation API 認証情報

## セットアップ

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd meet-translator
```

### 2. バックエンドのセットアップ

```bash
cd backend

# 依存関係のインストール
pnpm install

# 環境変数の設定
cp .env.example .env
# .env ファイルを編集して、各種APIキーを設定
```

**`.env` ファイルの設定例:**

```env
PORT=3001
NODE_ENV=development

RECALL_API_KEY=your_recall_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
GOOGLE_APPLICATION_CREDENTIALS=/path/to/google-credentials.json
GOOGLE_PROJECT_ID=your_google_project_id
```

### 3. フロントエンドのセットアップ

```bash
cd ../frontend

# 依存関係のインストール
pnpm install
```

## 起動方法

### バックエンドの起動

```bash
cd backend
pnpm dev
```

バックエンドサーバーが `http://localhost:3001` で起動します。

### フロントエンドの起動

```bash
cd frontend
pnpm dev
```

フロントエンドが `http://localhost:3000` で起動します。

## 使い方

1. ブラウザで `http://localhost:3000` にアクセス
2. 「サーバーに接続」ボタンをクリックしてバックエンドに接続
3. Google Meet の URL を入力
4. 「会議に参加」ボタンをクリック
5. リアルタイムで翻訳結果が表示されます

## アーキテクチャ

### 音声処理パイプライン

```
音声入力 (Google Meet)
    ↓
Recall.ai Bot API (音声取得)
    ↓
ElevenLabs Scribe v2 (STT)
    ↓
Google Cloud Translation (翻訳)
    ↓
ElevenLabs Flash v2.5 (TTS)
    ↓
Recall.ai Bot API (音声出力)
    ↓
音声出力 (Google Meet)
```

### WebSocket通信

フロントエンドとバックエンドは WebSocket で通信し、以下のメッセージタイプをサポートします:

- `start_meeting`: 会議への参加を開始
- `stop_meeting`: 会議から退出
- `translations`: 翻訳結果の通知
- `subtitles`: 字幕データの通知
- `error`: エラー通知

## レイテンシ目標

- **STT**: ~150ms (ElevenLabs Scribe v2 Realtime)
- **翻訳**: ~150-300ms (Google Cloud Translation)
- **TTS**: ~75-250ms (ElevenLabs Flash v2.5)
- **合計**: ~400-700ms (エンドツーエンド)

## 開発状況

### 実装済み

- ✅ プロジェクト構造のセットアップ
- ✅ WebSocket サーバー
- ✅ 音声処理パイプライン (モック実装)
- ✅ ElevenLabs STT サービス
- ✅ Google Cloud Translation サービス
- ✅ ElevenLabs TTS サービス
- ✅ Recall.ai 連携サービス
- ✅ フロントエンド管理 UI

### 未実装 (今後の拡張)

- ⏳ 実際の外部API連携のテスト
- ⏳ 用語集管理機能
- ⏳ データベース連携
- ⏳ ログ保存・エクスポート機能
- ⏳ PSTN/SIP フォールバック
- ⏳ Google Meet Media API 対応

## トラブルシューティング

### WebSocket接続エラー

バックエンドが起動していることを確認してください:

```bash
cd backend
pnpm dev
```

### API認証エラー

`.env` ファイルに正しいAPIキーが設定されているか確認してください。

### Google Cloud Translation エラー

Google Cloud の認証情報ファイルのパスが正しく設定されているか確認してください。

## ライセンス

MIT

## 作成者

Manus AI

## 参考資料

- [ElevenLabs API Documentation](https://elevenlabs.io/docs)
- [Google Cloud Translation API](https://cloud.google.com/translate/docs)
- [Recall.ai API Documentation](https://docs.recall.ai)
- [Next.js Documentation](https://nextjs.org/docs)
