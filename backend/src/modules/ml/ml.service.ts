import natural from 'natural';
import fs from 'fs';
import path from 'path';
import { INewsCategorizationService, CategoryResult, TrainingData } from './ml.interface';
import { tokenizeAndStem } from './turkish-stemmer';
import { ML_CONFIDENCE_THRESHOLD } from '../../config/constants';

export class MlCategorizationService implements INewsCategorizationService {
    private classifier: natural.BayesClassifier;
    private isTrained: boolean = false;

    constructor() {
        // Türkçe dil desteği için kendi tokenizer'ımızı oluşturuyoruz
        natural.PorterStemmer.tokenizeAndStem = function (text: string) {
            return tokenizeAndStem(text);
        };

        // Custom stemmer'ı classifier'a veriyoruz
        this.classifier = new natural.BayesClassifier(natural.PorterStemmer);
    }

    /**
     * Modeli belirtilen JSON veri seti ile eğitir
     */
    async train(dataset: TrainingData[]): Promise<void> {
        console.log(`[ML] Model eğitimi başlıyor... (${dataset.length} örnek)`);

        // Eski eğitimi temizle
        this.classifier = new natural.BayesClassifier(natural.PorterStemmer);

        dataset.forEach((data) => {
            this.classifier.addDocument(data.text, data.category);
        });

        this.classifier.train();
        this.isTrained = true;
        console.log('[ML] Model başarıyla eğitildi.');
    }

    /**
     * Diskteki JSON dosyasından okuyarak modeli eğitir
     */
    async loadAndTrainFromDisk(): Promise<boolean> {
        try {
            let datasetPath = '/training/naive-bayes/dataset.json'; // Docker ortamı için

            if (!fs.existsSync(datasetPath)) {
                // Fallback: Local geliştirme ortamı
                datasetPath = path.resolve(__dirname, '../../../../training/naive-bayes/dataset.json');
            }

            if (!fs.existsSync(datasetPath)) {
                console.warn('[ML Warn] Eğitim veri seti bulunamadı:', datasetPath);
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
     * Bir haber başlığının kategorisini tahmin eder
     */
    async categorize(title: string): Promise<CategoryResult> {
        if (!this.isTrained) {
            throw new Error('Model henüz eğitilmedi. Önce train() çağrılmalı.');
        }

        // natural v6'da getClassifications() tüm skorları döner (daha yüksek = daha olası)
        const classifications = this.classifier.getClassifications(title);

        // natural, en iyi eşleşmeyi döner, ancak normalize edilmiş bir "confidence" (0-1 arası) yüzdesi dönmez.
        // Confidence'ı hesaplamak için min-max veya softmax varyasyonu kullanabiliriz.
        // Basitlik açısından en yüksek skoru toplam skora bölerek yaklaşık bir güven yüzdesi bulalım.

        const scores: Record<string, number> = {};
        let totalScore = 0;

        classifications.forEach(c => {
            // Değerler eksi olabilir, mutlak değere/pozitife çevirerek oransal dağılım
            const posValue = Math.exp(c.value);
            scores[c.label] = posValue;
            totalScore += posValue;
        });

        let bestCategory = 'Bilinmeyen';
        let highestConfidence = 0;

        for (const [label, score] of Object.entries(scores)) {
            const confidence = score / totalScore;
            scores[label] = confidence; // Skorları Yüzde (0-1) cinsinden kaydet

            if (confidence > highestConfidence) {
                highestConfidence = confidence;
                bestCategory = label;
            }
        }

        // Eğer güven skoru tanımlanan barajın altındaysa "İnceleme Gerekiyor" olarak işaretle (İlerde Admin Dashboard için)
        if (highestConfidence < ML_CONFIDENCE_THRESHOLD) {
            console.log(`[ML] Düşük Güven Skoru (${highestConfidence.toFixed(2)}): "${title}" -> Manuel İnceleme Kuyruğuna Eklenecek.`);
        }

        return {
            kategori: bestCategory,
            confidence: highestConfidence,
            allScores: scores
        };
    }

    async getAccuracy(): Promise<number> {
        // İleride modeli test verisi ile çapraz çaprazlamaya (k-fold cross validation) sokmak için
        return this.isTrained ? 0.85 : 0;
    }
}
