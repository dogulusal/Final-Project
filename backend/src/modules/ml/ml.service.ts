import natural from 'natural';
import fs from 'fs';
import path from 'path';
import { INewsCategorizationService, CategoryResult, TrainingData, SentimentResult } from './ml.interface';
import { tokenizeAndStem } from './turkish-stemmer';
import { ML_CONFIDENCE_THRESHOLD } from '../../config/constants';
import { prisma } from '../../config/database';
import { newsEventEmitter } from '../news/news.service';

export class MlCategorizationService implements INewsCategorizationService {
    public classifier: natural.BayesClassifier;
    private isTrained: boolean = false;
    private newsSinceLastTrain: number = 0;
    private lastAccuracy: number = 0;
    private trainSize: number = 0;
    private testSize: number = 0;
    private readonly BATCH_TRAIN_THRESHOLD = 50;

    constructor() {
        // Türkçe dil desteği için kendi tokenizer'ımızı oluşturuyoruz
        natural.PorterStemmer.tokenizeAndStem = function (text: string) {
            return tokenizeAndStem(text);
        };

        // Custom stemmer'ı classifier'a veriyoruz
        this.classifier = new natural.BayesClassifier(natural.PorterStemmer);

        // Faz 4: Oto-Öğrenim Pipeline Gözlemcisi (Observer)
        this.initializeTrainingPipeline();
    }

    private initializeTrainingPipeline(): void {
        newsEventEmitter.on('new-news', (news: any) => {
            // Sadece yönetici-onaylı (veya n8n tarafından hazır işaretlenen) temiz veriyi eğitime alıyoruz (Hibrit Geliştirme)
            if (news.durum === 'hazir' || news.durum === 'yayinda') {
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

    /**
     * Modeli belirtilen JSON/DB veri seti ile eğitir ve %80/%20 Test/Train ayırır.
     */
    async train(dataset: TrainingData[]): Promise<void> {
        console.log(`[ML] Model eğitimi başlıyor... (${dataset.length} örnek)`);
        
        if (dataset.length < 5) {
            console.warn('[ML Warn] Yeterli veri yok, eğitim atlanıyor.');
            return;
        }

        // Shuffle dataset
        const shuffled = [...dataset].sort(() => 0.5 - Math.random());
        
        // 80/20 split
        const splitIndex = Math.floor(shuffled.length * 0.8);
        const trainSet = shuffled.slice(0, splitIndex);
        const testSet = shuffled.slice(splitIndex);
        
        this.trainSize = trainSet.length;
        this.testSize = testSet.length;

        // Eski eğitimi temizle
        this.classifier = new natural.BayesClassifier(natural.PorterStemmer);

        trainSet.forEach((data) => {
            if (data.text && data.category) {
                this.classifier.addDocument(data.text, data.category);
            }
        });

        this.classifier.train();
        this.isTrained = true;
        
        // Test Set ile doğruluğu hesapla
        let correctGuesses = 0;
        if (this.testSize > 0) {
            testSet.forEach(item => {
                try {
                    const guess = this.classifier.classify(item.text);
                    if (guess === item.category) {
                        correctGuesses++;
                    }
                } catch(e) {}
            });
            this.lastAccuracy = correctGuesses / this.testSize;
        } else {
            this.lastAccuracy = 0;
        }

        console.log(`[ML] Model başarıyla eğitildi ve RAM'e alındı. (Train: ${this.trainSize}, Test: ${this.testSize}, Accuracy: %${(this.lastAccuracy*100).toFixed(1)})`);
    }

    /**
     * Faz 4 İyileştirmesi: Diskteki hantal JSON yerine,
     * veritabanındaki "gerçek" onaylanmış (hazir/yayinda) haberlerden dinamik eğitim
     */
    async loadAndTrainFromDB(): Promise<boolean> {
        try {
            // Sadece durum = 'hazir' veya 'yayinda' olan temiz haberleri getir (Data Poisoning engeli)
            const approvedNews = await prisma.haber.findMany({
                where: {
                    durum: { in: ['hazir', 'yayinda'] }
                },
                include: {
                    kategori: true
                }
            });

            if (approvedNews.length === 0) {
                console.warn('[ML Warn] Veritabanında eğitilecek onaylı haber (hazir/yayinda) bulunamadı. JSON yedeğe dönülüyor...');
                return await this.loadAndTrainFromDiskFallback();
            }

            const dbDataset: TrainingData[] = approvedNews.map(news => ({
                text: `${news.baslik} ${news.metaAciklama || ''} ${news.icerik || ''}`,
                category: news.kategori.ad
            }));

            await this.train(dbDataset);
            return true;
        } catch (error) {
            console.error('[ML Error] DB üzerinden veri seti oluşturulurken hata:', error);
            return false;
        }
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

    async getAccuracy(): Promise<{ accuracy: number; testSize: number; trainSize: number }> {
        return {
            accuracy: this.lastAccuracy,
            testSize: this.testSize,
            trainSize: this.trainSize
        };
    }

    async analyzeSentiment(text: string): Promise<SentimentResult> {
        // Read and parse the custom Turkish dictionary
        const dictPath = path.resolve(__dirname, 'tr-sentiment-dict.json');
        let sentimentDict: Record<string, number> = {};
        
        try {
            if (fs.existsSync(dictPath)) {
                const rawDict = fs.readFileSync(dictPath, 'utf-8');
                sentimentDict = JSON.parse(rawDict);
            } else {
                console.warn('[ML Warn] tr-sentiment-dict.json bulunamadı. Tüm skorlar 0 dönecek.');
            }
        } catch (error) {
            console.error('[ML Error] Sentiment sözlüğü okunamadı:', error);
        }

        // Tokenize text using our Turkish stemmer
        const tokens = tokenizeAndStem(text);
        
        let score = 0;
        tokens.forEach(token => {
            if (sentimentDict[token]) {
                score += sentimentDict[token];
            }
        });
        
        // Output normalization based on threshold
        let label: 'Pozitif' | 'Negatif' | 'Nötr' = 'Nötr';
        if (score > 0) label = 'Pozitif';
        else if (score < 0) label = 'Negatif';

        return { score, label };
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
