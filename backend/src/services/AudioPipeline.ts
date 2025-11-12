import { EventEmitter } from 'events';
import {
  AudioChunk,
  STTResult,
  TranslationResult,
  TTSResult,
  MeetingConfig,
  PipelineState,
  SupportedLanguage,
} from '../types';
import { logger } from '../utils/logger';
import { LatencyTracker, MetricsAggregator } from '../utils/metrics';

/**
 * 音声処理パイプライン
 * 音声入力 -> STT -> 翻訳 -> TTS -> 音声出力の一連の処理を管理
 */
export class AudioPipeline extends EventEmitter {
  private config: MeetingConfig;
  private state: PipelineState;
  private metricsAggregator: MetricsAggregator;
  private sttService: any; // STTServiceのインスタンス
  private translationService: any; // TranslationServiceのインスタンス
  private ttsService: any; // TTSServiceのインスタンス
  private useRealServices: boolean = false; // 実際のサービスを使用するかどうか

  constructor(config: MeetingConfig) {
    super();
    this.config = config;
    this.state = {
      isActive: false,
      latencyMetrics: {
        sttLatency: 0,
        translationLatency: 0,
        ttsLatency: 0,
        totalLatency: 0,
      },
    };
    this.metricsAggregator = new MetricsAggregator();
  }

  /**
   * パイプラインを開始
   */
  async start(): Promise<void> {
    logger.info('Starting audio pipeline', {
      meetingUrl: this.config.meetingUrl,
      targetLanguages: this.config.targetLanguages,
    });

    this.state.isActive = true;
    this.emit('started');
  }

  /**
   * パイプラインを停止
   */
  async stop(): Promise<void> {
    logger.info('Stopping audio pipeline');
    this.state.isActive = false;

    // 統計情報をログ出力
    this.metricsAggregator.logStats();

    this.emit('stopped');
  }

  /**
   * 音声チャンクを処理
   */
  async processAudioChunk(chunk: AudioChunk): Promise<void> {
    if (!this.state.isActive) {
      return;
    }

    const tracker = new LatencyTracker();

    try {
      // 1. STT処理
      tracker.checkpoint('stt_start');
      const sttResult = await this.performSTT(chunk);
      tracker.checkpoint('stt_end');

      if (!sttResult.isFinal) {
        // 部分結果の場合は翻訳をスキップ
        this.emit('stt_partial', sttResult);
        return;
      }

      this.emit('stt_final', sttResult);

      // 2. 翻訳処理（複数言語に対して並列実行）
      tracker.checkpoint('translation_start');
      const translations = await this.performTranslation(sttResult);
      tracker.checkpoint('translation_end');

      this.emit('translations', translations);

      // 3. TTS処理（音声が有効な場合）
      if (this.config.enableVoice) {
        tracker.checkpoint('tts_start');
        const ttsResults = await this.performTTS(translations);
        tracker.checkpoint('tts_end');

        this.emit('tts_results', ttsResults);
      }

      // 4. 字幕出力（字幕が有効な場合）
      if (this.config.enableSubtitles) {
        this.emit('subtitles', translations);
      }

      // レイテンシメトリクスを記録
      const sttLatency = tracker.getDuration('stt_start', 'stt_end');
      const translationLatency = tracker.getDuration(
        'translation_start',
        'translation_end'
      );
      const ttsLatency = this.config.enableVoice
        ? tracker.getDuration('tts_start', 'tts_end')
        : 0;
      const totalLatency = tracker.getTotalDuration();

      this.metricsAggregator.addMetric('stt', sttLatency);
      this.metricsAggregator.addMetric('translation', translationLatency);
      this.metricsAggregator.addMetric('tts', ttsLatency);
      this.metricsAggregator.addMetric('total', totalLatency);

      this.state.latencyMetrics = {
        sttLatency,
        translationLatency,
        ttsLatency,
        totalLatency,
      };

      logger.debug('Processing completed', this.state.latencyMetrics);
    } catch (error) {
      logger.error('Error processing audio chunk', { error });
      this.emit('error', error);
    }
  }

  /**
   * STT処理
   */
  private async performSTT(chunk: AudioChunk): Promise<STTResult> {
    if (this.useRealServices && this.sttService) {
      // 実際のSTTサービスを使用
      await this.sttService.sendAudioChunk(chunk);
      // STTサービスはイベント経由で結果を返すため、ここでは待機しない
      // モックの結果を返す
      return {
        text: '',
        language: 'ja',
        isFinal: false,
        confidence: 0,
        timestamp: Date.now(),
        speakerId: chunk.speakerId,
      };
    }

    // モック実装
    return {
      text: 'こんにちは、今日は良い天気ですね。',
      language: 'ja',
      isFinal: true,
      confidence: 0.95,
      timestamp: Date.now(),
      speakerId: chunk.speakerId,
    };
  }

  /**
   * 翻訳処理
   */
  private async performTranslation(
    sttResult: STTResult
  ): Promise<TranslationResult[]> {
    if (this.useRealServices && this.translationService) {
      // 実際の翻訳サービスを使用
      return await this.translationService.translateMultiple(
        sttResult.text,
        sttResult.language,
        this.config.targetLanguages,
        this.config.glossaryId
      );
    }

    // モック実装
    const translations: TranslationResult[] = [];

    for (const targetLang of this.config.targetLanguages) {
      if (targetLang === sttResult.language) {
        continue; // 同じ言語への翻訳はスキップ
      }

      // モック翻訳
      let translatedText = '';
      if (targetLang === 'zh-Hant-TW') {
        translatedText = '你好,今天天氣真好。';
      } else if (targetLang === 'fr') {
        translatedText = 'Bonjour, il fait beau aujourd\'hui.';
      }

      translations.push({
        originalText: sttResult.text,
        translatedText,
        sourceLang: sttResult.language,
        targetLang,
        confidence: 0.9,
        timestamp: Date.now(),
      });
    }

    return translations;
  }

  /**
   * TTS処理
   */
  private async performTTS(
    translations: TranslationResult[]
  ): Promise<TTSResult[]> {
    if (this.useRealServices && this.ttsService) {
      // 実際のTTSサービスを使用
      const ttsInputs = translations.map((t) => ({
        text: t.translatedText,
        language: t.targetLang,
      }));
      return await this.ttsService.synthesizeMultiple(ttsInputs);
    }

    // モック実装
    const ttsResults: TTSResult[] = [];

    for (const translation of translations) {
      ttsResults.push({
        audioData: Buffer.from('mock_audio_data'),
        language: translation.targetLang,
        timestamp: Date.now(),
      });
    }

    return ttsResults;
  }

  /**
   * 現在の状態を取得
   */
  getState(): PipelineState {
    return { ...this.state };
  }

  /**
   * サービスをセット(依存性注入)
   */
  setServices(
    services: {
      stt?: any;
      translation?: any;
      tts?: any;
    },
    useReal: boolean = false
  ): void {
    if (services.stt) this.sttService = services.stt;
    if (services.translation) this.translationService = services.translation;
    if (services.tts) this.ttsService = services.tts;
    this.useRealServices = useReal;
  }
}
