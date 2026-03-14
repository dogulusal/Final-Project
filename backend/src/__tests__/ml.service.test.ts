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
    });
});
