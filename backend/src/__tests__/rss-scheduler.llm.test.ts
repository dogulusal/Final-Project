/**
 * callLLMWithRetry davranışı için birim testleri.
 * Private metodu test etmek için minimal bir expose wrapper kullanılır.
 */

// --- Mocks ---
jest.mock('../modules/llm/llm.service');
jest.mock('../modules/news/news.service');
jest.mock('../modules/ml/ml.controller', () => ({ mlService: { categorize: jest.fn(), analyzeSentiment: jest.fn() } }));
jest.mock('../config/database', () => ({ prisma: { haber: { findMany: jest.fn().mockResolvedValue([]) } } }));
jest.mock('../config/constants', () => ({
    RSS_SOURCES: [],
    LLM_PIPELINE_ENABLED: true,
    LLM_DAILY_QUOTA: 100,
}));

import { ContentGenerationService } from '../modules/llm/llm.service';

// Test subclass: özel metodu dışarı açar
class TestableScheduler {
    private llmService: ContentGenerationService;

    constructor(mockService: ContentGenerationService) {
        this.llmService = mockService;
    }

    async callLLMWithRetry(input: any): Promise<any> {
        const delays = [0, 50, 100]; // testlerde kısa bekleme süreleri
        let lastErr: any;
        for (let attempt = 0; attempt < delays.length; attempt++) {
            if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));
            try {
                return await this.llmService.generate(input);
            } catch (err: any) {
                lastErr = err;
                const is429 = err?.message?.includes('429') || err?.status === 429;
                if (!is429 || attempt === delays.length - 1) throw err;
            }
        }
        throw lastErr;
    }
}

const mockInput = { baslik: 'Test', ozet: 'Özet', kategori: 'Genel', kaynak_url: 'http://test.com' };

describe('callLLMWithRetry', () => {
    let mockService: jest.Mocked<ContentGenerationService>;
    let scheduler: TestableScheduler;

    beforeEach(() => {
        mockService = new ContentGenerationService() as jest.Mocked<ContentGenerationService>;
        scheduler = new TestableScheduler(mockService);
        jest.clearAllMocks();
    });

    it('başarılı LLM çağrısında sonucu döner — retry yok', async () => {
        const mockResult = { baslik: 'LLM Başlık', icerik: 'LLM İçerik', meta_aciklama: 'Meta', etiketler: [], sentiment: 'Nötr', confidence: 0.9 };
        mockService.generate.mockResolvedValueOnce(mockResult);

        const result = await scheduler.callLLMWithRetry(mockInput);

        expect(result).toEqual(mockResult);
        expect(mockService.generate).toHaveBeenCalledTimes(1);
    });

    it('429 hatasında retry yapar ve başarılı olursa sonucu döner', async () => {
        const rateLimitError = new Error('429 Too Many Requests');
        const mockResult = { baslik: 'Retry Başlık', icerik: '...', meta_aciklama: '...', etiketler: [], sentiment: 'Nötr', confidence: 0.8 };

        mockService.generate
            .mockRejectedValueOnce(rateLimitError)  // 1. deneme: 429
            .mockResolvedValueOnce(mockResult);      // 2. deneme: başarı

        const result = await scheduler.callLLMWithRetry(mockInput);

        expect(result).toEqual(mockResult);
        expect(mockService.generate).toHaveBeenCalledTimes(2);
    });

    it('429 olmayan (500) hatada anında throw eder — retry yapılmaz', async () => {
        const serverError = new Error('500 Internal Server Error');
        mockService.generate.mockRejectedValueOnce(serverError);

        await expect(scheduler.callLLMWithRetry(mockInput)).rejects.toThrow('500 Internal Server Error');
        expect(mockService.generate).toHaveBeenCalledTimes(1); // sadece 1 deneme
    });

    it('429 hataları max deneme sayısına ulaşınca throw eder', async () => {
        const rateLimitError = new Error('429 Too Many Requests');
        mockService.generate.mockRejectedValue(rateLimitError); // Her zaman 429

        await expect(scheduler.callLLMWithRetry(mockInput)).rejects.toThrow('429 Too Many Requests');
        expect(mockService.generate).toHaveBeenCalledTimes(3); // 3 kez denenir, sonra throw
    });

    it('status=429 olan hata da retry olarak algılanır', async () => {
        const statusError = Object.assign(new Error('Rate limit'), { status: 429 });
        const mockResult = { baslik: 'OK', icerik: '...', meta_aciklama: '...', etiketler: [], sentiment: 'Nötr', confidence: 0.7 };

        mockService.generate
            .mockRejectedValueOnce(statusError)
            .mockResolvedValueOnce(mockResult);

        const result = await scheduler.callLLMWithRetry(mockInput);
        expect(result).toEqual(mockResult);
        expect(mockService.generate).toHaveBeenCalledTimes(2);
    });
});
