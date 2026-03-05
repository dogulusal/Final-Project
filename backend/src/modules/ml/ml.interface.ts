/**
 * ML Kategorizasyon Servisi Interface
 */

export interface CategoryResult {
    kategori: string;
    confidence: number;
    allScores: Record<string, number>;
}

export interface TrainingData {
    text: string;
    category: string;
}

export interface INewsCategorizationService {
    categorize(title: string): Promise<CategoryResult>;
    train(dataset: TrainingData[]): Promise<void>;
    getAccuracy(): Promise<number>;
}
