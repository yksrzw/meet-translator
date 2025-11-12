import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { config } from '../config';
import { logger } from '../utils/logger';
import { STTResult, AudioChunk, SupportedLanguage } from '../types';

/**
 * ElevenLabs Scribe v2 Realtime STTサービス
 */
export class ElevenLabsSTT extends EventEmitter {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor() {
    super();
  }

  /**
   * WebSocket接続を確立
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${config.elevenlabs.sttWsUrl}?api_key=${config.elevenlabs.apiKey}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          logger.info('ElevenLabs STT WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
          logger.error('ElevenLabs STT WebSocket error', { error });
          this.emit('error', error);
          reject(error);
        });

        this.ws.on('close', () => {
          logger.info('ElevenLabs STT WebSocket closed');
          this.isConnected = false;
          this.emit('disconnected');
          this.handleReconnect();
        });
      } catch (error) {
        logger.error('Failed to connect to ElevenLabs STT', { error });
        reject(error);
      }
    });
  }

  /**
   * メッセージハンドラー
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'transcription') {
        const result: STTResult = {
          text: message.text,
          language: this.mapLanguageCode(message.language),
          isFinal: message.is_final || false,
          confidence: message.confidence || 0.9,
          timestamp: Date.now(),
        };

        this.emit('result', result);

        if (result.isFinal) {
          logger.debug('STT final result', {
            text: result.text,
            language: result.language,
          });
        }
      } else if (message.type === 'error') {
        logger.error('STT error from server', { error: message.error });
        this.emit('error', new Error(message.error));
      }
    } catch (error) {
      logger.error('Failed to parse STT message', { error });
    }
  }

  /**
   * 音声チャンクを送信
   */
  async sendAudioChunk(chunk: AudioChunk): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('STT WebSocket is not connected');
    }

    try {
      // 音声データをBase64エンコードして送信
      const audioBase64 = chunk.data.toString('base64');

      const message = {
        type: 'audio',
        audio: audioBase64,
        timestamp: chunk.timestamp,
      };

      this.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Failed to send audio chunk to STT', { error });
      throw error;
    }
  }

  /**
   * 再接続処理
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnect attempts reached for STT');
      this.emit('max_reconnect_attempts');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    logger.info(`Attempting to reconnect STT in ${delay}ms`, {
      attempt: this.reconnectAttempts,
    });

    setTimeout(() => {
      this.connect().catch((error) => {
        logger.error('Reconnect failed', { error });
      });
    }, delay);
  }

  /**
   * 言語コードをマッピング
   */
  private mapLanguageCode(code: string): SupportedLanguage {
    const mapping: Record<string, SupportedLanguage> = {
      ja: 'ja',
      'ja-JP': 'ja',
      'zh-TW': 'zh-Hant-TW',
      'zh-Hant': 'zh-Hant-TW',
      fr: 'fr',
      'fr-FR': 'fr',
    };

    return mapping[code] || 'ja';
  }

  /**
   * 接続を閉じる
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  /**
   * 接続状態を取得
   */
  isActive(): boolean {
    return this.isConnected;
  }
}
