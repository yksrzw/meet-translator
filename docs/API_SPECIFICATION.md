# API仕様書

## WebSocket API

バックエンドとフロントエンド間の通信は WebSocket を使用します。

### 接続

**エンドポイント**: `ws://localhost:3001`

接続が確立されると、サーバーから以下のメッセージが送信されます:

```json
{
  "type": "connected",
  "clientId": "uuid-v4",
  "timestamp": 1234567890
}
```

### メッセージ形式

すべてのメッセージは JSON 形式です。

#### クライアント → サーバー

##### 1. 会議開始

```json
{
  "type": "start_meeting",
  "config": {
    "meetingUrl": "https://meet.google.com/xxx-yyyy-zzz",
    "targetLanguages": ["zh-Hant-TW", "fr"],
    "enableVoice": true,
    "enableSubtitles": true,
    "voiceSettings": {
      "ja": {
        "voiceId": "...",
        "stability": 0.5,
        "similarityBoost": 0.75,
        "speed": 1.0
      }
    },
    "glossaryId": "my-glossary"
  }
}
```

**パラメータ**:
- `meetingUrl` (string, 必須): Google Meet の URL
- `targetLanguages` (string[], 必須): 翻訳対象言語のリスト (`ja`, `zh-Hant-TW`, `fr`)
- `enableVoice` (boolean, オプション): 音声出力を有効にするか (デフォルト: `true`)
- `enableSubtitles` (boolean, オプション): 字幕を有効にするか (デフォルト: `true`)
- `voiceSettings` (object, オプション): 言語ごとの音声設定
- `glossaryId` (string, オプション): 使用する用語集のID

**レスポンス**:
```json
{
  "type": "meeting_started",
  "clientId": "uuid-v4",
  "timestamp": 1234567890
}
```

##### 2. 会議停止

```json
{
  "type": "stop_meeting"
}
```

**レスポンス**:
```json
{
  "type": "meeting_stopped",
  "clientId": "uuid-v4",
  "timestamp": 1234567890
}
```

##### 3. Ping

```json
{
  "type": "ping"
}
```

**レスポンス**:
```json
{
  "type": "pong",
  "timestamp": 1234567890
}
```

#### サーバー → クライアント

##### 1. STT結果 (確定)

```json
{
  "type": "stt_result",
  "data": {
    "text": "こんにちは、今日は良い天気ですね。",
    "language": "ja",
    "isFinal": true,
    "confidence": 0.95,
    "timestamp": 1234567890,
    "speakerId": "speaker-1"
  }
}
```

##### 2. 翻訳結果

```json
{
  "type": "translations",
  "data": [
    {
      "originalText": "こんにちは、今日は良い天気ですね。",
      "translatedText": "你好,今天天氣真好。",
      "sourceLang": "ja",
      "targetLang": "zh-Hant-TW",
      "confidence": 0.9,
      "timestamp": 1234567890
    },
    {
      "originalText": "こんにちは、今日は良い天気ですね。",
      "translatedText": "Bonjour, il fait beau aujourd'hui.",
      "sourceLang": "ja",
      "targetLang": "fr",
      "confidence": 0.9,
      "timestamp": 1234567890
    }
  ]
}
```

##### 3. TTS結果

```json
{
  "type": "tts_results",
  "data": [
    {
      "audioData": "<base64-encoded-audio>",
      "language": "zh-Hant-TW",
      "timestamp": 1234567890
    },
    {
      "audioData": "<base64-encoded-audio>",
      "language": "fr",
      "timestamp": 1234567890
    }
  ]
}
```

##### 4. 字幕

```json
{
  "type": "subtitles",
  "data": [
    {
      "originalText": "こんにちは、今日は良い天気ですね。",
      "translatedText": "你好,今天天氣真好。",
      "sourceLang": "ja",
      "targetLang": "zh-Hant-TW",
      "timestamp": 1234567890
    }
  ]
}
```

##### 5. エラー

```json
{
  "type": "error",
  "error": "Failed to connect to meeting",
  "timestamp": 1234567890
}
```

## REST API

### ヘルスチェック

**エンドポイント**: `GET /health`

**レスポンス**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345.67
}
```

### ステータス

**エンドポイント**: `GET /api/status`

**レスポンス**:
```json
{
  "service": "Meet Translator Backend",
  "version": "1.0.0",
  "environment": "development"
}
```

## 型定義

### SupportedLanguage

```typescript
type SupportedLanguage = 'ja' | 'zh-Hant-TW' | 'fr';
```

### AudioChunk

```typescript
interface AudioChunk {
  data: Buffer;
  timestamp: number;
  speakerId?: string;
}
```

### STTResult

```typescript
interface STTResult {
  text: string;
  language: SupportedLanguage;
  isFinal: boolean;
  confidence: number;
  timestamp: number;
  speakerId?: string;
}
```

### TranslationResult

```typescript
interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLang: SupportedLanguage;
  targetLang: SupportedLanguage;
  confidence: number;
  timestamp: number;
  isInterim?: boolean;
}
```

### TTSResult

```typescript
interface TTSResult {
  audioData: Buffer;
  language: SupportedLanguage;
  timestamp: number;
}
```

### MeetingConfig

```typescript
interface MeetingConfig {
  meetingUrl: string;
  targetLanguages: SupportedLanguage[];
  enableVoice: boolean;
  enableSubtitles: boolean;
  voiceSettings?: VoiceSettings;
  glossaryId?: string;
}
```

### VoiceSettings

```typescript
interface VoiceSettings {
  [key: string]: {
    voiceId: string;
    stability: number;
    similarityBoost: number;
    speed: number;
  };
}
```

## エラーコード

| コード | 説明 |
| :--- | :--- |
| `INVALID_MESSAGE_FORMAT` | メッセージの形式が不正 |
| `MEETING_URL_REQUIRED` | 会議URLが指定されていない |
| `INVALID_LANGUAGE` | サポートされていない言語が指定された |
| `STT_CONNECTION_FAILED` | STTサービスへの接続に失敗 |
| `TRANSLATION_FAILED` | 翻訳処理に失敗 |
| `TTS_SYNTHESIS_FAILED` | 音声合成に失敗 |
| `RECALL_API_ERROR` | Recall.ai APIでエラーが発生 |
| `BOT_NOT_ACTIVE` | ボットがアクティブでない |

## レート制限

現在、レート制限は実装されていません。将来的に以下の制限を検討します:

- WebSocket接続: 1クライアントあたり最大10接続
- メッセージ送信: 1秒あたり最大100メッセージ

## セキュリティ

### 認証

現在、認証機能は実装されていません。本番環境では以下の実装を推奨します:

- JWT トークンによる認証
- APIキーによるアクセス制御

### CORS

開発環境では、すべてのオリジンからのアクセスを許可しています (`Access-Control-Allow-Origin: *`)。本番環境では適切に制限してください。

## バージョニング

現在のバージョン: **v1.0.0**

APIのバージョニングは今後実装予定です。
