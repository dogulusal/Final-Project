import natural from 'natural';
import fs from 'fs';
import path from 'path';
import type { Prisma } from '@prisma/client';
import { INewsCategorizationService, CategoryResult, TrainingData, SentimentResult } from './ml.interface';
import { ML_CONFIDENCE_THRESHOLD } from '../../config/constants';
import { prisma } from '../../config/database';
import { newsEventEmitter } from '../news/news.service';
import { TfidfLrService, TfidfLrClassifier } from './tfidf-lr.service';

type ClassifierType = 'naive-bayes' | 'logistic-regression';
type PreprocessingMode = 'unigram' | 'unigram-bigram' | 'unigram-bigram-filtered';

interface TrainOptions {
    persist?: boolean;
}

interface LoadAndTrainOptions extends TrainOptions {
    upsampleMultiplier?: number;
    diskSupplementLimit?: number;
    maxDbSamples?: number;
    manualUpsampleMultiplier?: number;
    manualOnlyVerified?: boolean;
}

interface HardNegativeBatchSummary {
    genelToSiyaset: number;
    siyasetToGenel: number;
    siyasetToTeknoloji: number;
    siyasetToDunya: number;
    siyasetToEkonomi: number;
    totalInjected: number;
}

interface TrainDiagnostics {
    accuracy: number;
    macroF1: number;
    trainSize: number;
    testSize: number;
    categories: string[];
    metrics: Record<string, {
        precision: number;
        recall: number;
        f1: number;
        support: number;
    }>;
    confusionMatrix: any;
}

export class MlCategorizationService implements INewsCategorizationService {
    public classifier: any = null;
    public classifierType: ClassifierType = 'naive-bayes';
    public preprocessingMode: PreprocessingMode = 'unigram';
    public isTrained: boolean = false;
    public newsSinceLastTrain: number = 0;
    public lastAccuracy: number = 0;
    public trainSize: number = 0;
    public testSize: number = 0;
    public lastConfusionMatrix: any = null;
    public lastDiagnostics: TrainDiagnostics | null = null;
    private readonly BATCH_TRAIN_THRESHOLD = 20;
    private readonly MIN_TEST_SUPPORT = 10;     // stratified split: minimum test examples per category
    private readonly MIN_TRAIN_RATIO = 0.60;    // stratified split: train set floor (60% of category total)

    // Task 2.3-2.4: Combined NB+LR soft voting
    private tfidfService: TfidfLrService | null = null;
    private lrClassifier: TfidfLrClassifier | null = null;
    public useCombinedModel: boolean = false;
    private readonly NB_WEIGHT = 0.30;
    private readonly LR_WEIGHT = 0.70;

    private resolveClassifierType(classifierType?: ClassifierType): ClassifierType {
        if (classifierType === 'naive-bayes' || classifierType === 'logistic-regression') {
            return classifierType;
        }

        const envModel = process.env.ML_MODEL_TYPE;
        if (envModel === 'naive-bayes' || envModel === 'logistic-regression') {
            return envModel;
        }

        if (envModel) {
            console.warn(`[ML Warn] Invalid ML_MODEL_TYPE="${envModel}", fallback to naive-bayes.`);
        }

        return 'naive-bayes';
    }

    constructor(classifierType?: ClassifierType, preprocessingMode: PreprocessingMode = 'unigram-bigram') {
        this.classifierType = this.resolveClassifierType(classifierType);
        this.preprocessingMode = preprocessingMode;
        this.initializeClassifier();

        // Faz 4: Oto-Öğrenim Pipeline Gözlemcisi (Observer)
        this.initializeTrainingPipeline();
    }

    private initializeClassifier(): void {
        if (this.classifierType === 'logistic-regression') {
            this.classifier = new (natural.LogisticRegressionClassifier as any)();
        } else {
            this.classifier = new natural.BayesClassifier();
        }
    }

    /**
     * Faz 3: N-gram preprocessing
     * Config A: Unigram only (baseline)
     * Config B: Unigram + Bigram (en etkili)
     * Config C: Unigram + Bigram + min 3 char filter
     */
    private preprocessText(text: string, type: 'unigram' | 'bigram' = 'unigram'): string[] {
        // Normalize ve tokenize
        const normalized = text.toLowerCase().normalize('NFC').trim();
        // Unicode-aware tokenization: Turkish diacritics and letters are preserved.
        const tokens = normalized.match(/[\p{L}\p{N}]+/gu) || [];
        
        if (type === 'unigram') {
            return tokens;
        }
        
        // Bigram: ardışık iki kelime
        const bigrams: string[] = [];
        for (let i = 0; i < tokens.length - 1; i++) {
            bigrams.push(`${tokens[i]}_${tokens[i + 1]}`);
        }
        return [...tokens, ...bigrams];
    }

    private shouldFilterToken(token: string, minLength: number = 3): boolean {
        return token.length < minLength;
    }

    private countKeywordHits(text: string, keywords: string[]): number {
        const normalized = text.toLowerCase();
        let hits = 0;
        for (const keyword of keywords) {
            if (normalized.includes(keyword)) hits++;
        }
        return hits;
    }

    private injectHardNegativeBatch(trainSet: TrainingData[]): HardNegativeBatchSummary {
        // Dominant pairs observed in diagnostics:
        // 1) Genel -> Siyaset, 2) Siyaset -> Genel, 3) Siyaset -> Teknoloji
        const siyasetSignals = [
            // Tekil — diacritic-free, düşük false-positive riski
            'meclis', 'milletvekili', 'iktidar', 'muhalefet',
            'cumhurbaşkan', 'hükümet', 'anayasa',
            // Mevcut çok-kelimeli sinyaller
            'hükümet kararı', 'seçim kampanyası', 'parti kongresi', 'siyasi kriz', 'kabine',
            'cumhurbaşkanlığı', 'bakanlık', 'muhtarlık seçimi',
            // Batch-15: toksik 6 tekil kelime → phrase seviyesine yükseltildi
            'oy oranı', 'oy pusulası', 'seçim sandığı', 'seçim bölgesi',     // oy →
            'bakanlığı', 'bakanlar kurulu',                                   // bakan →
            'yasa teklifi', 'yasa tasarısı', 'anayasa değişikliği', 'kanun teklifi', // yasa →
            'belediye başkanı', 'belediye meclisi', 'büyükşehir belediyesi',  // belediye →
            'anayasa mahkemesi', 'yargıtay', 'danıştay', 'idari mahkeme',     // mahkeme →
            'yargı paketi', 'siyasi soruşturma'                               // tutuk →
        ];
        const genelSignals = [
            'vatandas basvurusu', 'sosyal yardim', 'belediye hizmeti',
            'kamu duyurusu', 'resmi aciklama', 'kurum haberi'
        ];
        const teknolojiSignals = [
            'yapay zeka', 'akilli', 'telefon', 'uygulama', 'yazilim', 'donanim', 'chip',
            'kamera', 'batarya', 'platform', 'sosyal medya', 'instagram', 'xiaomi', 'iphone', 'android'
        ];
        const dunyaSignals = [
            'yabancı', 'uluslararası', 'dışişleri', 'konsolos', 'büyükelçi',
            'nato', 'bm ', 'ab ', 'avrupa birliği', 'birleşmiş milletler',
            'savaş', 'çatışma', 'mülteci', 'sınır operasyon', 'kuzey kore',
            'rusya', 'çin', 'abd ', 'iran', 'ukrayna', 'suriye', 'filistin', 'gazze'
        ];
        const ekonomiSignals = [
            'borsa', 'enflasyon', 'faiz', 'merkez bankası', 'döviz', 'ihracat',
            'ithalat', 'gdp', 'büyüme oranı', 'işsizlik', 'vergi', 'bütçe', 'gelir vergisi'
        ];

        const genelPool = trainSet.filter(item => {
            if (item.category !== 'Genel') return false;
            const siyasetHit = this.countKeywordHits(item.text, siyasetSignals);
            const genelHit = this.countKeywordHits(item.text, genelSignals);
            return siyasetHit >= 1 && genelHit === 0; // Batch-15: >=2 → >=1 (phrase signals are already precise)
        });

        const siyasetPool = trainSet.filter(item => {
            if (item.category !== 'Siyaset') return false;
            const siyasetHit = this.countKeywordHits(item.text, siyasetSignals);
            return siyasetHit >= 2;
        });

        const siyasetTechPool = trainSet.filter(item => {
            if (item.category !== 'Siyaset') return false;
            const siyasetHit = this.countKeywordHits(item.text, siyasetSignals);
            const teknolojiHit = this.countKeywordHits(item.text, teknolojiSignals);
            return siyasetHit >= 1 && teknolojiHit >= 1;
        });

        const dunyaSiyasetPool = trainSet.filter(item => {
            if (item.category !== 'Dünya') return false;
            const siyasetHit = this.countKeywordHits(item.text, siyasetSignals);
            const dunyaHit = this.countKeywordHits(item.text, dunyaSignals);
            return siyasetHit >= 1 && dunyaHit >= 1;
        });

        const siyasetDunyaPool = trainSet.filter(item => {
            if (item.category !== 'Siyaset') return false;
            const dunyaHit = this.countKeywordHits(item.text, dunyaSignals);
            const siyasetHit = this.countKeywordHits(item.text, siyasetSignals);
            return dunyaHit >= 1 && siyasetHit >= 1;
        });

        const ekonomiTechPool = trainSet.filter(item => {
            if (item.category !== 'Ekonomi') return false;
            const teknoHit = this.countKeywordHits(item.text, teknolojiSignals);
            const ekoHit = this.countKeywordHits(item.text, ekonomiSignals);
            return teknoHit >= 1 && ekoHit >= 1;
        });



        const injectFromPool = (pool: TrainingData[], target: number): number => {
            if (pool.length === 0 || target <= 0) return 0;
            // Limit duplicate amplification on tiny pools to reduce overfitting risk.
            const cappedTarget = Math.min(target, pool.length * 2);
            let injected = 0;
            for (let i = 0; i < cappedTarget; i++) {
                const src = pool[i % pool.length];
                trainSet.push({ ...src });
                injected++;
            }
            return injected;
        };

        const genelToSiyaset = injectFromPool(genelPool, 8); // Batch-15: 14→8 (smaller pool, reduce overfit risk)
        const siyasetToGenel = injectFromPool(siyasetPool, 10);
        const siyasetToTeknoloji = injectFromPool(siyasetTechPool, 8);
        const dunyaToSiyaset = injectFromPool(dunyaSiyasetPool, 10);
        const siyasetToDunya = injectFromPool(siyasetDunyaPool, 10);
        const ekonomiToTeknoloji = injectFromPool(ekonomiTechPool, 8);
        const siyasetToEkonomi = 0;

        return {
            genelToSiyaset,
            siyasetToGenel,
            siyasetToTeknoloji,
            siyasetToDunya: siyasetToDunya + dunyaToSiyaset,
            siyasetToEkonomi,
            totalInjected:
                genelToSiyaset +
                siyasetToGenel +
                siyasetToTeknoloji +
                dunyaToSiyaset +
                siyasetToDunya +
                ekonomiToTeknoloji
        };
    }

    private preprocess(text: string, mode: PreprocessingMode): string[] {
        let tokens = this.preprocessText(text, 'unigram');
        
        if (mode === 'unigram-bigram' || mode === 'unigram-bigram-filtered') {
            const bigrams = this.preprocessText(text, 'bigram');
            tokens = bigrams; // Bigram + unigram already merged
        }
        
        if (mode === 'unigram-bigram-filtered') {
            tokens = tokens.filter(t => !this.shouldFilterToken(t, 3));
        }
        
        return tokens;
    }

    private initializeTrainingPipeline(): void {
        newsEventEmitter.on('new-news', (news: any) => {
            // Sadece yayına hazır ve yeterli güvenli haberlerle yeniden eğitimi tetikle
            if ((news.durum === 'hazir' || news.durum === 'yayinda') && news.kategoriDogrulandi === true) {
                this.newsSinceLastTrain++;
                console.log(`[ML Pipeline] Yeni temiz veri yakalandı! Sıradaki eğitim için: ${this.newsSinceLastTrain}/${this.BATCH_TRAIN_THRESHOLD}`);

                // Yeterli yeni veri biriktiyse, Node event loop'u bloklamadan (setImmediate) yeniden eğitim başlat
                if (this.newsSinceLastTrain >= this.BATCH_TRAIN_THRESHOLD) {
                    this.newsSinceLastTrain = 0;
                    setImmediate(async () => {
                        console.log('[ML Pipeline] Toplu eğitim tetiklendi...');
                        await this.loadAndTrainFromDB();
                    });
                }
            }
        });
    }

    async saveModelToDb(accuracy: number, sampleCount: number): Promise<void> {
        const serializedClassifier = JSON.stringify(this.classifier);
        const modelData = JSON.parse(serializedClassifier) as Prisma.InputJsonValue;
        const modelStateRepo = (prisma as any).modelState;

        if (!modelStateRepo) {
            console.warn('[ML Warn] Prisma client modelState erişimi yok, model DB kaydı atlandı.');
            return;
        }

        // Guard 1: Accuracy drop rollback - 5pp threshold
        try {
            const currentState = await modelStateRepo.findUnique({ where: { id: 1 } });
            if (currentState && currentState.accuracy) {
                const curr = typeof currentState.accuracy === 'number' ? currentState.accuracy : parseFloat(currentState.accuracy as unknown as string);
                const drop = curr - accuracy;
                if (drop > 0.05) {
                    console.error(`[ML Guard1] Accuracy drop: ${(curr*100).toFixed(2)}% to ${(accuracy*100).toFixed(2)}% (-${(drop*100).toFixed(2)}pp). NOT saved.`);
                    return;
                }
            }
        } catch (e) {
            console.warn('[ML Guard1] Could not check accuracy, proceeding:', e);
        }

        // Prepare LR state if combined model is active
        // LR Serialization OUTSIDE transaction to avoid timeout
        let lrModelData: Prisma.InputJsonValue | null = null;
        if (this.useCombinedModel) {
            if (!this.tfidfService || !this.lrClassifier) {
                throw new Error('useCombinedModel=true but LR artifacts are missing. Refusing to save inconsistent state.');
            }
            try {
                lrModelData = {
                    vectorizer: this.tfidfService.serialize(),
                    classifier: this.lrClassifier.serialize(),
                } as Prisma.InputJsonValue;
            } catch (e) {
                throw new Error(`[ML] LR serialization failed; aborting save. ${(e as Error)?.message ?? e}`);
            }
        }

        const savePayload = {
            where: { id: 1 },
            update: {
                modelData,
                lrModelData,
                accuracy,
                sampleCount,
                trainedAt: new Date(),
                version: { increment: 1 }
            },
            create: {
                id: 1,
                modelData,
                lrModelData,
                accuracy,
                sampleCount
            }
        };

        // Atomic save first; if interactive tx expires, fallback to direct upsert.
        try {
            await (prisma as any).$transaction(
                async (tx: any) => {
                    await tx.modelState.upsert(savePayload);
                },
                { maxWait: 30000, timeout: 30000 }
            );
        } catch (e: any) {
            const msg = String(e?.message || '');
            if (e?.code === 'P2028' || msg.includes('Transaction already closed')) {
                console.warn('[ML Warn] Interactive tx timeout; retrying with direct upsert.');
                await modelStateRepo.upsert(savePayload);
            } else {
                throw e;
            }
        }

        console.log(`[ML] Model DB'ye kaydedildi. Accuracy=%${(accuracy * 100).toFixed(1)} Sample=${sampleCount} combined=${this.useCombinedModel}`);
    }

    async loadModelFromDb(): Promise<boolean> {
        try {
            const modelStateRepo = (prisma as any).modelState;
            if (!modelStateRepo) {
                return false;
            }

            const savedModel = await modelStateRepo.findUnique({ where: { id: 1 } });
            if (!savedModel) {
                return false;
            }

            const serialized = typeof savedModel.modelData === 'string'
                ? savedModel.modelData
                : JSON.stringify(savedModel.modelData);

            // BayesClassifier.restore() does not correctly reconstruct the inner
            // classFeatures index, leading to degraded predictions (all → Siyaset).
            // Fix: recreate the classifier from stored docs using fresh addDocument+train.
            // PorterStemmer is idempotent so double-stemming stored tokens gives same result.
            const modelData = JSON.parse(serialized);
            const freshClassifier = new natural.BayesClassifier();
            for (const doc of (modelData.docs || [])) {
                if (doc.text && doc.label) {
                    freshClassifier.addDocument(
                        Array.isArray(doc.text) ? doc.text.join(' ') : String(doc.text),
                        doc.label
                    );
                }
            }
            freshClassifier.train();
            this.classifier = freshClassifier;
            console.log(`[ML] NB classifier rebuilt from ${modelData.docs?.length ?? 0} stored docs`);
            this.isTrained = true;
            this.lastAccuracy = savedModel.accuracy ?? this.lastAccuracy;
            this.trainSize = savedModel.sampleCount;
            this.testSize = 0;

            // Load LR model if available (NB-only fallback if absent)
            if (savedModel.lrModelData) {
                try {
                    const lrState = typeof savedModel.lrModelData === 'string'
                        ? JSON.parse(savedModel.lrModelData)
                        : savedModel.lrModelData;
                    this.tfidfService = new TfidfLrService();
                    this.tfidfService.deserialize(lrState.vectorizer);
                    this.lrClassifier = new TfidfLrClassifier();
                    await this.lrClassifier.deserialize(lrState.classifier);
                    this.useCombinedModel = true;
                    console.log('[ML] Combined NB+LR model loaded from DB');
                } catch (lrErr) {
                    console.warn('[ML Warn] LR model load failed — falling back to NB-only mode:', lrErr);
                    this.useCombinedModel = false;
                }
            } else {
                this.useCombinedModel = false;
                console.warn('[ML] LR model data missing in DB — NB-only mode active');
            }

            console.log(`[ML] Model DB'den yüklendi. Accuracy=%${(this.lastAccuracy * 100).toFixed(1)} Sample=${this.trainSize}`);
            return true;
        } catch (error) {
            console.warn('[ML Warn] Model DB\'den yüklenemedi, yeniden eğitim yapılacak.', error);
            return false;
        }
    }

    /**
     * Model status bilgilerini döndür (Public endpoint için)
     */
    async getModelStatus() {
        let trainedAt: Date | null = null;
        try {
            const modelStateRepo = (prisma as any).modelState;
            if (modelStateRepo) {
                const state = await modelStateRepo.findUnique({ where: { id: 1 } });
                trainedAt = state?.trainedAt || null;
            }
        } catch (error) {
            console.warn('[ML Warn] Model status DB query başarısız:', error);
        }

        return {
            status: this.isTrained ? 'ready' : 'not_trained',
            accuracy: this.lastAccuracy,
            sample_count: this.trainSize,
            trained_at: trainedAt?.toISOString() || null,
            model_type: this.classifierType,
            preprocessing_mode: this.preprocessingMode
        };
    }

    /**
     * Per-category metrics hesapla (Precision, Recall, F1) — Faz 4b.4
     */
    private calculateMetrics(predictions: Array<{ actual: string; predicted: string }>, categories: string[]) {
        const metrics: Record<string, any> = {};

        categories.forEach(cat => {
            const tp = predictions.filter(p => p.actual === cat && p.predicted === cat).length;
            const fp = predictions.filter(p => p.actual !== cat && p.predicted === cat).length;
            const fn = predictions.filter(p => p.actual === cat && p.predicted !== cat).length;

            const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
            const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
            const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

            metrics[cat] = {
                precision: parseFloat(precision.toFixed(3)),
                recall: parseFloat(recall.toFixed(3)),
                f1: parseFloat(f1.toFixed(3)),
                support: tp + fn
            };
        });

        const accuracy = predictions.filter(p => p.actual === p.predicted).length / predictions.length;
        return { accuracy, metrics };
    }

    /**
     * 4b.6: Confusion matrix oluştur ve sakla
     * Returns structured confusion matrix for visualization
     */
    private buildConfusionMatrix(predictions: Array<{ actual: string; predicted: string }>, categories: string[]) {
        const matrix = categories.map(actual => 
            categories.map(predicted => 
                predictions.filter(p => p.actual === actual && p.predicted === predicted).length
            )
        );

        return {
            schema: 'rows=actual, cols=predicted',
            categories,
            matrix,
            total: predictions.length,
            accuracy: predictions.filter(p => p.actual === p.predicted).length / predictions.length,
            generated_at: new Date().toISOString()
        };
    }

    private calculateMacroF1(metrics: Record<string, { f1: number }>): number {
        const f1Values = Object.values(metrics).map(m => m.f1);
        if (f1Values.length === 0) return 0;
        const sum = f1Values.reduce((acc, cur) => acc + cur, 0);
        return parseFloat((sum / f1Values.length).toFixed(3));
    }

    private logDiagnostics(diag: TrainDiagnostics): void {
        console.log(`[ML][Diagnostics] Accuracy=%${(diag.accuracy * 100).toFixed(2)} Macro-F1=${diag.macroF1} Train=${diag.trainSize} Test=${diag.testSize}`);
        diag.categories.forEach(cat => {
            const m = diag.metrics[cat];
            if (!m) return;
            console.log(`[ML][Diagnostics][${cat}] P=${m.precision} R=${m.recall} F1=${m.f1} Support=${m.support}`);
        });

        console.log(`[ML][Diagnostics][ConfusionMatrix] rows=actual cols=predicted total=${diag.confusionMatrix.total}`);
        console.log(`[ML][Diagnostics][Categories] ${diag.confusionMatrix.categories.join(', ')}`);

        const categories = diag.confusionMatrix.categories as string[];
        const matrix = diag.confusionMatrix.matrix as number[][];
        const offDiagonal: Array<{ actual: string; predicted: string; count: number }> = [];

        for (let i = 0; i < categories.length; i++) {
            for (let j = 0; j < categories.length; j++) {
                if (i === j) continue;
                const count = matrix?.[i]?.[j] || 0;
                if (count > 0) {
                    offDiagonal.push({
                        actual: categories[i],
                        predicted: categories[j],
                        count
                    });
                }
            }
        }

        offDiagonal
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
            .forEach((pair, idx) => {
                console.log(`[ML][Diagnostics][TopPair ${idx + 1}] ${pair.actual} -> ${pair.predicted}: ${pair.count}`);
            });

        const siyasetIndex = categories.indexOf('Siyaset');
        if (siyasetIndex !== -1) {
            const siyasetRow = categories
                .map((cat, idx) => ({ predicted: cat, count: matrix?.[siyasetIndex]?.[idx] || 0 }))
                .filter(item => item.predicted !== 'Siyaset' && item.count > 0)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            siyasetRow.forEach((item, idx) => {
                console.log(`[ML][Diagnostics][Siyaset->* ${idx + 1}] Siyaset -> ${item.predicted}: ${item.count}`);
            });
        }

        const genelIndex = categories.indexOf('Genel');
        if (genelIndex !== -1 && siyasetIndex !== -1) {
            const genelToSiyaset = matrix?.[genelIndex]?.[siyasetIndex] || 0;
            console.log(`[ML][Diagnostics][Pair] Genel -> Siyaset: ${genelToSiyaset}`);
        }

        const dunyaIndex = categories.indexOf('Dünya');
        if (siyasetIndex !== -1 && dunyaIndex !== -1) {
            const siyasetToDunya = matrix?.[siyasetIndex]?.[dunyaIndex] || 0;
            console.log(`[ML][Diagnostics][Pair] Siyaset -> Dünya: ${siyasetToDunya}`);
        }

        // Siyaset-specific leakage analysis
        if (siyasetIndex !== -1) {
            // SiyasetLeakage: actual=Siyaset, predicted=non-Siyaset (false negatives for Siyaset)
            const siyasetLeakage = categories.reduce((sum, cat, idx) => {
                if (cat !== 'Siyaset') sum += (matrix?.[siyasetIndex]?.[idx] || 0);
                return sum;
            }, 0);

            // TowardsSiyaset: actual=non-Siyaset, predicted=Siyaset (false positives for Siyaset)
            const towardsSiyaset = categories.reduce((sum, cat, idx) => {
                if (cat !== 'Siyaset') sum += (matrix?.[idx]?.[siyasetIndex] || 0);
                return sum;
            }, 0);

            const netConfusion = towardsSiyaset - siyasetLeakage;

            console.log(`[SiyasetLeakage] Siyaset->non-Siyaset=${siyasetLeakage} (false negatives)`);
            console.log(`[TowardsSiyaset] non-Siyaset->Siyaset=${towardsSiyaset} (false positives)`);
            console.log(`[NetConfusion] net=${netConfusion} (positive=over-predict, negative=under-predict Siyaset)`);

            // Per-category breakdown
            categories.forEach((cat, idx) => {
                if (cat === 'Siyaset') return;
                const leak = matrix?.[siyasetIndex]?.[idx] || 0;
                const inflow = matrix?.[idx]?.[siyasetIndex] || 0;
                if (leak > 0 || inflow > 0) {
                    console.log(`[SiyasetLeakage][${cat}] Siyaset->${cat}=${leak} ${cat}->Siyaset=${inflow}`);
                }
            });
        }
    }
    calculateRocAuc(predictions: Array<{ actual: string; scores: Record<string, number> }>, categories: string[]): { 
        per_category: Record<string, number>; 
        macro_auc: number;
        pr_auc: Record<string, number>;
    } {
        const rocAucByCategory: Record<string, number> = {};
        const prAucByCategory: Record<string, number> = {};

        categories.forEach(positiveClass => {
            const scores = predictions.map(p => ({
                score: p.scores[positiveClass] || 0,
                isPositive: p.actual === positiveClass
            }));

            // Sort by score descending
            scores.sort((a, b) => b.score - a.score);

            const posCount = scores.filter(s => s.isPositive).length;
            const negCount = scores.length - posCount;

            if (posCount === 0 || negCount === 0) {
                rocAucByCategory[positiveClass] = 0.5;
                prAucByCategory[positiveClass] = 0.5;
                return;
            }

            // Calculate ROC-AUC using trapezoid rule
            let tp = 0, fp = 0;
            let aucSum = 0, prevFpr = 0, prevTpr = 0;
            let prSum = 0, prevRecall = 0, prevPrecision = 1.0;

            for (const s of scores) {
                if (s.isPositive) tp++;
                else fp++;

                const tpr = tp / posCount;
                const fpr = fp / negCount;
                const precision = tp / (tp + fp);
                const recall = tpr;

                // Trapezoid rule for ROC-AUC
                aucSum += (fpr - prevFpr) * (tpr + prevTpr) / 2;
                prevFpr = fpr;
                prevTpr = tpr;

                // Trapezoid rule for PR-AUC
                prSum += (recall - prevRecall) * (precision + prevPrecision) / 2;
                prevRecall = recall;
                prevPrecision = precision;
            }

            rocAucByCategory[positiveClass] = parseFloat(Math.max(0, Math.min(1, aucSum)).toFixed(3));
            prAucByCategory[positiveClass] = parseFloat(Math.max(0, Math.min(1, prSum)).toFixed(3));
        });

        const macroAuc = Object.values(rocAucByCategory).reduce((a, b) => a + b, 0) / categories.length;

        return {
            per_category: rocAucByCategory,
            macro_auc: parseFloat(macroAuc.toFixed(3)),
            pr_auc: prAucByCategory
        };
    }

    /**
     * Modeli belirtilen JSON/DB veri seti ile eğitir ve %80/%20 Test/Train ayırır.
     */
    async train(dataset: TrainingData[]): Promise<boolean> {
        console.log(`[ML] Model eğitimi başlıyor... (${dataset.length} örnek)`);
        
        if (dataset.length < 30) {
            console.warn(`[ML Warn] Yeterli veri yok (${dataset.length} < 30), eğitim atlanıyor.`);
            return false;
        }

        // Guard 3: Min 15 examples per category (increased from 3)
        const categoryCounts: Record<string, number> = {};
        dataset.forEach(d => { categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1; });
        const validDataset = dataset.filter(d => categoryCounts[d.category] >= 15);
        const skippedCategories = Object.entries(categoryCounts).filter(([, count]) => count < 15).map(([cat]) => cat);
        if (skippedCategories.length > 0) {
            console.warn(`[ML Guard3] Skipped categories with <15 examples: ${skippedCategories.join(', ')}`);
        }
        if (validDataset.length < 30) {
            console.error(`[ML Guard3] Post-filter dataset too small: ${validDataset.length} samples. Training aborted.`);
            return false;
        }

        // Shuffle dataset
        const shuffled = [...validDataset].sort(() => 0.5 - Math.random());
        
        // 80/20 split
        const splitIndex = Math.floor(shuffled.length * 0.8);
        const trainSet = shuffled.slice(0, splitIndex);
        const testSet = shuffled.slice(splitIndex);

        const ok = await this.trainWithSplit(trainSet, testSet);
        if (!ok) return false;

        return true;
    }

    /**
     * Hazır train/test setleriyle eğitim yapar (data leakage olmadan önceden bölünmüş veri için)
     * Returns false if Guard4 rejects model, true otherwise
     */
    private async trainWithSplit(trainSet: TrainingData[], testSet: TrainingData[], options: TrainOptions = {}): Promise<boolean> {
        
        this.trainSize = trainSet.length;
        this.testSize = testSet.length;

        // Eski eğitimi temizle
        this.initializeClassifier();

        trainSet.forEach((data) => {
            if (data.text && data.category) {
                const tokens = this.preprocess(data.text, this.preprocessingMode);
                const processedText = tokens.join(' ');
                this.classifier.addDocument(processedText, data.category);
            }
        });

        console.log(`[ML][Step] addDocument bitti (${trainSet.length} örnek), classifier.train() başlıyor...`);
        this.classifier.train();
        console.log(`[ML][Step] classifier.train() bitti, test değerlendirmesi başlıyor...`);
        this.isTrained = true;
        
        // Test Set ile doğruluğu ve diagnostics metriklerini hesapla
        let correctGuesses = 0;
        let predictions: Array<{ actual: string; predicted: string; scores?: Record<string, number>; confidence?: number }> = [];
        const categories = Array.from(new Set([...trainSet, ...testSet].map(item => item.category))).sort((a, b) => a.localeCompare(b, 'tr'));

        if (this.testSize > 0) {
            testSet.forEach(item => {
                try {
                    const tokens = this.preprocess(item.text, this.preprocessingMode);
                    const processedText = tokens.join(' ');
                    const guess = this.classifier.classify(processedText);
                    
                    // Güven skorlarını al
                    const classifications: Array<{ label: string; value: number }> = this.classifier.getClassifications(processedText) || [];
                    const scores: Record<string, number> = {};
                    let maxConfidence = 0;
                    
                    if (classifications.length > 0) {
                        const rawTotal = classifications.reduce((sum: number, c: any) => sum + c.value, 0);
                        classifications.forEach((c: any) => {
                            scores[c.label] = rawTotal > 0 ? c.value / rawTotal : 1 / classifications.length;
                            if (scores[c.label] > maxConfidence) {
                                maxConfidence = scores[c.label];
                            }
                        });
                    }
                    
                    predictions.push({ actual: item.category, predicted: guess, scores, confidence: maxConfidence });
                    if (guess === item.category) {
                        correctGuesses++;
                    }
                } catch(e) {
                    predictions.push({ actual: item.category, predicted: 'unknown' });
                }
            });
            this.lastAccuracy = correctGuesses / this.testSize;
        } else {
            this.lastAccuracy = 0;
        }

        if (predictions.length > 0 && categories.length > 0) {
            const { metrics } = this.calculateMetrics(predictions, categories);
            const macroF1 = this.calculateMacroF1(metrics);
            const confusionMatrix = this.buildConfusionMatrix(predictions, categories);

            this.lastConfusionMatrix = confusionMatrix;
            this.lastDiagnostics = {
                accuracy: this.lastAccuracy,
                macroF1,
                trainSize: this.trainSize,
                testSize: this.testSize,
                categories,
                metrics,
                confusionMatrix
            };

            this.logDiagnostics(this.lastDiagnostics);
        } else {
            this.lastConfusionMatrix = null;
            this.lastDiagnostics = null;
        }

        console.log(`[ML] ${this.classifierType.toUpperCase()} (${this.preprocessingMode}) başarıyla eğitildi. (Train: ${this.trainSize}, Test: ${this.testSize}, Accuracy: %${(this.lastAccuracy*100).toFixed(2)})`);
        console.log(`[ML][Step] Test değerlendirmesi bitti, post-train kontrolleri tamamlanıyor...`);
        
        // Guard 4: Kalibrasyon Testi (Confidence-based predictions validation)
        // Tahminleri güven skorlarına göre filtrele ve bunların doğruluğunu kontrol et
        const highConfidencePredictions = predictions.filter(p => p.confidence !== undefined && p.confidence >= 0.70);
        if (highConfidencePredictions.length > 0) {
            const calibratedCorrect = highConfidencePredictions.filter(p => p.actual === p.predicted).length;
            const calibrationAccuracy = calibratedCorrect / highConfidencePredictions.length;
            
            console.log(`[ML Guard4] Kalibrasyon Testi: ${highConfidencePredictions.length} tahminler (Confidence >= 0.70) içinden %${(calibrationAccuracy*100).toFixed(2)} doğru.`);
            
            if (calibrationAccuracy < 0.70) {
                console.error(`[ML Guard4] KALIBRE BAŞARISIZ: Güven skorları güvenilmez (calibration accuracy %${(calibrationAccuracy*100).toFixed(2)} < 70%).`);
                this.isTrained = true;
                return false; // Guard rejected model
            } else {
                console.log(`[ML Guard4] ✓ Kalibrasyon BAŞARILI: Güven skorları güvenilir. Modeli kaydet.`);
            }
        } else {
            console.warn(`[ML Guard4] Uyarı: Yeterli yüksek-güven tahmini yok (>= 0.70). Kalibrasyon testi atlanıyor.`);
        }
        console.log(`[ML][Step] In-memory NB eğitim adımı tamamlandı.`);
        return true; // Successfully trained in-memory; persistence handled by caller
    }

    /**
     * Faz 4 İyileştirmesi: Diskteki hantal JSON yerine,
     * veritabanındaki "gerçek" onaylanmış (hazir/yayinda) haberlerden dinamik eğitim
     */
    async loadAndTrainFromDB(options: LoadAndTrainOptions = {}): Promise<boolean> {
        try {
            const upsampleMultiplier = Math.max(1, options.upsampleMultiplier ?? 3);
            const manualUpsampleMultiplier = Math.max(upsampleMultiplier, options.manualUpsampleMultiplier ?? 5);
            const diskSupplementLimit = Math.max(0, options.diskSupplementLimit ?? 0); // 0 = native-only, no disk supplement
            const maxDbSamples = Math.max(0, options.maxDbSamples ?? 0);
            const manualOnlyVerified = options.manualOnlyVerified === true;
            
            // HIGH RISK: Categories with low avg confidence — cleared after full consensus backfill (2346/2347 verified, Spor has 226 verified)
            const HIGH_RISK_CATEGORIES = new Set<string>([]); // Spor removed: sufficient verified articles now
            
            // Öncelik: güçlü güvene sahip onaylı haberlerden eğitim havuzu oluştur.
            const trustedNewsRaw = await prisma.haber.findMany({
                where: {
                    durum: { in: ['hazir', 'yayinda'] },
                    kategoriDogrulandi: true
                } as any,
                orderBy: { yayinlanmaTarihi: 'asc' },
                include: {
                    kategori: true
                }
            });

            const fallbackNewsRaw = trustedNewsRaw.length >= 300
                ? trustedNewsRaw
                : await prisma.haber.findMany({
                    where: {
                        durum: { in: ['hazir', 'yayinda'] },
                        llmProvider: { not: 'none' }
                    } as any,
                    orderBy: { yayinlanmaTarihi: 'asc' },
                    include: {
                        kategori: true
                    }
                });

            const manuelValidasyonRepo = (prisma as any).manuelValidasyon;
            const manuallyValidatedRows = manuelValidasyonRepo
                ? await manuelValidasyonRepo.findMany({ select: { haberId: true } })
                : [];
            const manuallyValidatedIds = new Set<number>(manuallyValidatedRows.map((r: any) => r.haberId));

            const sourceNews = manualOnlyVerified
                ? fallbackNewsRaw.filter((n: any) => manuallyValidatedIds.has(n.id))
                : fallbackNewsRaw;

            if (manualOnlyVerified) {
                console.log(`[ML] Manual-only benchmark aktif: manuel_validasyonlar eşleşen kayıtlar kullanılacak (count=${sourceNews.length})`);
            }

            const approvedNews = maxDbSamples > 0
                ? sourceNews.slice(0, maxDbSamples)
                : sourceNews;

            if (approvedNews.length === 0) {
                console.warn('[ML Warn] Veritabanında eğitilecek onaylı haber (hazir/yayinda) bulunamadı. JSON yedeğe dönülüyor...');
                return await this.loadAndTrainFromDiskFallback();
            }
            
            // Guard 2b: If DB data too low quality, fallback to dataset.json pure
            if (!manualOnlyVerified && approvedNews.length < 200 && diskSupplementLimit === 0) {
                console.warn(`[ML Guard2b] DB records (${approvedNews.length}) < 200 with no disk supplement. Fallback to dataset.json only.`);
                return await this.loadAndTrainFromDiskFallback();
            }

            const parseBackfillStartTime = (): Date | null => {
                const raw = process.env.ML_BACKFILL_START_AT;
                if (!raw) return null;
                const parsed = new Date(raw);
                if (Number.isNaN(parsed.getTime())) {
                    console.warn(`[ML Warn] ML_BACKFILL_START_AT parse edilemedi: ${raw}`);
                    return null;
                }
                return parsed;
            };

            const backfillStartTime = parseBackfillStartTime();

            // Başlık + metaAciklama + icerik ilk 300 karakter — zenginleştirilmiş LLM içeriği signal kalitesini artırır
            let rawDataset: Array<TrainingData & { id: number; publishedAt: Date; augmentedAt?: Date | null; source: 'db' | 'disk'; isManualValidated: boolean }> = approvedNews
                .filter(news => {
                    if (manualOnlyVerified) {
                        // Manual doğrulama benchmark'ında confidence/high-risk filtreleri uygulanmaz.
                        return true;
                    }
                    // Always exclude HIGH_RISK categories (currently empty after full backfill)
                    if (HIGH_RISK_CATEGORIES.has(news.kategori.ad)) return false;
                    // kategoriDogrulandi=true olan haberler consensus veya manuel doğrulamayla onaylanmış
                    // mlConfidence filtresi uygulanmaz — doğrulanmış veri kalitesi garantilidir
                    return true;
                })
                .map(news => ({
                    id: news.id,
                    text: (news.baslik + ' ' + (news.metaAciklama || '') + ' ' + (news.icerik ? news.icerik.slice(0, 300) : '')).trim(),
                    category: news.kategori.ad,
                    publishedAt: news.yayinlanmaTarihi,
                    augmentedAt: (news as any).augmentedAt ?? null,
                    source: 'db' as const,
                    isManualValidated: manuallyValidatedIds.has(news.id)
                }));

            // Sadece zayıf kategorilere supplement:
            // - DB verified < 40
            // - Siyaset ve Ekonomi her durumda hariç
            const SUPPLEMENT_VERIFIED_THRESHOLD = 40;
            const SUPPLEMENT_EXCLUDED_CATEGORIES = new Set(['Siyaset', 'Ekonomi']);
            try {
                let datasetPath = '/training/naive-bayes/dataset.json';
                if (!fs.existsSync(datasetPath)) {
                    datasetPath = path.resolve(__dirname, '../../../../training/naive-bayes/dataset.json');
                }
                if (fs.existsSync(datasetPath)) {
                    const diskDataset: TrainingData[] = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
                    const verifiedByCategory: Record<string, number> = {};
                    approvedNews.forEach((n: any) => {
                        const cat = n?.kategori?.ad;
                        if (!cat) return;
                        verifiedByCategory[cat] = (verifiedByCategory[cat] || 0) + 1;
                    });

                    const supplementEligibleCategories = new Set(
                        Object.entries(verifiedByCategory)
                            .filter(([cat, count]) =>
                                count < SUPPLEMENT_VERIFIED_THRESHOLD &&
                                !SUPPLEMENT_EXCLUDED_CATEGORIES.has(cat)
                            )
                            .map(([cat]) => cat)
                    );

                    const selected = diskDataset
                        .filter(d => supplementEligibleCategories.has(d.category))
                        .slice(0, Math.min(diskSupplementLimit, diskDataset.length));

                    // Negatif ID'lerle ekle (DB ID'leriyle çakışmasın), disk örnekleri test setine alınmaz.
                    const diskWithIds = selected.map((d, i) => ({
                        ...d,
                        id: -(100000 + i + 1),
                        publishedAt: new Date(0),
                        augmentedAt: null,
                        source: 'disk' as const,
                        isManualValidated: false
                    }));
                    rawDataset = [...rawDataset, ...diskWithIds];
                    console.log(
                        `[ML] dataset.json takviye eklendi (${diskWithIds.length}) | ` +
                        `threshold<${SUPPLEMENT_VERIFIED_THRESHOLD} | ` +
                        `eligible=[${Array.from(supplementEligibleCategories).join(', ')}] | ` +
                        `excluded=[${Array.from(SUPPLEMENT_EXCLUDED_CATEGORIES).join(', ')}] | ` +
                        `toplam=${rawDataset.length}`
                    );
                }
            } catch (e) {
                console.warn('[ML Warn] dataset.json takviye okunamadı, sadece DB verisi kullanılıyor');
            }

            // Kategori bazlı temporal split: her kategoride en yeni %20 test, eski %80 train.
            const byCategory: Record<string, Array<TrainingData & { id: number }>> = {};
            rawDataset.forEach(d => {
                if (!byCategory[d.category]) byCategory[d.category] = [];
                byCategory[d.category].push(d);
            });

            // Guard 2: Category distribution checks (hard stop 50%, warning 2.5x)
            const verifiedCounts: Record<string, number> = {};
            rawDataset.forEach(d => { verifiedCounts[d.category] = (verifiedCounts[d.category] || 0) + 1; });
            const totalVer = Object.values(verifiedCounts).reduce((a, b) => a + b, 0);
            const dominant = Object.entries(verifiedCounts).find(([_, c]) => c / totalVer > 0.50);
            if (dominant) {
                console.error(`[ML Guard2 HARD STOP] Category '${dominant[0]}' > 50% (${((dominant[1]/totalVer)*100).toFixed(2)}%). Training halted.`);
                return false;
            }
            const ratioImb = Math.max(...Object.values(verifiedCounts)) / Math.min(...Object.values(verifiedCounts));
            if (ratioImb > 2.5) {
                console.warn(`[ML Guard2 WARNING] Imbalance ${ratioImb.toFixed(2)}x (max/min). Upsampling will mitigate.`);
            }

            const trainSet: TrainingData[] = [];
            const testSet: TrainingData[] = [];
            let leakageFilteredCount = 0;
            let manualWeightedCount = 0;
            let regularWeightedCount = 0;

            // Upsampling hedefi: her kategoride en büyük kategoriye kap (test seti kirletilmez)
            // Not: slice(0, target) ile büyük kategoriler de kırpılır (downsampling)
            const maxTrainCount = Math.max(
                ...Object.values(byCategory).map(arr => {
                    const onlyDb = (arr as any[]).filter((x: any) => x.source === 'db').length;
                    return Math.max(2, Math.floor(onlyDb * 0.8));
                })
            );

            for (const [catName, examples] of Object.entries(byCategory)) {
                if (examples.length < 3) continue; // Kategori guard

                const fromDisk = examples.filter((e: any) => e.source === 'disk');
                const fromDb = examples.filter((e: any) => e.source === 'db');

                const temporal = [...fromDb].sort((a: any, b: any) => {
                    return a.publishedAt.getTime() - b.publishedAt.getTime();
                });

                // Stratified-temporal split: enforce minimum test support per category.
                // Base: 80/20 split. If test support < MIN_TEST_SUPPORT, try to grow test
                // slice without dropping train below MIN_TRAIN_RATIO * total.
                const totalN = temporal.length;
                const baseTestN = totalN - Math.max(1, Math.floor(totalN * 0.8));
                const minAllowedTrainN = Math.ceil(totalN * this.MIN_TRAIN_RATIO);
                const maxAllowedTestN = totalN - minAllowedTrainN;

                let testN: number;
                let splitNote = '';
                if (baseTestN >= this.MIN_TEST_SUPPORT) {
                    testN = baseTestN;
                } else if (maxAllowedTestN >= this.MIN_TEST_SUPPORT) {
                    testN = this.MIN_TEST_SUPPORT;
                    splitNote = `expanded ${baseTestN}→${testN} to meet support target`;
                } else {
                    testN = Math.max(1, maxAllowedTestN);
                    splitNote = `FALLBACK: support=${testN}<${this.MIN_TEST_SUPPORT}, 60%-floor limits growth`;
                }

                const splitIndex = totalN - testN;
                const catTrainBase = temporal.slice(0, splitIndex);
                const catTestBase = temporal.slice(splitIndex);
                console.log(`[ML][StratifiedSplit][${catName}] total=${totalN} train=${splitIndex} test=${testN}${splitNote ? ` | ${splitNote}` : ''}`);


                const leakedFromTest = backfillStartTime
                    ? catTestBase.filter((e: any) => !!e.augmentedAt && e.augmentedAt >= backfillStartTime)
                    : [];
                leakageFilteredCount += leakedFromTest.length;

                const leakIds = new Set(leakedFromTest.map((e: any) => e.id));
                const catTest = catTestBase.filter((e: any) => !leakIds.has(e.id));
                const catTrain = [...catTrainBase, ...leakedFromTest, ...fromDisk];

                if (catTrain.length < 5) continue;

                // Manuel doğrulanan örnekleri daha yüksek ağırlıkla çoğalt (anchor etkisi)
                const weightedTrain: Array<TrainingData & { id: number; publishedAt: Date; augmentedAt?: Date | null; source: 'db' | 'disk'; isManualValidated: boolean }> = [];
                catTrain.forEach((sample: any) => {
                    const repeat = sample.isManualValidated ? manualUpsampleMultiplier : upsampleMultiplier;
                    if (sample.isManualValidated) {
                        manualWeightedCount += repeat;
                    } else {
                        regularWeightedCount += repeat;
                    }
                    for (let r = 0; r < repeat; r++) {
                        weightedTrain.push({ ...sample });
                    }
                });

                // Upsampling sadece train setine uygulanır (test kirletilmez)
                // target hem alt hem üst sınır: baskın kategori de kırpılır (slice ile)
                const target = Math.min(maxTrainCount, Math.ceil(catTrain.length * upsampleMultiplier));
                let i = 0;
                const upsampled = [...weightedTrain];
                upsampled.sort(() => Math.random() - 0.5);
                while (upsampled.length < target) {
                    upsampled.push({ ...weightedTrain[i % weightedTrain.length] });
                    i++;
                }
                trainSet.push(...upsampled.slice(0, target).map(({ id: _id, publishedAt: _publishedAt, augmentedAt: _augmentedAt, source: _source, ...rest }: any) => rest));
                testSet.push(...catTest.map(({ id: _id, publishedAt: _publishedAt, augmentedAt: _augmentedAt, source: _source, ...rest }: any) => rest));
            }

            console.log(`[ML] DB'den ${approvedNews.length} haber yüklendi → train: ${trainSet.length} (upsampled), test: ${testSet.length} (temiz)`);
            console.log(`[ML] Leakage guard: ${leakageFilteredCount} örnek test setinden filtrelendi`);
            console.log(`[ML] Upsample weights: manual=${manualUpsampleMultiplier}x normal=${upsampleMultiplier}x | weightedManual=${manualWeightedCount} weightedRegular=${regularWeightedCount}`);

            const hardNegativeSummary = this.injectHardNegativeBatch(trainSet);
            console.log(`[ML][HardNegative] Injected total=${hardNegativeSummary.totalInjected} | Genel->Siyaset=${hardNegativeSummary.genelToSiyaset}, Siyaset->Genel=${hardNegativeSummary.siyasetToGenel}, Siyaset->Teknoloji=${hardNegativeSummary.siyasetToTeknoloji}, Siyaset->Dunya=${hardNegativeSummary.siyasetToDunya}, Siyaset->Ekonomi=${hardNegativeSummary.siyasetToEkonomi}`);
            console.log(`[ML][HardNegative] Train size after injection: ${trainSet.length}`);

            // 1) NB train (in-memory)
            const trainSuccess = await this.trainWithSplit(trainSet, testSet, { persist: false });
            if (!trainSuccess) {
                return false;
            }

            // Reset combined state before LR phase to avoid stale in-memory references.
            this.tfidfService = null;
            this.lrClassifier = null;
            this.useCombinedModel = false;

            // 2) LR train (in-memory)
            try {
                const lrMaxFeatures = Number(process.env.ML_LR_MAX_FEATURES ?? 5000);
                const lrNumSteps = Number(process.env.ML_LR_NUM_STEPS ?? 300);
                const lrLearningRate = Number(process.env.ML_LR_LEARNING_RATE ?? 5e-3);

                console.log(
                    `[ML][LR] TF-IDF+LR eğitimi başlıyor... maxFeatures=${lrMaxFeatures} steps=${lrNumSteps} lr=${lrLearningRate}`
                );
                const lrTexts = trainSet.map((a: TrainingData) => a.text);
                const lrLabels = trainSet.map((a: TrainingData) => a.category);
                const tfidf = new TfidfLrService();
                tfidf.fitVectorizer(lrTexts, { maxFeatures: lrMaxFeatures, ngramRange: [1, 2] });
                const lr = new TfidfLrClassifier();
                await lr.fit(lrTexts, lrLabels, tfidf, { numSteps: lrNumSteps, learningRate: lrLearningRate });

                this.tfidfService = tfidf;
                this.lrClassifier = lr;

                // 3) set useCombinedModel=true only when both models are ready
                this.useCombinedModel = true;
                console.log(`[ML][LR] LR eğitimi tamamlandı. Vocab=${tfidf.vocabularySize} features`);
            } catch (lrErr) {
                console.error('[ML Error] LR eğitimi başarısız. Persist yapılmadan işlem sonlandırıldı:', lrErr);
                this.useCombinedModel = false;
                this.tfidfService = null;
                this.lrClassifier = null;
                return false;
            }

            // 4) saveModelToDb (both NB+LR ready)
            if (options.persist ?? true) {
                await this.saveModelToDb(this.lastAccuracy, this.trainSize);
                console.log('[ML][Step] Atomic NB+LR DB kayıt tamamlandı.');
            }

            return true;
        } catch (error) {
            console.error('[ML Error] DB üzerinden veri seti oluşturulurken hata:', error);
            return false;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Task 2.3: Soft Voting + Public Inference Methods
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get NB probability distribution for a text (all categories, normalized).
     * Uses getClassifications() which returns [{label, value}] sorted by probability.
     */
    private getNbProbabilities(text: string): number[] {
        const tokens = this.preprocess(text, this.preprocessingMode);
        const processed = tokens.join(' ');
        const classifications: Array<{ label: string; value: number }> =
            this.classifier.getClassifications(processed) || [];
        const total = classifications.reduce((s: number, c: any) => s + c.value, 0);
        // Return in sorted-label order for alignment with LR probs
        return this.indexCategory().map(cat => {
            const entry = classifications.find((c: any) => c.label === cat);
            const raw = entry ? entry.value : 0;
            return total > 0 ? raw / total : 1 / Math.max(1, classifications.length);
        });
    }

    /**
     * Get LR probability distribution. Falls back to NB if LR not loaded.
     */
    private async getLrProbabilities(text: string): Promise<number[]> {
        if (!this.lrClassifier || !this.tfidfService) {
            return this.getNbProbabilities(text);
        }
        const probs = await this.lrClassifier.predictProba(text, this.tfidfService);
        // LR probs are indexed by LR's own indexCategory; align to NB's category order
        const lrCats = this.lrClassifier.getIndexCategory();
        return this.indexCategory().map(cat => {
            const idx = lrCats.indexOf(cat);
            return idx >= 0 ? probs[idx] : 0;
        });
    }

    /**
     * Returns sorted list of all known category names (from trained NB classifier).
     */
    private indexCategory(): string[] {
        try {
            const classifications: Array<{ label: string }> =
                this.classifier.getClassifications('test') || [];
            return classifications.map((c: any) => c.label).sort();
        } catch {
            return [];
        }
    }

    /**
     * Soft vote combination: P_combined(k) = NB_W × P_NB(k) + LR_W × P_LR(k)
     */
    private softVoteCombine(nbProbs: number[], lrProbs: number[]): number[] {
        if (nbProbs.length !== lrProbs.length) return nbProbs;
        const combined = nbProbs.map((nb, i) => this.NB_WEIGHT * nb + this.LR_WEIGHT * lrProbs[i]);
        const sum = combined.reduce((a, b) => a + b, 0);
        return sum > 0 ? combined.map(p => p / sum) : combined;
    }

    /** NB-only category prediction (public, for evaluation scripts) */
    predictNbCategory(text: string): string {
        const tokens = this.preprocess(text, this.preprocessingMode);
        return this.classifier.classify(tokens.join(' '));
    }

    /** LR-only category prediction (falls back to NB if LR not loaded) */
    async predictLrCategory(text: string): Promise<string> {
        if (!this.lrClassifier || !this.tfidfService) return this.predictNbCategory(text);
        return this.lrClassifier.predict(text, this.tfidfService);
    }

    /** Combined soft-vote category prediction */
    async predictCombinedCategory(text: string): Promise<string> {
        if (!this.useCombinedModel) return this.predictNbCategory(text);
        const nbProbs = this.getNbProbabilities(text);
        const lrProbs = await this.getLrProbabilities(text);
        const combined = this.softVoteCombine(nbProbs, lrProbs);
        const cats = this.indexCategory();
        let maxIdx = 0;
        for (let i = 1; i < combined.length; i++) {
            if (combined[i] > combined[maxIdx]) maxIdx = i;
        }
        return cats[maxIdx] ?? 'Bilinmeyen';
    }

    /** Maps index → category name in LR model (required by CV script) */
    categoryByIndex(index: number): string {
        if (!this.lrClassifier) throw new Error('LR model not loaded');
        return this.lrClassifier.getIndexCategory()[index];
    }

    async benchmarkFromDb(upsampleMultiplier: number = 1, diskSupplementLimit: number = 0, maxDbSamples: number = 0): Promise<{ accuracy: number; trainSize: number; testSize: number; classifierType: string; preprocessingMode: string; }> {
        const ok = await this.loadAndTrainFromDB({ persist: false, upsampleMultiplier, diskSupplementLimit, maxDbSamples });
        if (!ok) {
            throw new Error('Benchmark eğitiminde DB yükleme/eğitim başarısız oldu.');
        }

        return {
            accuracy: this.lastAccuracy,
            trainSize: this.trainSize,
            testSize: this.testSize,
            classifierType: this.classifierType,
            preprocessingMode: this.preprocessingMode
        };
    }

    /**
     * Opsiyonel/Geriye Uyumluluk: Eğer DB boşsa hala JSON'dan yükleyebilmek için koruyalım
     */
    async loadAndTrainFromDiskFallback(): Promise<boolean> {
        try {
            let datasetPath = '/training/naive-bayes/dataset.json'; // Docker ortamı için

            if (!fs.existsSync(datasetPath)) {
                datasetPath = path.resolve(__dirname, '../../../../training/naive-bayes/dataset.json');
            }

            if (!fs.existsSync(datasetPath)) {
                console.warn('[ML Warn] Yedek eğitim veri seti (dataset.json) de bulunamadı:', datasetPath);
                return false;
            }

            const rawData = fs.readFileSync(datasetPath, 'utf8');
            const dataset: TrainingData[] = JSON.parse(rawData);

            await this.train(dataset);
            return true;
        } catch (error) {
            console.error('[ML Error] Veri seti yüklenirken hata:', error);
            return false;
        }
    }

    /**
     * Bir haber başlığını (opsiyonel içerik ile) kategorize eder.
     * Başlık + kısa içerik beraber kullanıldığında özellikle Genel/Siyaset/Dünya ayrımı daha doğru olur.
     */
    async categorize(title: string, contextText?: string): Promise<CategoryResult> {
        if (!this.isTrained) {
            throw new Error('Model henüz eğitilmedi. Önce train() çağrılmalı.');
        }

        const combinedText = `${title || ''} ${contextText || ''}`.trim();
        const inferenceText = combinedText.length > 0 ? combinedText : title;

        const tokens = this.preprocess(inferenceText, this.preprocessingMode);
        const processedText = tokens.join(' ');

        // natural v6'da getClassifications() tüm skorları döner (daha yüksek = daha olası)
        const classifications: Array<{ label: string; value: number }> = this.classifier.getClassifications(processedText) || [];
        const scores: Record<string, number> = {};

        // Doğrudan olasılık normalizasyonu (getClassifications() log-prob değil, küçük olasılık döndürür)
        const rawTotal = classifications.reduce((sum: number, c: any) => sum + c.value, 0);
        const expScores = classifications.map((c: any) => ({
            label: c.label,
            expVal: rawTotal > 0 ? c.value / rawTotal : 1 / classifications.length
        }));
        let totalExp = 1; // expScores zaten toplamı 1'e normalize edildi

        // Kelime ipuçları: model kararsız kaldığında kategori drift'ini azaltır.
        const normalized = inferenceText.toLowerCase();
        const keywordHints: Record<string, string[]> = {
            'Spor': ['maç', 'lig', 'gol', 'transfer', 'teknik direktör', 'basketbol', 'futbol', 'voleybol', 'hakem', 'şampiyon', 'kupa', 'derbi', 'golcü', 'defans', 'forvet'],
            'Ekonomi': [
                // Finans / döviz
                'borsa', 'faiz', 'enflasyon', 'dolar', 'euro', 'merkez bankası', 'ihracat', 'altın',
                // Şirket / sektör haberleri
                'şirket', 'sektör', 'piyasa', 'banka', 'bankacılık', 'kredi', 'yatırım', 'ihale',
                'bütçe', 'vergi', 'kâr', 'zarar', 'ciro', 'gelir', 'gider', 'büyüme', 'küçülme',
                // Tüketici / fiyat haberleri
                'fiyat', 'zam', 'tüketici', 'ürün fiyatı', 'zamlandı', 'ucuzladı', 'pahalandı',
                'merdiven altı', 'kayıt dışı', 'gümrük', 'ithalat', 'dış ticaret',
                // Bankacılık / mobil
                'mobil bankacılık', 'internet bankacılık', 'kredi kartı', 'atm', 'iban',
                // İstihdam / ekonomik gösterge
                'işsizlik', 'istihdam', 'ücret', 'asgari ücret', 'enflasyon oranı', 'büyüme oranı',
            ],
            'Teknoloji': ['yapay zeka', 'yazılım', 'siber', 'uydu', 'nasa', 'çip', 'akıllı telefon', 'teknoloji'],
            // Batch-16: Tekil tetikleyiciler (bakan, parti, seçim) phrase-level'e çekildi.
            // Sadece bileşik siyasi bağlamlar bonus alır; idari duyurular artık Siyaset'e kaymaz.
            'Siyaset': [
                'meclis oturumu', 'tbmm', 'milletvekili', 'cumhurbaşkanı',
                'kanun teklifi', 'yasa tasarısı', 'anayasa değişikliği',
                'seçim kampanyası', 'seçim sandığı', 'muhtarlık seçimi',
                'parti kongresi', 'parti genel başkan', 'muhalefet partisi',
                'bakanlar kurulu', 'kabine toplantısı', 'hükümet programı',
                'siyasi kriz', 'iktidar partisi',
            ],
            'Dünya': ['nato', 'bm', 'ukrayna', 'israil', 'iran', 'abd', 'avrupa birliği', 'uluslararası'],
            'Sağlık': [
                'hastane', 'doktor', 'aşı', 'salgın', 'kanser', 'tedavi', 'sağlık', 'ameliyat',
                'acil servis', 'yoğun bakım', 'sağlık bakanlığı', 'epidemi', 'hijyen', 'enfeksiyon',
                'muayene', 'reçete', 'tıbbi', 'klinik', 'hemşire', 'ambulans'
            ],
            'Genel': [
                'son dakika', 'gündem', 'olay', 'açıklama',
                // Kültür / sanat / eğlence
                'sinema', 'film', 'dizi', 'müzik', 'konser', 'sergi', 'tiyatro',
                'yönetmen', 'oyuncu', 'sanatçı', 'müzisyen',
                // İnsan haberleri
                'kurucusu', 'girişimci', 'hayatını kaybetti', 'vefat', 'geri döndü',
                'ödül', 'başarı', 'rekor',
                // Kamu / duyuru
                'vatandaş', 'başvuru', 'hizmet', 'kampanya fırsatı', 'indirim kampanyası',
            ]
        };

        // Asayiş Kalkanı (Batch-16): Adli/operasyon dili yoğun haberlerde Siyaset bonusunu engelle.
        // Bu sayede savcılık/gözaltı/operasyon haberleri Siyaset'e kaymaz.
        const asayisTerms = [
            'savcılık', 'başsavcılık', 'adliye', 'gözaltı', 'tutuklama',
            'zanlı', 'operasyon', 'iddianame', 'narkotik', 'suç örgütü',
        ];
        const asayisHits = asayisTerms.reduce((acc, t) => acc + (normalized.includes(t) ? 1 : 0), 0);
        const siyasetPhraseHits = (keywordHints['Siyaset'] as string[])
            .reduce((acc, h) => acc + (normalized.includes(h) ? 1 : 0), 0);
        const asayisShield = asayisHits >= 2 && siyasetPhraseHits === 0;

        const hintBonusByCategory: Record<string, number> = {};
        for (const [category, hints] of Object.entries(keywordHints)) {
            const hitCount = hints.reduce((acc, h) => acc + (normalized.includes(h) ? 1 : 0), 0);
            if (hitCount > 0) {
                // Batch-16/Phase-1: Siyaset cap 0.20→0.08; asayiş kalkanı devredeyse Siyaset bonusu sıfır.
                let cap = category === 'Siyaset' ? 0.08 : 0.18;
                if (category === 'Siyaset' && asayisShield) cap = 0;
                hintBonusByCategory[category] = Math.min(cap, hitCount * 0.06);
            }
        }

        // Baz skor + ipucu bonusu ve tekrar normalize
        let adjustedSum = 0;
        const adjustedScores = expScores.map((s: any) => {
            const base = s.expVal / totalExp;
            const bonus = hintBonusByCategory[s.label] || 0;
            const adjusted = base + bonus;
            adjustedSum += adjusted;
            return { label: s.label, adjusted };
        });

        let bestCategory = 'Bilinmeyen';
        let highestConfidence = 0;

        adjustedScores.forEach((s: any) => {
            const confidence = adjustedSum > 0 ? s.adjusted / adjustedSum : 0;
            scores[s.label] = confidence;

            if (confidence > highestConfidence) {
                highestConfidence = confidence;
                bestCategory = s.label;
            }
        });

        if (highestConfidence < ML_CONFIDENCE_THRESHOLD) {
            console.log(`[ML] Düşük Güven Skoru (${highestConfidence.toFixed(2)}): "${title}" -> Manuel İnceleme Kuyruğuna Eklenecek.`);
        }

        return {
            kategori: bestCategory,
            confidence: highestConfidence,
            allScores: scores
        };
    }

    async getAccuracy(): Promise<{ accuracy: number; testSize: number; trainSize: number }> {
        return {
            accuracy: this.lastAccuracy,
            testSize: this.testSize,
            trainSize: this.trainSize
        };
    }

    async analyzeSentiment(text: string): Promise<SentimentResult> {
        const dictPath = path.resolve(__dirname, 'tr-sentiment-dict.json');
        let sentimentDict: Record<string, number> = {};
        let stemDict: Record<string, number> = {}; // 6-char stem mapping
        
        try {
            if (fs.existsSync(dictPath)) {
                const rawDict = fs.readFileSync(dictPath, 'utf-8');
                const parsedDict = JSON.parse(rawDict);
                
                for (const [key, value] of Object.entries(parsedDict)) {
                    const lowKey = key.toLowerCase();
                    sentimentDict[lowKey] = value as number;
                    // Kök bazlı eşleşme için ilk 6 karakteri de sisteme ekle (Sorun 3 İyileştirmesi)
                    if (lowKey.length >= 5) {
                        const stem = lowKey.substring(0, 6);
                        // Eğer aynı kök hem pozitif hem negatifte çakışırsa literal olan her zaman önceliklidir,
                        // stem sözlüğünde ise ilk gelen kalır (genelde sözlük düzenlidir).
                        if (!stemDict[stem]) stemDict[stem] = value as number;
                    }
                }
            }
        } catch (error) {
            console.error('[ML Error] Sentiment sözlüğü okunamadı:', error);
        }

        // Metni temizle ve kelimelere böl (stemmer kullanmıyoruz ki orijinal hallerine 6-char kuralı uygulayabilelim)
        const words = text.toLowerCase()
            .replace(/[^\w\sğüşıöç]/gi, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2);
        
        let score = 0;
        const negations = ['değil', 'yok', 'olmaz', 'hiç', 'asla', 'olmadı', 'olmadığını', 'değildir'];
        let inNegationWindow = 0;

        words.forEach(word => {
            if (negations.includes(word)) {
                inNegationWindow = 3;
            }

            let wordScore = 0;
            // 1. Tam eşleşme kontrolü
            if (sentimentDict[word] !== undefined) {
                wordScore = sentimentDict[word];
            } 
            // 2. Kök bazlı eşleşme kontrolü (Sorun 3: "yaptırım" -> "yaptırımlar")
            else {
                const wordStem = word.substring(0, 6);
                if (stemDict[wordStem] !== undefined) {
                    wordScore = stemDict[wordStem];
                }
            }

            if (wordScore !== 0) {
                // Negasyon penceresindeysek skoru ters çevir
                if (inNegationWindow > 0) {
                    wordScore *= -1;
                }
                score += wordScore;
            }

            if (inNegationWindow > 0) {
                inNegationWindow--;
            }
        });
        
        // [REF-] Kelime yoğunluğu normalizasyonu (square-root scaling)
        // score = Σ(ağırlıklar) / √(toplam_kelime_sayısı)
        const scaleFactor = 1.5;
        const normalizedScore = words.length > 0 
            ? (score / Math.sqrt(words.length)) * scaleFactor 
            : 0;

        // Eşik değerlerini hassaslaştır
        let label: 'Pozitif' | 'Negatif' | 'Nötr' = 'Nötr';
        if (normalizedScore > 0.45) label = 'Pozitif';
        else if (normalizedScore < -0.45) label = 'Negatif';

        return { score: normalizedScore, label };
    }

    extractEntities(text: string): string[] {
        const tfidf = new natural.TfIdf();
        tfidf.addDocument(text);
        
        let entities: string[] = [];
        tfidf.listTerms(0).forEach(item => {
            // Include terms with higher tfidf score that aren't too short
            if (item.tfidf > 1 && item.term.length > 3) {
                entities.push(item.term);
            }
        });
        
        return entities.slice(0, 5);
    }

    isDuplicate(text1: string, text2: string): boolean {
        const entities1 = this.extractEntities(text1);
        const entities2 = this.extractEntities(text2);
        
        let intersection = 0;
        for (const ent of entities1) {
            if (entities2.includes(ent)) intersection++;
        }
        
        // If 3 or more extracted entities match, consider it duplicate
        if (intersection >= 3 && entities1.length > 0) {
            return true;
        }
        
        // Fallback to Jaro-Winkler distance for semantic similarity
        // natural.JaroWinklerDistance is available
        const distance = natural.JaroWinklerDistance(text1, text2, { ignoreCase: true });
        return distance > 0.85;
    }
}
