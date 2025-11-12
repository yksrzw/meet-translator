/**
 * 型定義ファイル
 */

// サポートされる言語
export type SupportedLanguage = 'ja' | 'zh-Hant-TW' | 'fr';

// 言語ペア
export interface LanguagePair {
  source: SupportedLanguage;
  target: SupportedLanguage;
}

// 音声チャンク
export interface AudioChunk {
  data: Buffer;
  timestamp: number;
  speakerId?: string;
}

// STT結果
export interface STTResult {
  text: string;
  language: SupportedLanguage;
  isFinal: boolean;
  confidence: number;
  timestamp: number;
  speakerId?: string;
}

// 翻訳結果
export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLang: SupportedLanguage;
  targetLang: SupportedLanguage;
  confidence: number;
  timestamp: number;
  isInterim?: boolean; // 逐次翻訳かどうか
}

// TTS結果
export interface TTSResult {
  audioData: Buffer;
  language: SupportedLanguage;
  timestamp: number;
}

// 会議設定
export interface MeetingConfig {
  meetingUrl: string;
  targetLanguages: SupportedLanguage[];
  enableVoice: boolean;
  enableSubtitles: boolean;
  voiceSettings?: VoiceSettings;
  glossaryId?: string;
}

// 音声設定
export interface VoiceSettings {
  [key: string]: {
    voiceId: string;
    stability: number;
    similarityBoost: number;
    speed: number;
  };
}

// パイプライン状態
export interface PipelineState {
  isActive: boolean;
  currentSpeaker?: string;
  latencyMetrics: LatencyMetrics;
}

// レイテンシメトリクス
export interface LatencyMetrics {
  sttLatency: number;
  translationLatency: number;
  ttsLatency: number;
  totalLatency: number;
}

// エラー型
export class TranslationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'TranslationError';
  }
}
