# プロジェクトサマリー

## プロジェクト名
Google Meet 多言語リアルタイム翻訳エージェント

## 概要
Google Meet 上で動作する多言語（日本語、台湾華語、フランス語）リアルタイム翻訳エージェントのMVP実装です。会議にボットとして参加し、参加者の発話をリアルタイムで文字起こし・翻訳し、合成音声と字幕で提供します。

## 実装状況

### ✅ 完了した項目

1. **プロジェクト構造のセットアップ**
   - モノレポ構成（backend / frontend / docs）
   - TypeScript環境の構築
   - 依存関係の定義

2. **バックエンド基盤**
   - WebSocketサーバーの実装
   - 音声処理パイプラインの実装
   - イベント駆動アーキテクチャの構築
   - ロギングとメトリクス測定の実装

3. **外部API連携サービス**
   - ElevenLabs STT サービス（WebSocket接続、自動再接続）
   - Google Cloud Translation サービス（用語集対応）
   - ElevenLabs TTS サービス（低遅延音声合成）
   - Recall.ai 連携サービス（会議参加、音声入出力）

4. **フロントエンド管理UI**
   - Next.js + React + TypeScript
   - WebSocket通信
   - リアルタイム翻訳結果表示
   - 会議参加/退出コントロール

5. **ドキュメント**
   - README.md（セットアップ手順、使い方）
   - DEVELOPMENT_GUIDE.md（開発ガイド）
   - API_SPECIFICATION.md（API仕様書）
   - DEPLOYMENT_GUIDE.md（デプロイガイド）

6. **GitHubリポジトリ**
   - リポジトリ作成: https://github.com/yksrzw/meet-translator
   - 初期コミット完了

## 技術スタック

| カテゴリ | 技術 |
| :--- | :--- |
| **バックエンド** | Node.js 20, TypeScript 5, Express, WebSocket |
| **フロントエンド** | Next.js 15, React 19, TypeScript, Tailwind CSS |
| **STT** | ElevenLabs Scribe v2 Realtime |
| **翻訳** | Google Cloud Translation API v3 |
| **TTS** | ElevenLabs Flash v2.5 / Turbo |
| **Meet連携** | Recall.ai Bot API |
| **ロギング** | Winston |
| **パッケージ管理** | pnpm |

## アーキテクチャ

```
┌─────────────────┐
│  Google Meet    │
│   (会議)        │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Recall.ai API  │
│  (音声入出力)   │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────────────┐
│  バックエンド (Node.js/TypeScript)  │
│  ┌──────────────────────────────┐   │
│  │  WebSocketサーバー           │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │  音声処理パイプライン        │   │
│  │  ├─ STT (ElevenLabs)         │   │
│  │  ├─ 翻訳 (Google Cloud)      │   │
│  │  └─ TTS (ElevenLabs)         │   │
│  └──────────────────────────────┘   │
└─────────────┬───────────────────────┘
              │
              ↓ WebSocket
┌─────────────────────────────────────┐
│  フロントエンド (Next.js/React)     │
│  - リアルタイム字幕表示             │
│  - 会議コントロール                 │
└─────────────────────────────────────┘
```

## ファイル構成

```
meet-translator/
├── README.md                           # プロジェクト概要
├── PROJECT_SUMMARY.md                  # このファイル
├── .gitignore
│
├── backend/                            # バックエンド
│   ├── src/
│   │   ├── index.ts                    # エントリーポイント
│   │   ├── config/
│   │   │   └── index.ts                # 設定管理
│   │   ├── services/
│   │   │   ├── AudioPipeline.ts        # 音声処理パイプライン
│   │   │   ├── WebSocketServer.ts      # WebSocketサーバー
│   │   │   ├── ElevenLabsSTT.ts        # STTサービス
│   │   │   ├── GoogleTranslation.ts    # 翻訳サービス
│   │   │   ├── ElevenLabsTTS.ts        # TTSサービス
│   │   │   └── RecallAI.ts             # Recall.ai連携
│   │   ├── utils/
│   │   │   ├── logger.ts               # ロギング
│   │   │   └── metrics.ts              # メトリクス測定
│   │   └── types/
│   │       └── index.ts                # 型定義
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example                    # 環境変数テンプレート
│
├── frontend/                           # フロントエンド
│   ├── app/
│   │   ├── page.tsx                    # メインページ
│   │   ├── layout.tsx                  # レイアウト
│   │   └── globals.css                 # グローバルスタイル
│   ├── package.json
│   └── tsconfig.json
│
└── docs/                               # ドキュメント
    ├── DEVELOPMENT_GUIDE.md            # 開発ガイド
    ├── API_SPECIFICATION.md            # API仕様書
    └── DEPLOYMENT_GUIDE.md             # デプロイガイド
```

## 主要機能

### 実装済み

1. **WebSocket通信**
   - クライアント-サーバー間の双方向通信
   - 自動再接続機能
   - メッセージタイプ別のハンドリング

2. **音声処理パイプライン**
   - 音声チャンクの受信と処理
   - STT → 翻訳 → TTS の一連の処理
   - レイテンシ測定とメトリクス収集

3. **外部API連携**
   - ElevenLabs STT（WebSocket）
   - Google Cloud Translation（用語集対応）
   - ElevenLabs TTS（ストリーミング）
   - Recall.ai（会議参加、音声入出力）

4. **フロントエンドUI**
   - サーバー接続状態の表示
   - 会議URL入力と参加/退出
   - リアルタイム翻訳結果の表示

### 未実装（今後の拡張）

1. **実際のAPI統合テスト**
   - 各外部APIの実環境でのテスト
   - エラーハンドリングの調整

2. **用語集管理機能**
   - 用語集のCRUD操作
   - 会議ごとの用語集選択

3. **データベース連携**
   - 会議履歴の保存
   - 翻訳ログの保存

4. **高度な機能**
   - 話者識別の精度向上
   - PSTN/SIPフォールバック
   - Google Meet Media API対応

## レイテンシ目標

| 処理 | 目標値 | 使用技術 |
| :--- | :--- | :--- |
| STT | ~150ms | ElevenLabs Scribe v2 Realtime |
| 翻訳 | ~150-300ms | Google Cloud Translation API v3 |
| TTS | ~75-250ms | ElevenLabs Flash v2.5 |
| **合計** | **~400-700ms** | エンドツーエンド |

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone https://github.com/yksrzw/meet-translator.git
cd meet-translator
```

### 2. バックエンドのセットアップ

```bash
cd backend
pnpm install
cp .env.example .env
# .env ファイルを編集してAPIキーを設定
pnpm dev
```

### 3. フロントエンドのセットアップ

```bash
cd frontend
pnpm install
pnpm dev
```

### 4. ブラウザでアクセス

http://localhost:3000

## 必要なAPIキー

1. **Recall.ai API Key**
   - https://recall.ai/ でアカウント作成
   - APIキーを取得

2. **ElevenLabs API Key**
   - https://elevenlabs.io/ でアカウント作成
   - APIキーを取得

3. **Google Cloud Translation API**
   - Google Cloud Console でプロジェクト作成
   - Translation API を有効化
   - サービスアカウントキーを作成

## 次のステップ

1. **実環境でのテスト**
   - 実際のGoogle Meet会議でテスト
   - 各APIの動作確認

2. **パフォーマンス最適化**
   - レイテンシの測定と改善
   - ボトルネックの特定

3. **エラーハンドリングの強化**
   - API障害時の処理
   - 自動リトライ機能

4. **UI/UXの改善**
   - 設定画面の追加
   - エラー表示の改善

## ライセンス

MIT

## 作成者

Manus AI

## リポジトリ

https://github.com/yksrzw/meet-translator
