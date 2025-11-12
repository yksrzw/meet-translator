import dotenv from 'dotenv';
import path from 'path';

// 環境変数を読み込み
dotenv.config();

export const config = {
  // サーバー設定
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Recall.ai API
  recall: {
    apiKey: process.env.RECALL_API_KEY || '',
    apiUrl: 'https://api.recall.ai/api/v1',
  },

  // ElevenLabs API
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY || '',
    sttWsUrl: 'wss://api.elevenlabs.io/v1/scribe/realtime',
    ttsWsUrl: 'wss://api.elevenlabs.io/v1/text-to-speech/stream',
    apiUrl: 'https://api.elevenlabs.io/v1',
  },

  // Google Cloud Translation
  google: {
    projectId: process.env.GOOGLE_PROJECT_ID || '',
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  },

  // DeepL API (フォールバック)
  deepl: {
    apiKey: process.env.DEEPL_API_KEY || '',
    apiUrl: 'https://api-free.deepl.com/v2',
  },

  // データベース設定
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'meet_translator',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },

  // ログ設定
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // レイテンシ目標値 (ms)
  latencyTargets: {
    stt: 150,
    translation: 300,
    tts: 250,
    total: 700,
  },
};

// 必須の環境変数チェック
export function validateConfig(): void {
  const requiredVars = [
    'RECALL_API_KEY',
    'ELEVENLABS_API_KEY',
    'GOOGLE_PROJECT_ID',
  ];

  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}
