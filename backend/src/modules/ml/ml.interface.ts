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

export interface SentimentResult {
    score: number;
    label: 'Pozitif' | 'Negatif' | 'Nötr';
}

export interface INewsCategorizationService {
    categorize(title: string): Promise<CategoryResult>;
    train(dataset: TrainingData[]): Promise<void>;
    getAccuracy(): Promise<{ accuracy: number; testSize: number; trainSize: number }>;
    analyzeSentiment(text: string): Promise<SentimentResult>;
    extractEntities(text: string): string[];
    isDuplicate(text1: string, text2: string): boolean;
}
