import { logger } from './logger';

/**
 * レイテンシ測定クラス
 */
export class LatencyTracker {
  private startTime: number;
  private checkpoints: Map<string, number>;

  constructor() {
    this.startTime = Date.now();
    this.checkpoints = new Map();
  }

  /**
   * チェックポイントを記録
   */
  checkpoint(name: string): void {
    const now = Date.now();
    const elapsed = now - this.startTime;
    this.checkpoints.set(name, elapsed);
    logger.debug(`Checkpoint [${name}]: ${elapsed}ms`);
  }

  /**
   * 2つのチェックポイント間の時間を取得
   */
  getDuration(start: string, end: string): number {
    const startTime = this.checkpoints.get(start);
    const endTime = this.checkpoints.get(end);

    if (startTime === undefined || endTime === undefined) {
      return 0;
    }

    return endTime - startTime;
  }

  /**
   * 全体の経過時間を取得
   */
  getTotalDuration(): number {
    return Date.now() - this.startTime;
  }

  /**
   * すべてのメトリクスを取得
   */
  getMetrics(): Record<string, number> {
    const metrics: Record<string, number> = {};
    this.checkpoints.forEach((value, key) => {
      metrics[key] = value;
    });
    metrics.total = this.getTotalDuration();
    return metrics;
  }

  /**
   * メトリクスをログ出力
   */
  logMetrics(): void {
    const metrics = this.getMetrics();
    logger.info('Latency Metrics', metrics);
  }
}

/**
 * パフォーマンスメトリクスの集計クラス
 */
export class MetricsAggregator {
  private metrics: {
    stt: number[];
    translation: number[];
    tts: number[];
    total: number[];
  };

  constructor() {
    this.metrics = {
      stt: [],
      translation: [],
      tts: [],
      total: [],
    };
  }

  /**
   * メトリクスを追加
   */
  addMetric(type: keyof typeof this.metrics, value: number): void {
    this.metrics[type].push(value);
  }

  /**
   * 平均値を計算
   */
  getAverage(type: keyof typeof this.metrics): number {
    const values = this.metrics[type];
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * 中央値を計算
   */
  getMedian(type: keyof typeof this.metrics): number {
    const values = [...this.metrics[type]].sort((a, b) => a - b);
    if (values.length === 0) return 0;
    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 0
      ? (values[mid - 1] + values[mid]) / 2
      : values[mid];
  }

  /**
   * 統計情報を取得
   */
  getStats(): Record<string, any> {
    return {
      stt: {
        avg: this.getAverage('stt'),
        median: this.getMedian('stt'),
        count: this.metrics.stt.length,
      },
      translation: {
        avg: this.getAverage('translation'),
        median: this.getMedian('translation'),
        count: this.metrics.translation.length,
      },
      tts: {
        avg: this.getAverage('tts'),
        median: this.getMedian('tts'),
        count: this.metrics.tts.length,
      },
      total: {
        avg: this.getAverage('total'),
        median: this.getMedian('total'),
        count: this.metrics.total.length,
      },
    };
  }

  /**
   * 統計情報をログ出力
   */
  logStats(): void {
    logger.info('Performance Statistics', this.getStats());
  }
}
