import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { TTSResult, SupportedLanguage } from '../types';

/**
 * ElevenLabs TTS サービス
 */
export class ElevenLabsTTS {
  private apiKey: string;
  private apiUrl: string;
  private voiceSettings: Record<
    SupportedLanguage,
    {
      voiceId: string;
      stability: number;
      similarityBoost: number;
    }
  >;

  constructor() {
    this.apiKey = config.elevenlabs.apiKey;
    this.apiUrl = config.elevenlabs.apiUrl;

    // デフォルトのボイス設定
    this.voiceSettings = {
      ja: {
        voiceId: 'EXAVITQu4vr4xnSDxMaL', // デフォルトの日本語ボイス
        stability: 0.5,
        similarityBoost: 0.75,
      },
      'zh-Hant-TW': {
        voiceId: 'pNInz6obpgDQGcFmaJgB', // デフォルトの中国語ボイス
        stability: 0.5,
        similarityBoost: 0.75,
      },
      fr: {
        voiceId: 'ThT5KcBeYPX3keUQqHPh', // デフォルトのフランス語ボイス
        stability: 0.5,
        similarityBoost: 0.75,
      },
    };
  }

  /**
   * テキストを音声に変換
   */
  async synthesize(
    text: string,
    language: SupportedLanguage,
    modelId: string = 'eleven_flash_v2_5'
  ): Promise<TTSResult> {
    try {
      const startTime = Date.now();

      const voiceSetting = this.voiceSettings[language];
      if (!voiceSetting) {
        throw new Error(`Unsupported language for TTS: ${language}`);
      }

      const url = `${this.apiUrl}/text-to-speech/${voiceSetting.voiceId}/stream`;

      const response = await axios.post(
        url,
        {
          text,
          model_id: modelId,
          voice_settings: {
            stability: voiceSetting.stability,
            similarity_boost: voiceSetting.similarityBoost,
          },
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          responseType: 'arraybuffer',
        }
      );

      const audioData = Buffer.from(response.data);
      const latency = Date.now() - startTime;

      logger.debug('TTS synthesis completed', {
        language,
        latency,
        textLength: text.length,
        audioSize: audioData.length,
      });

      return {
        audioData,
        language,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('TTS synthesis failed', {
        error,
        language,
        text: text.substring(0, 50),
      });
      throw error;
    }
  }

  /**
   * 複数の言語で音声合成
   */
  async synthesizeMultiple(
    translations: Array<{ text: string; language: SupportedLanguage }>
  ): Promise<TTSResult[]> {
    const promises = translations.map((t) =>
      this.synthesize(t.text, t.language)
    );

    return Promise.all(promises);
  }

  /**
   * ボイス設定を更新
   */
  setVoiceSettings(
    language: SupportedLanguage,
    settings: {
      voiceId?: string;
      stability?: number;
      similarityBoost?: number;
    }
  ): void {
    const current = this.voiceSettings[language];
    if (!current) {
      throw new Error(`Unsupported language: ${language}`);
    }

    this.voiceSettings[language] = {
      voiceId: settings.voiceId || current.voiceId,
      stability: settings.stability ?? current.stability,
      similarityBoost: settings.similarityBoost ?? current.similarityBoost,
    };

    logger.info('Voice settings updated', { language, settings });
  }

  /**
   * 利用可能なボイスを取得
   */
  async getAvailableVoices(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.apiUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      return response.data.voices || [];
    } catch (error) {
      logger.error('Failed to get available voices', { error });
      throw error;
    }
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<boolean> {
    try {
      // ボイス一覧取得でヘルスチェック
      await this.getAvailableVoices();
      return true;
    } catch (error) {
      logger.error('TTS service health check failed', { error });
      return false;
    }
  }
}
