/**
 * LlmConsensusWorker unit testleri.
 * Prisma ve LLM provider'ları mock'lanır.
 */

jest.mock('../config/database', () => ({
    prisma: {
        haber: {
            findMany: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({}),
        },
        kategori: {
            findFirst: jest.fn(),
        },
    },
}));

jest.mock('../config/constants', () => ({
    LLM_CONSENSUS_ENABLED: true,
    LLM_CONSENSUS_BATCH_SIZE: 10,
    LLM_CONSENSUS_INTERVAL_MS: 30000,
    LLM_CONSENSUS_MAX_RETRIES: 3,
    LLM_API_KEYS: [],
    LLM_API_KEY: '',
    LLM_BASE_URL: 'http://localhost:11434',
    LLM_MODEL_NAME: 'gemini-1.5-flash',
    LLM_FALLBACK_MODEL: 'qwen3:8b',
}));

import { LlmConsensusWorker, VALID_LLM_CATEGORIES } from '../modules/llm/llm-consensus-worker';
import { prisma } from '../config/database';
import { ILLMProvider, LLMResponse } from '../modules/llm/llm.interface';

// Helper: geçerli bir ILLMProvider mock'u oluşturur
function makeMockProvider(content: string): jest.Mocked<ILLMProvider> {
    return {
        name: 'mock',
        generateContent: jest.fn().mockResolvedValue({ content, tokensUsed: 1, provider: 'mock', model: 'mock' } as LLMResponse),
        isAvailable: jest.fn().mockResolvedValue(true),
        estimateCost: jest.fn().mockReturnValue(0),
    };
}

// Testable subclass: protected metodları expose eder
class TestableWorker extends LlmConsensusWorker {
    public testParseCategory(raw: string) { return this._parseCategory(raw); }
    public async testCallLLM(b: string, o: string) { return this._callLLM(b, o); }
    public async testProcessBatch() { return this._processBatch(); }
}

const mockHaber = (overrides: Partial<{
    id: number; baslik: string; metaAciklama: string | null;
    nbKategoriId: number | null; llmRetryCount: number;
}> = {}) => ({
    id: 1,
    baslik: 'Test Başlığı',
    metaAciklama: 'Test özeti',
    nbKategoriId: 5,
    llmRetryCount: 0,
    ...overrides,
});

describe('LlmConsensusWorker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ─── _parseCategory ────────────────────────────────────────────────────────

    describe('_parseCategory', () => {
        const worker = new TestableWorker(makeMockProvider('x'), makeMockProvider('x'));

        test.each(VALID_LLM_CATEGORIES)('geçerli kategoriyi tanır: %s', (cat) => {
            expect(worker.testParseCategory(cat)).toBe(cat);
        });

        it('büyük/küçük harf farketmez', () => {
            expect(worker.testParseCategory('spor')).toBe('Spor');
            expect(worker.testParseCategory('EKONOMİ')).toBe('Ekonomi');
        });

        it('tırnak işaretlerini temizler', () => {
            expect(worker.testParseCategory('"Sağlık"')).toBe('Sağlık');
        });

        it('geçersiz kategori için hata fırlatır', () => {
            expect(() => worker.testParseCategory('Hayvanlar')).toThrow('Geçersiz LLM kategori');
        });

        it('boşluklu geçersiz yanıt için hata fırlatır', () => {
            expect(() => worker.testParseCategory('Spor Haberleri')).toThrow();
        });
    });

    // ─── _callLLM ──────────────────────────────────────────────────────────────

    describe('_callLLM', () => {
        it('Gemini başarılı olduğunda provider=gemini döner', async () => {
            const gemini = makeMockProvider('Spor');
            const ollama = makeMockProvider('Ekonomi');
            const worker = new TestableWorker(gemini, ollama);

            const result = await worker.testCallLLM('Galatasaray maçı', 'Özet');
            expect(result).toEqual({ category: 'Spor', provider: 'gemini' });
            expect(gemini.generateContent).toHaveBeenCalledTimes(1);
            expect(ollama.generateContent).not.toHaveBeenCalled();
        });

        it('Gemini başarısız olduğunda Ollama fallback kullanılır', async () => {
            const gemini = makeMockProvider('Spor');
            (gemini.generateContent as jest.Mock).mockRejectedValue(new Error('API Error'));
            const ollama = makeMockProvider('Teknoloji');
            const worker = new TestableWorker(gemini, ollama);

            const result = await worker.testCallLLM('Yapay zeka', 'Özet');
            expect(result).toEqual({ category: 'Teknoloji', provider: 'ollama' });
            expect(ollama.generateContent).toHaveBeenCalledTimes(1);
        });
    });

    // ─── processNextBatch (no articles) ────────────────────────────────────────

    it('bekleyen makale yoksa güncelleme yapmaz', async () => {
        (prisma.haber.findMany as jest.Mock).mockResolvedValue([]);
        const worker = new TestableWorker(makeMockProvider('Spor'), makeMockProvider('Spor'));

        await worker.processNextBatch();
        expect(prisma.haber.update).not.toHaveBeenCalled();
    });

    // ─── _processArticle – consensus ───────────────────────────────────────────

    it('konsensüs durumunda durum=hazir ve kategoriDogrulandi=true kaydeder', async () => {
        const KATEGORI_ID = 3;
        (prisma.haber.findMany as jest.Mock).mockResolvedValue([
            mockHaber({ nbKategoriId: KATEGORI_ID }),
        ]);
        (prisma.kategori.findFirst as jest.Mock).mockResolvedValue({ id: KATEGORI_ID, ad: 'Teknoloji' });

        const worker = new TestableWorker(makeMockProvider('Teknoloji'), makeMockProvider('Genel'));
        await worker.processNextBatch();

        expect(prisma.haber.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    durum: 'hazir',
                    kategoriDogrulandi: true,
                    llmProvider: 'gemini',
                }),
            }),
        );
        expect(worker.getStatus().consensusCount).toBe(1);
        expect(worker.getStatus().conflictCount).toBe(0);
    });

    // ─── _processArticle – conflict ────────────────────────────────────────────

    it('çakışma durumunda durum değişmez ve kategoriDogrulandi=false kalır', async () => {
        const NB_ID = 2;
        const LLM_ID = 5;
        (prisma.haber.findMany as jest.Mock).mockResolvedValue([
            mockHaber({ nbKategoriId: NB_ID }),
        ]);
        (prisma.kategori.findFirst as jest.Mock).mockResolvedValue({ id: LLM_ID, ad: 'Siyaset' });

        const worker = new TestableWorker(makeMockProvider('Siyaset'), makeMockProvider('Genel'));
        await worker.processNextBatch();

        expect(prisma.haber.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    kategoriDogrulandi: false,
                    llmProvider: 'gemini',
                }),
            }),
        );
        const updateArgs = (prisma.haber.update as jest.Mock).mock.calls[0][0];
        expect(updateArgs.data.durum).toBeUndefined();
        expect(worker.getStatus().conflictCount).toBe(1);
    });

    // ─── _processArticle – retry / dead ────────────────────────────────────────

    it('her iki provider da başarısız olduğunda retry sayacını artırır', async () => {
        (prisma.haber.findMany as jest.Mock).mockResolvedValue([
            mockHaber({ llmRetryCount: 0 }),
        ]);
        const failingGemini = makeMockProvider('x');
        (failingGemini.generateContent as jest.Mock).mockRejectedValue(new Error('fail'));
        const failingOllama = makeMockProvider('x');
        (failingOllama.generateContent as jest.Mock).mockRejectedValue(new Error('fail'));

        const worker = new TestableWorker(failingGemini, failingOllama);
        await worker.processNextBatch();

        expect(prisma.haber.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    llmRetryCount: 1,
                    llmProvider: 'failed',
                }),
            }),
        );
        expect(worker.getStatus().failedCount).toBe(1);
    });

    it('MAX_RETRIES aşıldığında llmProvider=dead olarak işaretler', async () => {
        (prisma.haber.findMany as jest.Mock).mockResolvedValue([
            mockHaber({ llmRetryCount: 2 }), // 2 + 1 = 3 >= MAX_RETRIES(3)
        ]);
        const failingGemini = makeMockProvider('x');
        (failingGemini.generateContent as jest.Mock).mockRejectedValue(new Error('fail'));
        const failingOllama = makeMockProvider('x');
        (failingOllama.generateContent as jest.Mock).mockRejectedValue(new Error('fail'));

        const worker = new TestableWorker(failingGemini, failingOllama);
        await worker.processNextBatch();

        expect(prisma.haber.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    llmRetryCount: 3,
                    llmProvider: 'dead',
                }),
            }),
        );
    });

    it('geçersiz LLM çıktısında retry/dead yerine NB final korunur', async () => {
        const NB_ID = 2;
        (prisma.haber.findMany as jest.Mock).mockResolvedValue([
            mockHaber({ nbKategoriId: NB_ID, llmRetryCount: 1 }),
        ]);

        const invalidGemini = makeMockProvider('Hayvanlar');
        const invalidOllama = makeMockProvider('Kategori: Bilinmiyor');
        const worker = new TestableWorker(invalidGemini, invalidOllama);

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        await worker.processNextBatch();
        warnSpy.mockRestore();

        expect(prisma.haber.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    llmKategoriId: null,
                    kategoriId: NB_ID,
                    durum: 'hazir',
                    kategoriDogrulandi: true,
                    llmProvider: 'none',
                }),
            }),
        );

        const updateArgs = (prisma.haber.update as jest.Mock).mock.calls[0][0];
        expect(updateArgs.data.llmRetryCount).toBeUndefined();
    });

    // ─── re-entrancy guard ─────────────────────────────────────────────────────

    it('aynı anda iki processNextBatch çağrısı olduğunda ikincisi atlanır', async () => {
        let resolveFirst: (() => void) | null = null;
        (prisma.haber.findMany as jest.Mock).mockImplementation(
            () => new Promise<any[]>(res => { resolveFirst = () => res([]); }),
        );

        const worker = new TestableWorker(makeMockProvider('Spor'), makeMockProvider('Spor'));
        const first = worker.processNextBatch(); // will hang waiting for DB
        const second = worker.processNextBatch(); // should be skipped

        resolveFirst!();
        await Promise.all([first, second]);

        expect(prisma.haber.findMany).toHaveBeenCalledTimes(1);
    });
});
