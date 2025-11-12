import { TranslationServiceClient } from '@google-cloud/translate';
import { config } from '../config';
import { logger } from '../utils/logger';
import { TranslationResult, SupportedLanguage } from '../types';

/**
 * Google Cloud Translation サービス
 */
export class GoogleTranslation {
  private client: TranslationServiceClient;
  private projectId: string;
  private location: string = 'global';
  private glossaryCache: Map<string, string> = new Map();

  constructor() {
    this.client = new TranslationServiceClient({
      keyFilename: config.google.credentialsPath,
    });
    this.projectId = config.google.projectId;
  }

  /**
   * テキストを翻訳
   */
  async translate(
    text: string,
    sourceLang: SupportedLanguage,
    targetLang: SupportedLanguage,
    glossaryId?: string
  ): Promise<TranslationResult> {
    try {
      const startTime = Date.now();

      // 翻訳リクエストの構築
      const request: any = {
        parent: `projects/${this.projectId}/locations/${this.location}`,
        contents: [text],
        mimeType: 'text/plain',
        sourceLanguageCode: this.mapLanguageCode(sourceLang),
        targetLanguageCode: this.mapLanguageCode(targetLang),
      };

      // 用語集が指定されている場合
      if (glossaryId) {
        const glossaryPath = this.getGlossaryPath(glossaryId);
        request.glossaryConfig = {
          glossary: glossaryPath,
        };
      }

      // 翻訳実行
      const [response] = await this.client.translateText(request);

      const translatedText =
        response.glossaryTranslations?.[0]?.translatedText ||
        response.translations?.[0]?.translatedText ||
        '';

      const latency = Date.now() - startTime;

      logger.debug('Translation completed', {
        sourceLang,
        targetLang,
        latency,
        textLength: text.length,
      });

      return {
        originalText: text,
        translatedText,
        sourceLang,
        targetLang,
        confidence: 0.9, // Google APIは信頼度を返さないため固定値
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Translation failed', {
        error,
        sourceLang,
        targetLang,
      });
      throw error;
    }
  }

  /**
   * 複数の言語に一括翻訳
   */
  async translateMultiple(
    text: string,
    sourceLang: SupportedLanguage,
    targetLangs: SupportedLanguage[],
    glossaryId?: string
  ): Promise<TranslationResult[]> {
    const promises = targetLangs
      .filter((lang) => lang !== sourceLang)
      .map((targetLang) =>
        this.translate(text, sourceLang, targetLang, glossaryId)
      );

    return Promise.all(promises);
  }

  /**
   * 用語集を作成
   */
  async createGlossary(
    glossaryId: string,
    entries: Record<string, Record<string, string>>
  ): Promise<void> {
    try {
      const glossaryPath = this.getGlossaryPath(glossaryId);

      // 用語集の入力データを準備
      const glossaryEntries: any[] = [];
      for (const [sourceTerm, translations] of Object.entries(entries)) {
        for (const [targetLang, targetTerm] of Object.entries(translations)) {
          glossaryEntries.push({
            name: sourceTerm,
            terms: {
              [this.mapLanguageCode('ja' as SupportedLanguage)]: sourceTerm,
              [this.mapLanguageCode(targetLang as SupportedLanguage)]:
                targetTerm,
            },
          });
        }
      }

      const request = {
        parent: `projects/${this.projectId}/locations/${this.location}`,
        glossary: {
          name: glossaryPath,
          languagePair: {
            sourceLanguageCode: 'ja',
            targetLanguageCode: 'en', // 仮の設定
          },
          inputConfig: {
            gcsSource: {
              inputUri: '', // GCSパスが必要
            },
          },
        },
      };

      logger.info('Creating glossary', { glossaryId });
      // 実際の用語集作成はGCSファイルが必要なため、ここではスキップ
      // await this.client.createGlossary(request);

      this.glossaryCache.set(glossaryId, glossaryPath);
    } catch (error) {
      logger.error('Failed to create glossary', { error, glossaryId });
      throw error;
    }
  }

  /**
   * 用語集パスを取得
   */
  private getGlossaryPath(glossaryId: string): string {
    return `projects/${this.projectId}/locations/${this.location}/glossaries/${glossaryId}`;
  }

  /**
   * 言語コードをGoogle Cloud Translation形式にマッピング
   */
  private mapLanguageCode(lang: SupportedLanguage): string {
    const mapping: Record<SupportedLanguage, string> = {
      ja: 'ja',
      'zh-Hant-TW': 'zh-TW',
      fr: 'fr',
    };

    return mapping[lang] || lang;
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 簡単な翻訳テスト
      await this.translate('test', 'ja', 'fr');
      return true;
    } catch (error) {
      logger.error('Translation service health check failed', { error });
      return false;
    }
  }
}
