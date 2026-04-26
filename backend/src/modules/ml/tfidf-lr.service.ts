/// <reference path="../../types/ml-logistic-regression.d.ts" />
import { turkishStem } from './turkish-stemmer';

/**
 * TF-IDF Vectorizer + Logistic Regression Classifier
 *
 * Task 2.1: TF-IDF vectorizer with Turkish stopword filtering + Turkish stemming
 * Task 2.2: TfidfLrClassifier (ml-logistic-regression library wrapper)
 *
 * Design decisions:
 * - No NestJS DI — plain class for reuse in scripts + service
 * - Serializable to JSON for storage in model_state.lr_model_data
 * - Turkish stopwords included; Turkish Snowball stemming applied to each token
 * - Aligns LR tokenization with NB preprocessing pipeline for feature parity
 */

interface TfidfOptions {
    minDf?: number;          // minimum document frequency (default 2)
    maxDf?: number;          // max df as fraction of corpus (default 0.85)
    maxFeatures?: number;    // vocabulary cap (default 5000)
    ngramRange?: [number, number]; // [1,1] unigram, [1,2] unigram+bigram
}

// ─────────────────────────────────────────────────────────────
//  TF-IDF Vectorizer
// ─────────────────────────────────────────────────────────────

export class TfidfLrService {
    private vocabulary: Map<string, number> = new Map();
    private idfValues: number[] = [];           // indexed by vocab index
    private docFrequency: Map<string, number> = new Map();
    private totalDocuments: number = 0;

    private readonly turkishStopwords = new Set([
        'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz', 'on',
        've', 'ile', 'de', 'da', 'ki', 'bu', 'şu', 'o', 'en', 'çok', 'az',
        'gibi', 'için', 'ise', 'ama', 'fakat', 'lakin', 'ancak', 'ya', 'veya',
        'hem', 'ne', 've', 'ile', 'den', 'dan', 'ten', 'tan', 'nin', 'nın',
        'nun', 'nün', 'ın', 'in', 'un', 'ün', 'a', 'e', 'ı', 'i', 'u', 'ü',
        'bu', 'şu', 'o', 'ben', 'sen', 'biz', 'siz', 'onlar', 'beni', 'seni',
        'onu', 'bizi', 'sizi', 'onları', 'bana', 'sana', 'ona', 'bize', 'size',
        'oldu', 'oldu', 'olacak', 'olur', 'var', 'yok', 'değil', 'daha',
        'olan', 'olan', 'oluyor', 'edildi', 'edilen', 'yapılan', 'yapıldı',
        'belki', 'yani', 'ha', 'hani', 'nasıl', 'neden', 'niçin', 'hangi',
        'kadar', 'sonra', 'önce', 'üzere', 'arasında', 'içinde', 'dışında',
        'göre', 'karşı', 'doğru', 'itibaren', 'beri', 'rağmen',
    ]);

    /**
     * Fit TF-IDF vectorizer on a corpus of documents.
     * Must be called before vectorize().
     */
    fitVectorizer(documents: string[], options: TfidfOptions = {}): void {
        const {
            minDf = 2,
            maxDf = 0.85,
            maxFeatures = 5000,
            ngramRange = [1, 2],
        } = options;

        this.vocabulary.clear();
        this.docFrequency.clear();
        this.totalDocuments = documents.length;

        // Count document frequencies
        for (const doc of documents) {
            const tokens = this.extractNgrams(this.tokenize(doc), ngramRange);
            const seen = new Set(tokens);
            for (const token of seen) {
                this.docFrequency.set(token, (this.docFrequency.get(token) ?? 0) + 1);
            }
        }

        // Filter by minDf / maxDf and select topN by document frequency
        const maxAbsDf = maxDf <= 1.0 ? Math.floor(maxDf * documents.length) : maxDf;
        const candidates: Array<[string, number]> = [];

        for (const [term, df] of this.docFrequency.entries()) {
            if (df < minDf) continue;
            if (df > maxAbsDf) continue;
            candidates.push([term, df]);
        }

        // Sort by descending df then alphabetically for determinism; take top N
        candidates.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        const selected = candidates.slice(0, maxFeatures);

        // Assign vocabulary indices
        this.vocabulary.clear();
        for (let i = 0; i < selected.length; i++) {
            this.vocabulary.set(selected[i][0], i);
        }

        // Compute IDF: log((N + 1) / (df + 1)) + 1  (sklearn smooth variant)
        this.idfValues = new Array(this.vocabulary.size).fill(0);
        for (const [term, idx] of this.vocabulary.entries()) {
            const df = this.docFrequency.get(term) ?? 1;
            this.idfValues[idx] = Math.log((this.totalDocuments + 1) / (df + 1)) + 1;
        }
    }

    /**
     * Vectorize a single document to a TF-IDF L2-normalized float array.
     * Returns a zero vector if vocabulary is empty.
     */
    vectorize(document: string, ngramRange: [number, number] = [1, 2]): number[] {
        const size = this.vocabulary.size;
        if (size === 0) return [];

        const vector = new Array(size).fill(0);
        const tokens = this.extractNgrams(this.tokenize(document), ngramRange);

        // TF: raw count / doc length
        const docLen = tokens.length || 1;
        for (const token of tokens) {
            const idx = this.vocabulary.get(token);
            if (idx !== undefined) {
                vector[idx] += 1 / docLen;
            }
        }

        // Multiply by IDF
        for (let i = 0; i < size; i++) {
            vector[i] *= this.idfValues[i];
        }

        // L2 normalize
        const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
        if (norm > 0) {
            for (let i = 0; i < size; i++) {
                vector[i] /= norm;
            }
        }

        return vector;
    }

    get vocabularySize(): number {
        return this.vocabulary.size;
    }

    // ── Serialization ──────────────────────────────────────────

    serialize(): Record<string, unknown> {
        return {
            vocabulary: Array.from(this.vocabulary.entries()),
            idfValues: this.idfValues,
            totalDocuments: this.totalDocuments,
            stopwords: Array.from(this.turkishStopwords),
        };
    }

    deserialize(state: Record<string, unknown>): void {
        this.vocabulary = new Map(state.vocabulary as Array<[string, number]>);
        this.idfValues = state.idfValues as number[];
        this.totalDocuments = state.totalDocuments as number;
        // stopwords are built-in; ignore stored list (keep latest)
    }

    // ── Private helpers ────────────────────────────────────────

    private tokenize(text: string): string[] {
        const lower = text.toLowerCase();
        // Unicode-aware word extraction (preserves Turkish diacritics)
        const raw = lower.match(/[\p{L}\p{N}]+/gu) ?? [];
        // Filter stopwords, then apply Turkish stemming to align with NB preprocessing
        return raw
            .filter(t => t.length >= 2 && !this.turkishStopwords.has(t))
            .map(t => turkishStem(t)); // Apply Turkish Snowball stemmer
    }

    private extractNgrams(tokens: string[], ngramRange: [number, number]): string[] {
        const [minN, maxN] = ngramRange;
        const ngrams: string[] = [];
        for (let n = minN; n <= maxN; n++) {
            for (let i = 0; i <= tokens.length - n; i++) {
                ngrams.push(tokens.slice(i, i + n).join('_'));
            }
        }
        return ngrams;
    }
}

// ─────────────────────────────────────────────────────────────
//  TF-IDF + Logistic Regression Classifier
//  (Task 2.2 — installed when ml-logistic-regression is present)
// ─────────────────────────────────────────────────────────────

export class TfidfLrClassifier {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private model: any = null;
    private categoryIndex: Map<string, number> = new Map();
    private indexCategory: string[] = [];

    /**
     * Train One-vs-All Logistic Regression on TF-IDF vectors.
     * Uses dynamic import for ESM-only ml-logistic-regression package.
     */
    async fit(
        documents: string[],
        labels: string[],
        vectorizer: TfidfLrService,
        options: { numSteps?: number; learningRate?: number } = {},
    ): Promise<void> {
        if (documents.length !== labels.length) {
            throw new Error('documents and labels must have the same length');
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: no type declarations for ml-logistic-regression
        const LrModule = await import('ml-logistic-regression');
        const LR = LrModule.default;
        const { Matrix } = await import('ml-matrix');

        const { numSteps = 500, learningRate = 5e-3 } = options;

        // Build category index from unique labels
        const uniqueLabels = Array.from(new Set(labels)).sort();
        this.indexCategory = uniqueLabels;
        this.categoryIndex.clear();
        uniqueLabels.forEach((l, i) => this.categoryIndex.set(l, i));

        // Vectorize documents → X matrix
        const vectors = documents.map(d => vectorizer.vectorize(d));
        const X = new Matrix(vectors);
        const y = Matrix.columnVector(labels.map(l => this.categoryIndex.get(l) ?? 0));

        this.model = new LR({ numSteps, learningRate });
        this.model.train(X, y);
    }

    /**
     * Returns a probability distribution derived from OvA LR logits.
     * The upstream library trains each binary classifier as "class k = 0, rest = 1",
     * so the raw score is negated before softmax to recover "belongs to class k".
     */
    async predictProba(text: string, vectorizer: TfidfLrService): Promise<number[]> {
        if (!this.model) throw new Error('Model not trained. Call fit() first.');
        const vec = vectorizer.vectorize(text);
        const logits = this.getOneVsAllLogits(vec);
        const probs = this.softmax(logits.map((logit) => -logit));

        // Guard the polarity assumption: softmax argmax should align with hard prediction.
        const hardPredIdx = this.getPredictedClassIndex(vec);
        const probaPredIdx = this.argmax(probs);
        if (hardPredIdx !== probaPredIdx) {
            const fallback = this.softmax(logits);
            if (this.argmax(fallback) === hardPredIdx) {
                return fallback;
            }
        }

        return probs;
    }

    /**
     * Returns predicted category name (highest probability class).
     */
    async predict(text: string, vectorizer: TfidfLrService): Promise<string> {
        const probs = await this.predictProba(text, vectorizer);
        let maxIdx = 0;
        for (let i = 1; i < probs.length; i++) {
            if (probs[i] > probs[maxIdx]) maxIdx = i;
        }
        return this.indexCategory[maxIdx];
    }

    getCategoryIndex(): Map<string, number> {
        return this.categoryIndex;
    }

    getIndexCategory(): string[] {
        return this.indexCategory;
    }

    // ── Serialization ──────────────────────────────────────────

    serialize(): Record<string, unknown> {
        if (!this.model) throw new Error('Model not trained');
        return {
            model: this.model.toJSON(),
            categoryIndex: Array.from(this.categoryIndex.entries()),
            indexCategory: this.indexCategory,
        };
    }

    /**
     * Deserialize is async because ml-logistic-regression is ESM-only.
     */
    async deserialize(state: Record<string, unknown>): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: no type declarations for ml-logistic-regression
        const LrModule = await import('ml-logistic-regression');
        const LR = LrModule.default;
        this.model = LR.load(state.model as Record<string, unknown>);
        this.categoryIndex = new Map(state.categoryIndex as Array<[string, number]>);
        this.indexCategory = state.indexCategory as string[];
    }

    // ── Private helpers ────────────────────────────────────────

    private getOneVsAllLogits(features: number[]): number[] {
        const classifiers = this.getModelClassifiers();
        return classifiers.map((classifier) => {
            const weights = this.extractWeights(classifier);
            const usableLength = Math.min(weights.length, features.length);
            let score = 0;
            for (let index = 0; index < usableLength; index++) {
                score += weights[index] * features[index];
            }
            return score;
        });
    }

    private getPredictedClassIndex(features: number[]): number {
        const logits = this.getOneVsAllLogits(features);
        let minIdx = 0;
        for (let index = 1; index < logits.length; index++) {
            if (logits[index] < logits[minIdx]) minIdx = index;
        }
        return minIdx;
    }

    private getModelClassifiers(): unknown[] {
        const classifiers = this.model?.classifiers;
        if (!Array.isArray(classifiers) || classifiers.length === 0) {
            throw new Error('LR classifiers are missing or invalid');
        }
        return classifiers;
    }

    private extractWeights(classifier: unknown): number[] {
        const weights = (classifier as { weights?: unknown })?.weights;
        if (!weights) {
            throw new Error('LR classifier weights are missing');
        }

        if (typeof (weights as { to1DArray?: () => number[] }).to1DArray === 'function') {
            return (weights as { to1DArray: () => number[] }).to1DArray();
        }

        if (typeof (weights as { getRow?: (row: number) => number[] }).getRow === 'function') {
            return (weights as { getRow: (row: number) => number[] }).getRow(0);
        }

        if (Array.isArray(weights)) {
            if (Array.isArray(weights[0])) {
                return weights[0] as number[];
            }
            return weights as number[];
        }

        const rowZero = (weights as Record<string, unknown>)['0'];
        if (Array.isArray(rowZero)) {
            return rowZero as number[];
        }

        throw new Error('Unsupported LR weight structure');
    }

    private softmax(values: number[]): number[] {
        const maxValue = Math.max(...values);
        const exponentials = values.map((value) => Math.exp(value - maxValue));
        const total = exponentials.reduce((sum, value) => sum + value, 0);
        return total > 0 ? exponentials.map((value) => value / total) : values.map(() => 0);
    }

    private argmax(values: number[]): number {
        let bestIndex = 0;
        for (let index = 1; index < values.length; index++) {
            if (values[index] > values[bestIndex]) bestIndex = index;
        }
        return bestIndex;
    }
}
