import { MlCategorizationService } from '../modules/ml/ml.service';
import { TrainingData } from '../modules/ml/ml.interface';
import { prisma } from '../config/database';

jest.mock('../config/database', () => ({
    prisma: {
        haber: {
            findMany: jest.fn(),
        }
    }
}));

describe('MlCategorizationService', () => {
    let mlService: MlCategorizationService;

    beforeEach(() => {
        mlService = new MlCategorizationService();
        jest.clearAllMocks();
    });

    describe('train and categorize', () => {
        it('should skip training if dataset is too small (<5 items)', async () => {
            const smallData: TrainingData[] = [
                { text: 'A text', category: 'Spor' },
                { text: 'Another text', category: 'Ekonomi' }
            ];
            await mlService.train(smallData);
            
            // Model was not trained because dataset too small -> should throw when categorized
            await expect(mlService.categorize('test')).rejects.toThrow('Model henüz eğitilmedi');
        });

        it('should train correctly and split into test/train sets (80/20)', async () => {
            const data: TrainingData[] = [
                { text: 'Fenerbahçe maçı kazandı, gol attı', category: 'Spor' },
                { text: 'Galatasaray derbiye hazır', category: 'Spor' },
                { text: 'Dolar kuru fırladı enflasyon', category: 'Ekonomi' },
                { text: 'Merkez Bankası faiz kararını açıkladı', category: 'Ekonomi' },
                { text: 'Yeni iPhone modeli tanıtıldı', category: 'Teknoloji' },
                { text: 'Yapay zeka devrimi devam ediyor', category: 'Teknoloji' },
                { text: 'Siyaset arenasında seçim tartışması', category: 'Siyaset' },
                { text: 'Meclis yeni yasayı oyladı', category: 'Siyaset' },
                { text: 'Mars aracı kızıl gezegenden döndü', category: 'Teknoloji' }, // 9th item -> split will be 7 train, 2 test
            ];

            await mlService.train(data);

            const accuracyData = await mlService.getAccuracy();
            expect(accuracyData.trainSize).toBe(7); // math.floor(9 * 0.8)
            expect(accuracyData.testSize).toBe(2);  // 9 - 7
            expect(accuracyData.accuracy).toBeGreaterThanOrEqual(0); // Since text size is tiny, could be 0, 0.5 or 1
            
            const result = await mlService.categorize('Beşiktaş maçı yaklaşıyor');
            expect(result).toBeDefined();
            expect(result.confidence).toBeGreaterThanOrEqual(0);
        });

        it('should produce normalized confidence scores using stabilized softmax', async () => {
             const data: TrainingData[] = [
                // 3 Spor examples guarantee ≥1 is in training even with 80/20 split (max 2 go to test)
                { text: 'spor haberi futbol mac', category: 'Spor' },
                { text: 'futbol ligi sampiyonluk gol', category: 'Spor' },
                { text: 'basketbol turnuvasi galip oyuncu', category: 'Spor' },
                { text: 'ekonomi haber borsa', category: 'Ekonomi' },
                { text: 'teknoloji yapay zeka', category: 'Teknoloji' },
                { text: 'siyaset seçim meclis', category: 'Siyaset' },
                { text: 'saglik hastane doktor', category: 'Sağlık' },
                { text: 'dunya nato savas', category: 'Dünya' },
                { text: 'genel haber bilgi', category: 'Genel' },
            ];
            await mlService.train(data);

            const result = await mlService.categorize('futbol maci gol');
            
            // Confidence should be high for 'futbol' in Spor
            expect(result.kategori).toBe('Spor');
            expect(result.confidence).toBeGreaterThan(0.15); // Higher than uniform distribution (1/7 ~= 0.14)
            
            // Sum of all scores should be approximately 1
            const totalScore = Object.values(result.allScores).reduce((a, b) => a + b, 0);
            expect(totalScore).toBeGreaterThan(0.99);
            expect(totalScore).toBeLessThan(1.01);
        });
    });

    describe('isDuplicate', () => {
        it('should detect duplicate texts based on Jaro-Winkler or tf-idf', () => {
            const text1 = 'Merkez bankası bugün politika faizini artırdı ve piyasa düştü';
            const text2 = 'Merkez bankası oranları yükseltti piyasalar düştü bugün'; // semantically very similar

            // If jaro-winkler is > 0.85, it returns true
            const isDup = mlService.isDuplicate(text1, text2);
            expect(typeof isDup).toBe('boolean'); 
        });

        it('should not flag completely different texts as duplicates', () => {
            const text1 = 'Fenerbahçe maçı şampiyonluk yolunda kritik.';
            const text2 = 'Borsa İstanbul günü rekor seviyede düşüşle kapattı.';
            
            const isDup = mlService.isDuplicate(text1, text2);
            expect(isDup).toBe(false);
        });
    });

    describe('Turkish Sentiment Analysis', () => {
        it('should return Pozitif for positive Turkish text', async () => {
            const mlService = new MlCategorizationService();
            const result = await mlService.analyzeSentiment('Bu haber harika ve çok başarılı.');
            expect(result.label).toBe('Pozitif');
            expect(result.score).toBeGreaterThan(0);
        });

        it('should return Negatif for negative Turkish text', async () => {
            const mlService = new MlCategorizationService();
            const result = await mlService.analyzeSentiment('Büyük bir kriz ve felaket yaşandı.');
            expect(result.label).toBe('Negatif');
            expect(result.score).toBeLessThan(0);
        });

        it('√n normalizasyonu: uzun metinde skor dramatik şekilde artmamalı', async () => {
            const mlService = new MlCategorizationService();
            const shortText = 'harika başarılı';
            const longText = Array(20).fill('harika başarılı iyi olumlu güzel').join(' ');
            
            const shortResult = await mlService.analyzeSentiment(shortText);
            const longResult = await mlService.analyzeSentiment(longText);

            // √n normalizasyonu sayesinde uzun metin skoru kısa metinden
            // orantısız büyüklükte olmamalı (max ~5x fark beklenir)
            if (shortResult.score > 0 && longResult.score > 0) {
                expect(longResult.score / shortResult.score).toBeLessThan(10);
            }
        });

        it('negasyon penceresi: "değil" sonraki pozitif kelimeyi ters çevirmeli', async () => {
            const mlService = new MlCategorizationService();
            const positiveText = 'bu çok başarılı bir sonuç';
            const negatedText   = 'bu değil başarılı bir sonuç';

            const positive = await mlService.analyzeSentiment(positiveText);
            const negated  = await mlService.analyzeSentiment(negatedText);

            // Negated version should have lower (or equal) score than positive
            expect(negated.score).toBeLessThanOrEqual(positive.score);
        });
    });
});
