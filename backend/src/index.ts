import express from 'express';
import http from 'http';
import { config, validateConfig } from './config';
import { logger } from './utils/logger';
import { WebSocketServer } from './services/WebSocketServer';

/**
 * アプリケーションのメインエントリーポイント
 */
async function main() {
  try {
    // 環境変数の検証
    logger.info('Validating configuration...');
    validateConfig();

    // Expressアプリケーションの作成
    const app = express();

    // ミドルウェア設定
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // CORS設定
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept'
      );
      next();
    });

    // ヘルスチェックエンドポイント
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // APIエンドポイント
    app.get('/api/status', (req, res) => {
      res.json({
        service: 'Meet Translator Backend',
        version: '1.0.0',
        environment: config.nodeEnv,
      });
    });

    // HTTPサーバーの作成
    const server = http.createServer(app);

    // WebSocketサーバーの初期化
    const wsServer = new WebSocketServer(server);

    // サーバー起動
    server.listen(config.port, () => {
      logger.info(`Server started on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`WebSocket endpoint: ws://localhost:${config.port}`);
    });

    // グレースフルシャットダウン
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');

      wsServer.close();

      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });

      // タイムアウト後に強制終了
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Failed to start application', { error });
    process.exit(1);
  }
}

// アプリケーション起動
main();
