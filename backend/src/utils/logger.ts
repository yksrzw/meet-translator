import winston from 'winston';
import { config } from '../config';

// ログフォーマット
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// コンソール用のフォーマット
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// ロガーインスタンス作成
export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    // コンソール出力
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // ファイル出力 (エラー)
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    // ファイル出力 (全て)
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

// 開発環境では詳細ログを出力
if (config.nodeEnv === 'development') {
  logger.debug('Logger initialized in development mode');
}
