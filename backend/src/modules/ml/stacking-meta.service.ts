/**
 * Stacking Meta-Classifier
 *
 * Second-level classifier for the NB+LR ensemble.
 * Feature vector: [...nbProbs (nClasses), ...lrProbs (nClasses)]
 *
 * Unlike fixed-weight soft voting, the meta-LR learns per-class optimal
 * weights: "for Spor, trust LR more; for Dünya, trust NB more" etc.
 *
 * Uses the same OvA logistic regression (ml-logistic-regression) as the
 * base LR model, with the same polarity-inverted softmax convention.
 */

export class StackingMetaClassifier {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private model: any = null;
    private categoryIndex: Map<string, number> = new Map();
    private indexCategory: string[] = [];
    private numFeatures: number = 0;

    /**
     * Train meta-classifier on stacked meta-features.
     * @param metaFeatures  Array of [nbProb_0..nbProb_k, lrProb_0..lrProb_k]
     * @param labels        Ground truth category labels (aligned with metaFeatures)
     * @param categories    Stable sorted category list (defines index order)
     * @param options       Training hyper-parameters
     */
    async fit(
        metaFeatures: number[][],
        labels: string[],
        categories: string[],
        options: { numSteps?: number; learningRate?: number } = {},
    ): Promise<void> {
        if (metaFeatures.length !== labels.length || metaFeatures.length === 0) {
            throw new Error('[StackingMeta] metaFeatures and labels must be non-empty and same length');
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: no type declarations for ml-logistic-regression
        const LrModule = await import('ml-logistic-regression');
        const LR = LrModule.default;
        const { Matrix } = await import('ml-matrix');

        const { numSteps = 500, learningRate = 0.01 } = options;

        this.indexCategory = [...categories].sort();
        this.categoryIndex.clear();
        this.indexCategory.forEach((l, i) => this.categoryIndex.set(l, i));
        this.numFeatures = metaFeatures[0].length;

        const X = new Matrix(metaFeatures);
        const y = Matrix.columnVector(labels.map(l => this.categoryIndex.get(l) ?? 0));

        this.model = new LR({ numSteps, learningRate });
        this.model.train(X, y);
    }

    /**
     * Predict category from NB and LR probability distributions.
     */
    predict(nbProbs: number[], lrProbs: number[]): string {
        if (!this.model) throw new Error('[StackingMeta] Not trained. Call fit() first.');
        const probs = this.predictProba(nbProbs, lrProbs);
        let maxIdx = 0;
        for (let i = 1; i < probs.length; i++) {
            if (probs[i] > probs[maxIdx]) maxIdx = i;
        }
        return this.indexCategory[maxIdx] ?? 'Bilinmeyen';
    }

    /**
     * Get probability distribution from meta-classifier.
     * Uses the same OvA logit extraction + polarity-inverted softmax as TfidfLrClassifier.
     */
    predictProba(nbProbs: number[], lrProbs: number[]): number[] {
        if (!this.model) throw new Error('[StackingMeta] Not trained. Call fit() first.');
        const features = [...nbProbs, ...lrProbs];
        const logits = this.getOneVsAllLogits(features);
        const probs = this.softmax(logits.map(l => -l)); // polarity inversion (same as TfidfLrClassifier)

        // Guard: if polarity inversion produces a wrong argmax, fall back to +logit
        const hardIdx = this.argmin(logits);
        const probaIdx = this.argmax(probs);
        if (hardIdx !== probaIdx) {
            const fallback = this.softmax(logits);
            if (this.argmax(fallback) === hardIdx) return fallback;
        }
        return probs;
    }

    getIndexCategory(): string[] {
        return this.indexCategory;
    }

    isTrained(): boolean {
        return this.model !== null;
    }

    // ── Serialization ──────────────────────────────────────────

    serialize(): Record<string, unknown> {
        if (!this.model) throw new Error('[StackingMeta] Model not trained');
        return {
            model: this.model.toJSON(),
            categoryIndex: Array.from(this.categoryIndex.entries()),
            indexCategory: this.indexCategory,
            numFeatures: this.numFeatures,
        };
    }

    async deserialize(state: Record<string, unknown>): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: no type declarations for ml-logistic-regression
        const LrModule = await import('ml-logistic-regression');
        const LR = LrModule.default;
        this.model = LR.load(state.model as Record<string, unknown>);
        this.categoryIndex = new Map(state.categoryIndex as Array<[string, number]>);
        this.indexCategory = state.indexCategory as string[];
        this.numFeatures = state.numFeatures as number;
    }

    // ── Private helpers (mirrors TfidfLrClassifier internals) ──

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private getOneVsAllLogits(features: number[]): number[] {
        const classifiers = this.getModelClassifiers();
        return classifiers.map((classifier) => {
            const weights = this.extractWeights(classifier);
            return weights.reduce((sum, w, i) => sum + w * (features[i] ?? 0), 0);
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private getModelClassifiers(): any[] {
        const classifiers = this.model?.classifiers;
        if (!Array.isArray(classifiers) || classifiers.length === 0) {
            throw new Error('[StackingMeta] No classifiers found in model');
        }
        return classifiers;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private extractWeights(classifier: any): number[] {
        const weights = classifier?.weights;
        if (!weights) throw new Error('[StackingMeta] Classifier has no weights');

        if (typeof weights.to1DArray === 'function') return weights.to1DArray() as number[];
        if (typeof weights.getRow === 'function') return weights.getRow(0) as number[];
        if (Array.isArray(weights)) {
            if (Array.isArray(weights[0])) return weights[0] as number[];
            return weights as number[];
        }
        const rowZero = (weights as Record<string, unknown>)['0'];
        if (Array.isArray(rowZero)) return rowZero as number[];
        throw new Error('[StackingMeta] Unsupported weight structure');
    }

    private softmax(values: number[]): number[] {
        const maxValue = Math.max(...values);
        const exponentials = values.map(v => Math.exp(v - maxValue));
        const total = exponentials.reduce((s, v) => s + v, 0);
        return total > 0 ? exponentials.map(v => v / total) : values.map(() => 0);
    }

    private argmax(values: number[]): number {
        let best = 0;
        for (let i = 1; i < values.length; i++) {
            if (values[i] > values[best]) best = i;
        }
        return best;
    }

    private argmin(values: number[]): number {
        let best = 0;
        for (let i = 1; i < values.length; i++) {
            if (values[i] < values[best]) best = i;
        }
        return best;
    }
}
