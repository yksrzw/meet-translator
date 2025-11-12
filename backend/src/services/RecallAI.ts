import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AudioChunk } from '../types';

/**
 * Recall.ai Meeting Bot API クライアント
 */
export class RecallAI extends EventEmitter {
  private client: AxiosInstance;
  private botId: string | null = null;
  private isActive: boolean = false;
  private audioStreamUrl: string | null = null;

  constructor() {
    super();

    this.client = axios.create({
      baseURL: config.recall.apiUrl,
      headers: {
        Authorization: `Token ${config.recall.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * ボットを会議に参加させる
   */
  async joinMeeting(meetingUrl: string, botName: string = 'Translator'): Promise<string> {
    try {
      logger.info('Joining meeting via Recall.ai', { meetingUrl });

      const response = await this.client.post('/bot', {
        meeting_url: meetingUrl,
        bot_name: botName,
        transcription_options: {
          provider: 'meeting_captions', // 会議のキャプションを使用
        },
        recording_mode: 'speaker_view', // 話者ビューで録画
        automatic_leave: {
          waiting_room_timeout: 600, // 10分待機
          noone_joined_timeout: 600,
        },
      });

      this.botId = response.data.id;
      this.isActive = true;

      logger.info('Bot joined meeting successfully', {
        botId: this.botId,
        status: response.data.status_changes,
      });

      // ボットのステータスを監視
      this.monitorBotStatus();

      return this.botId;
    } catch (error: any) {
      logger.error('Failed to join meeting', {
        error: error.response?.data || error.message,
      });
      throw error;
    }
  }

  /**
   * ボットのステータスを監視
   */
  private async monitorBotStatus(): Promise<void> {
    if (!this.botId) return;

    const checkStatus = async () => {
      try {
        const response = await this.client.get(`/bot/${this.botId}`);
        const status = response.data.status_changes;

        logger.debug('Bot status', { status });

        // 音声ストリームのURLを取得
        if (response.data.media_retention_end) {
          this.audioStreamUrl = response.data.media_retention_end;
        }

        // ステータスに応じてイベントを発火
        const latestStatus = status[status.length - 1];
        if (latestStatus) {
          this.emit('status_change', latestStatus);

          if (latestStatus.code === 'in_call_not_recording') {
            this.emit('ready');
          } else if (latestStatus.code === 'call_ended') {
            this.emit('ended');
            this.isActive = false;
          } else if (latestStatus.code === 'fatal') {
            this.emit('error', new Error(latestStatus.message));
            this.isActive = false;
          }
        }

        // アクティブな場合は継続して監視
        if (this.isActive) {
          setTimeout(checkStatus, 5000); // 5秒ごとにチェック
        }
      } catch (error) {
        logger.error('Failed to check bot status', { error });
      }
    };

    checkStatus();
  }

  /**
   * 音声ストリームを取得
   */
  async getAudioStream(): Promise<NodeJS.ReadableStream> {
    if (!this.botId) {
      throw new Error('Bot is not active');
    }

    try {
      // Output Media APIを使用して音声ストリームを取得
      const response = await this.client.get(`/bot/${this.botId}/output_media`, {
        responseType: 'stream',
      });

      logger.info('Audio stream established');

      return response.data;
    } catch (error) {
      logger.error('Failed to get audio stream', { error });
      throw error;
    }
  }

  /**
   * 音声を会議に送信
   */
  async sendAudio(audioData: Buffer): Promise<void> {
    if (!this.botId) {
      throw new Error('Bot is not active');
    }

    try {
      // Output Media APIを使用して音声を送信
      await this.client.post(
        `/bot/${this.botId}/send_audio`,
        audioData,
        {
          headers: {
            'Content-Type': 'audio/mpeg',
          },
        }
      );

      logger.debug('Audio sent to meeting', { size: audioData.length });
    } catch (error) {
      logger.error('Failed to send audio', { error });
      throw error;
    }
  }

  /**
   * テキストをチャットに送信
   */
  async sendChatMessage(message: string): Promise<void> {
    if (!this.botId) {
      throw new Error('Bot is not active');
    }

    try {
      await this.client.post(`/bot/${this.botId}/send_chat`, {
        message,
      });

      logger.debug('Chat message sent', { message: message.substring(0, 50) });
    } catch (error) {
      logger.error('Failed to send chat message', { error });
      throw error;
    }
  }

  /**
   * ボットを会議から退出させる
   */
  async leaveMeeting(): Promise<void> {
    if (!this.botId) {
      logger.warn('No active bot to leave');
      return;
    }

    try {
      logger.info('Leaving meeting', { botId: this.botId });

      await this.client.delete(`/bot/${this.botId}`);

      this.botId = null;
      this.isActive = false;
      this.audioStreamUrl = null;

      logger.info('Bot left meeting successfully');
    } catch (error) {
      logger.error('Failed to leave meeting', { error });
      throw error;
    }
  }

  /**
   * ボットのアクティブ状態を取得
   */
  isActiveBot(): boolean {
    return this.isActive;
  }

  /**
   * ボットIDを取得
   */
  getBotId(): string | null {
    return this.botId;
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<boolean> {
    try {
      // ボット一覧を取得してAPIの接続を確認
      await this.client.get('/bot');
      return true;
    } catch (error) {
      logger.error('Recall.ai health check failed', { error });
      return false;
    }
  }
}
