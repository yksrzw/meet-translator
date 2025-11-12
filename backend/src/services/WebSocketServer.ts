import WebSocket from 'ws';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger';
import { AudioPipeline } from './AudioPipeline';
import { MeetingConfig, AudioChunk } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * WebSocketサーバー
 * クライアントとの双方向通信を管理
 */
export class WebSocketServer {
  private wss: WebSocket.Server;
  private pipelines: Map<string, AudioPipeline>;
  private clients: Map<string, WebSocket>;

  constructor(server: HTTPServer) {
    this.wss = new WebSocket.Server({ server });
    this.pipelines = new Map();
    this.clients = new Map();

    this.setupWebSocketServer();
  }

  /**
   * WebSocketサーバーのセットアップ
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = uuidv4();
      this.clients.set(clientId, ws);

      logger.info('Client connected', { clientId });

      ws.on('message', async (data: WebSocket.Data) => {
        try {
          await this.handleMessage(clientId, ws, data);
        } catch (error) {
          logger.error('Error handling message', { error, clientId });
          this.sendError(ws, 'Failed to process message');
        }
      });

      ws.on('close', () => {
        logger.info('Client disconnected', { clientId });
        this.handleDisconnect(clientId);
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', { error, clientId });
      });

      // 接続確認メッセージを送信
      this.sendMessage(ws, {
        type: 'connected',
        clientId,
        timestamp: Date.now(),
      });
    });

    logger.info('WebSocket server initialized');
  }

  /**
   * メッセージハンドラー
   */
  private async handleMessage(
    clientId: string,
    ws: WebSocket,
    data: WebSocket.Data
  ): Promise<void> {
    let message: any;

    try {
      // バイナリデータの場合は音声チャンクとして処理
      if (data instanceof Buffer) {
        await this.handleAudioChunk(clientId, data);
        return;
      }

      // JSON メッセージの場合
      message = JSON.parse(data.toString());
    } catch (error) {
      logger.error('Failed to parse message', { error });
      this.sendError(ws, 'Invalid message format');
      return;
    }

    logger.debug('Received message', { type: message.type, clientId });

    switch (message.type) {
      case 'start_meeting':
        await this.handleStartMeeting(clientId, ws, message.config);
        break;

      case 'stop_meeting':
        await this.handleStopMeeting(clientId, ws);
        break;

      case 'ping':
        this.sendMessage(ws, { type: 'pong', timestamp: Date.now() });
        break;

      default:
        logger.warn('Unknown message type', { type: message.type });
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * 会議開始ハンドラー
   */
  private async handleStartMeeting(
    clientId: string,
    ws: WebSocket,
    config: MeetingConfig
  ): Promise<void> {
    logger.info('Starting meeting', { clientId, config });

    // パイプラインを作成
    const pipeline = new AudioPipeline(config);

    // イベントリスナーを設定
    pipeline.on('stt_final', (result) => {
      this.sendMessage(ws, { type: 'stt_result', data: result });
    });

    pipeline.on('translations', (translations) => {
      this.sendMessage(ws, { type: 'translations', data: translations });
    });

    pipeline.on('tts_results', (results) => {
      this.sendMessage(ws, { type: 'tts_results', data: results });
    });

    pipeline.on('subtitles', (subtitles) => {
      this.sendMessage(ws, { type: 'subtitles', data: subtitles });
    });

    pipeline.on('error', (error) => {
      this.sendError(ws, error.message);
    });

    // パイプラインを開始
    await pipeline.start();

    this.pipelines.set(clientId, pipeline);

    this.sendMessage(ws, {
      type: 'meeting_started',
      clientId,
      timestamp: Date.now(),
    });
  }

  /**
   * 会議停止ハンドラー
   */
  private async handleStopMeeting(
    clientId: string,
    ws: WebSocket
  ): Promise<void> {
    logger.info('Stopping meeting', { clientId });

    const pipeline = this.pipelines.get(clientId);
    if (pipeline) {
      await pipeline.stop();
      this.pipelines.delete(clientId);
    }

    this.sendMessage(ws, {
      type: 'meeting_stopped',
      clientId,
      timestamp: Date.now(),
    });
  }

  /**
   * 音声チャンクハンドラー
   */
  private async handleAudioChunk(
    clientId: string,
    data: Buffer
  ): Promise<void> {
    const pipeline = this.pipelines.get(clientId);
    if (!pipeline) {
      logger.warn('No active pipeline for client', { clientId });
      return;
    }

    const chunk: AudioChunk = {
      data,
      timestamp: Date.now(),
    };

    await pipeline.processAudioChunk(chunk);
  }

  /**
   * クライアント切断ハンドラー
   */
  private handleDisconnect(clientId: string): void {
    const pipeline = this.pipelines.get(clientId);
    if (pipeline) {
      pipeline.stop();
      this.pipelines.delete(clientId);
    }

    this.clients.delete(clientId);
  }

  /**
   * メッセージ送信
   */
  private sendMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * エラーメッセージ送信
   */
  private sendError(ws: WebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      error,
      timestamp: Date.now(),
    });
  }

  /**
   * サーバーを閉じる
   */
  close(): void {
    logger.info('Closing WebSocket server');

    // すべてのパイプラインを停止
    this.pipelines.forEach((pipeline) => pipeline.stop());
    this.pipelines.clear();

    // すべてのクライアント接続を閉じる
    this.clients.forEach((ws) => ws.close());
    this.clients.clear();

    this.wss.close();
  }
}
