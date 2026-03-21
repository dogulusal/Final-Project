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
    private readonly BATCH_TRAIN_THRESHOLD = 20;

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
            // Ham dahil tüm düzenli haberleri (hata hariç) eğitime katıp modelin kelime dağarcığını genişletiyoruz
            if (news.durum === 'ham' || news.durum === 'hazir' || news.durum === 'yayinda') {
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
        
        if (dataset.length < 30) {
            console.warn(`[ML Warn] Yeterli veri yok (${dataset.length} < 30), eğitim atlanıyor.`);
            return;
        }

        // Kategori başına min 3 örnek kontrolü
        const categoryCounts: Record<string, number> = {};
        dataset.forEach(d => { categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1; });
        const validDataset = dataset.filter(d => categoryCounts[d.category] >= 3);
        const skippedCategories = Object.entries(categoryCounts).filter(([, count]) => count < 3).map(([cat]) => cat);
        if (skippedCategories.length > 0) {
            console.warn(`[ML Warn] Yetersiz örnek nedeniyle atlanan kategoriler (< 3 örnek): ${skippedCategories.join(', ')}`);
        }

        // Shuffle dataset
        const shuffled = [...validDataset].sort(() => 0.5 - Math.random());
        
        // 80/20 split
        const splitIndex = Math.floor(shuffled.length * 0.8);
        const trainSet = shuffled.slice(0, splitIndex);
        const testSet = shuffled.slice(splitIndex);

        await this.trainWithSplit(trainSet, testSet);
    }

    /**
     * Hazır train/test setleriyle eğitim yapar (data leakage olmadan önceden bölünmüş veri için)
     */
    private async trainWithSplit(trainSet: TrainingData[], testSet: TrainingData[]): Promise<void> {
        
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

            // Sadece başlık kullan — en diskriminatif sinyal. LLM metaAciklama boilerplate içerir.
            const rawDataset: TrainingData[] = approvedNews.map(news => ({
                text: news.baslik.trim(),
                category: news.kategori.ad
            }));

            // Kategori bazlı stratified split (önce böl, sonra upsample — data leakage engeli)
            const byCategory: Record<string, TrainingData[]> = {};
            rawDataset.forEach(d => {
                if (!byCategory[d.category]) byCategory[d.category] = [];
                byCategory[d.category].push(d);
            });

            const trainSet: TrainingData[] = [];
            const testSet: TrainingData[] = [];

            for (const [, examples] of Object.entries(byCategory)) {
                if (examples.length < 3) continue; // Kategori guard
                const shuffled = [...examples].sort(() => 0.5 - Math.random());
                const splitIdx = Math.floor(shuffled.length * 0.8);
                const catTrain = shuffled.slice(0, splitIdx);
                const catTest = shuffled.slice(splitIdx);

                // Upsampling sadece train setine uygulanır (test kirletilmez)
                const maxTrainCount = Math.max(...Object.values(byCategory).map(arr => Math.floor(arr.length * 0.8)));
                const target = Math.min(maxTrainCount, catTrain.length * 3); // Max 3x upsampling
                let i = 0;
                const upsampled = [...catTrain];
                while (upsampled.length < target) {
                    upsampled.push({ ...catTrain[i % catTrain.length] });
                    i++;
                }
                trainSet.push(...upsampled);
                testSet.push(...catTest);
            }

            console.log(`[ML] DB'den ${approvedNews.length} haber yüklendi → train: ${trainSet.length} (upsampled), test: ${testSet.length} (temiz)`);
            await this.trainWithSplit(trainSet, testSet);
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
        
        // natural v6 log-probability (negatif değerler) döner.
        // Hassas normalization için en yüksek skoru 0'a çekip (shift) exp alıyoruz (Softmax stability)
        const maxLogVal = Math.max(...classifications.map(c => c.value));
        
        let totalExp = 0;
        const expScores = classifications.map(c => {
            const expVal = Math.exp(c.value - maxLogVal);
            totalExp += expVal;
            return { label: c.label, expVal };
        });

        let bestCategory = 'Bilinmeyen';
        let highestConfidence = 0;

        expScores.forEach(s => {
            const confidence = s.expVal / totalExp;
            scores[s.label] = confidence;
            
            if (confidence > highestConfidence) {
                highestConfidence = confidence;
                bestCategory = s.label;
            }
        });

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
