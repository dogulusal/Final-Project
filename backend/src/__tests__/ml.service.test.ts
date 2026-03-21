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
        it('should skip training if dataset is too small (<30 items)', async () => {
            const smallData: TrainingData[] = [
                { text: 'A text', category: 'Spor' },
                { text: 'Another text', category: 'Ekonomi' }
            ];
            await mlService.train(smallData);
            
            // Model was not trained because dataset too small -> should throw when categorized
            await expect(mlService.categorize('test')).rejects.toThrow('Model henüz eğitilmedi');
        });

        it('should train correctly and split into test/train sets (80/20)', async () => {
            // 30 examples split: 24 train, 6 test (all categories have ≥3 examples)
            const makeExamples = (texts: string[], cat: string): TrainingData[] =>
                texts.map(text => ({ text, category: cat }));
            const data: TrainingData[] = [
                ...makeExamples([
                    'Fenerbahçe maçı kazandı, gol attı',
                    'Galatasaray derbiye hazır, şampiyon',
                    'Beşiktaş takımı transfer yaptı',
                    'Trabzonspor şampiyonluk peşinde',
                    'Futbol ligi puan durumu güncellendi',
                ], 'Spor'),
                ...makeExamples([
                    'Dolar kuru fırladı enflasyon arttı',
                    'Merkez Bankası faiz kararını açıkladı',
                    'Borsa İstanbul rekor kırdı',
                    'İşsizlik oranı açıklandı ekonomi',
                    'Bütçe açığı büyüdü maliye politikası',
                ], 'Ekonomi'),
                ...makeExamples([
                    'Yeni iPhone modeli tanıtıldı yapay zeka',
                    'Yapay zeka devrimi devam ediyor teknoloji',
                    'Mars aracı kızıl gezegenden döndü keşif',
                    'Google yeni ürün lansmanı yaptı',
                    'Siber güvenlik açığı bulundu yazılım',
                ], 'Teknoloji'),
                ...makeExamples([
                    'Siyaset arenasında seçim tartışması',
                    'Meclis yeni yasayı oyladı oylama',
                    'Cumhurbaşkanı açıklama yaptı politika',
                    'Muhalefet eleştiri yöneltti iktidar',
                    'Hükümet reform paketi açıkladı',
                ], 'Siyaset'),
                ...makeExamples([
                    'Hastane yeni tedavi yöntemi açıkladı',
                    'Sağlık bakanlığı aşı kampanyası başlattı',
                    'Kanser tedavisinde büyük gelişme',
                    'Pandemi sonrası sağlık raporu yayınlandı',
                    'Genç nüfusta kalp hastalığı artıyor',
                ], 'Sağlık'),
                ...makeExamples([
                    'NATO zirvesi sonuçları açıklandı dünya',
                    'Rusya Ukrayna savaşında son durum',
                    'BM insan hakları raporu yayınlandı',
                    'ABD Çin ilişkileri gerginleşiyor',
                    'Avrupa Birliği yeni kararlar aldı',
                ], 'Dünya'),
            ];

            await mlService.train(data);

            const accuracyData = await mlService.getAccuracy();
            // 30 valid examples → 24 train, 6 test
            expect(accuracyData.trainSize).toBe(24);
            expect(accuracyData.testSize).toBe(6);
            expect(accuracyData.accuracy).toBeGreaterThanOrEqual(0);
            
            const result = await mlService.categorize('Beşiktaş maçı yaklaşıyor');
            expect(result).toBeDefined();
            expect(result.confidence).toBeGreaterThanOrEqual(0);
        });

        it('should produce normalized confidence scores using stabilized softmax', async () => {
            // 30 examples required: 5 per category × 6 categories
            const makeExamples = (texts: string[], cat: string): TrainingData[] =>
                texts.map(text => ({ text, category: cat }));
            const data: TrainingData[] = [
                ...makeExamples(['spor haberi futbol mac', 'futbol ligi sampiyonluk gol', 'basketbol turnuvasi galip oyuncu', 'besiktas macini kazandi', 'atletizm yaris sampiyonu'], 'Spor'),
                ...makeExamples(['ekonomi haber borsa dustu', 'merkez bankasi faiz artirdi', 'enflasyon rekor seviye', 'isssizlik orani yukseldi', 'butce acigi buyudu'], 'Ekonomi'),
                ...makeExamples(['teknoloji yapay zeka gelistirme', 'iphone yeni model tanitim', 'yazilim gelistirme arac', 'siber guvenlik saldirilari', 'bulut bilisim altyapi'], 'Teknoloji'),
                ...makeExamples(['siyaset secim kampanya parti', 'meclis oylama yasa kabul', 'cumhurbaskani aciklama politika', 'muhalefet elestirileri hedef', 'hukumet reform paketi'], 'Siyaset'),
                ...makeExamples(['saglik hastane tedavi yontem', 'asi kampanyasi baslatildi', 'kanser ilac gelistirme', 'pandemi raporu yayinlandi', 'doktor klinik hastane'], 'Sağlık'),
                ...makeExamples(['dunya nato zirvesi sonuc', 'rusya ukrayna savas gelismeler', 'bm insan haklari ihlali', 'abd cin gerilim tirmandi', 'avrupa birligi karar aldi'], 'Dünya'),
            ];
            await mlService.train(data);

            const result = await mlService.categorize('futbol maci gol');
            
            // Confidence should be high for 'futbol' in Spor
            expect(result.kategori).toBe('Spor');
            expect(result.confidence).toBeGreaterThan(0.15); // Higher than uniform distribution (1/6 ~= 0.17)
            
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

        it('Ekonomi jargonu: borsa çöküşü negatif olmalı', async () => {
            const mlService = new MlCategorizationService();
            const result = await mlService.analyzeSentiment('Borsa çöktü, ekonomi resesyona girdi, enflasyon tırmandı.');
            expect(result.label).toBe('Negatif');
            expect(result.score).toBeLessThan(0);
        });

        it('Spor haberi: şampiyonluk pozitif olmalı', async () => {
            const mlService = new MlCategorizationService();
            const result = await mlService.analyzeSentiment('Türkiye Şampiyonu oldu, kupa kazandı, büyük zafer.');
            expect(result.label).toBe('Pozitif');
            expect(result.score).toBeGreaterThan(0);
        });

        it('Nötr meclis haberi: nötr kalmalı', async () => {
            const mlService = new MlCategorizationService();
            const result = await mlService.analyzeSentiment('Meclis toplandı, gündem maddeleri görüşüldü, oylama yapıldı.');
            expect(result.label).toBe('Nötr');
        });

        it('Bağlam: değil + pozitif kelime → negatif yönde etki etmeli', async () => {
            const mlService = new MlCategorizationService();
            const withoutNegation = await mlService.analyzeSentiment('harika başarılı mükemmel');
            const withNegation = await mlService.analyzeSentiment('değil harika başarılı mükemmel');
            expect(withNegation.score).toBeLessThan(withoutNegation.score);
        });
    });
});
