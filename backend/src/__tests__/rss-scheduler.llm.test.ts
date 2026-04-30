type SchedulerTestSetup = {
    RssScheduler: any;
    mockCreateNews: jest.Mock;
};

async function setupScheduler(consensusEnabled: boolean): Promise<SchedulerTestSetup> {
    jest.resetModules();

    const mockCreateNews = jest.fn().mockResolvedValue({ id: 1 });
    const mockIsDuplicate = jest.fn().mockResolvedValue({ duplicate: false });
    const mockFetchFeed = jest.fn().mockResolvedValue([
        {
            title: 'Mecliste yeni spor düzenlemesi',
            link: 'https://example.com/haber/1',
            contentSnippet: 'Kısa haber özeti',
        },
    ]);

    jest.doMock('../config/constants', () => ({
        RSS_SOURCES: [{ id: 'mock-source', url: 'https://example.com/rss', category: 'Genel' }],
        LLM_PIPELINE_ENABLED: true,
        LLM_DAILY_QUOTA: 100,
        ML_CONFIDENCE_THRESHOLD: 0.65,
        LLM_CONSENSUS_ENABLED: consensusEnabled,
    }));

    jest.doMock('../config/database', () => ({
        prisma: {
            kategori: {
                findMany: jest.fn().mockResolvedValue([
                    { id: 1, ad: 'Genel' },
                    { id: 2, ad: 'Siyaset' },
                ]),
            },
            haber: {
                findMany: jest.fn().mockResolvedValue([]),
            },
        },
    }));

    jest.doMock('../modules/ml/ml.controller', () => ({
        mlService: {
            predictCombinedCategory: jest.fn().mockResolvedValue({ kategori: 'Genel', confidence: 0.60 }),
            analyzeSentiment: jest.fn().mockResolvedValue({ label: 'Nötr' }),
        },
    }));

    jest.doMock('../modules/news/news.service', () => ({
        NewsService: jest.fn().mockImplementation(() => ({
            isDuplicate: mockIsDuplicate,
            createNews: mockCreateNews,
        })),
    }));

    jest.doMock('../modules/rss/rss.service', () => ({
        RssParserService: jest.fn().mockImplementation(() => ({
            fetchFeed: mockFetchFeed,
        })),
    }));

    jest.doMock('../modules/news/content-quality-filter', () => ({
        ContentQualityFilter: jest.fn().mockImplementation(() => ({
            validateQuality: jest.fn().mockReturnValue({ isValid: true }),
        })),
    }));

    const { RssScheduler } = await import('../modules/rss/rss-scheduler');
    return { RssScheduler, mockCreateNews };
}

describe('RssScheduler pending-first davranışı', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('LLM consensus açıkken llmProvider değerini pending yazar', async () => {
        const { RssScheduler, mockCreateNews } = await setupScheduler(true);
        const scheduler = new RssScheduler(10);

        await (scheduler as any).runCycle();

        expect(mockCreateNews).toHaveBeenCalledTimes(1);
        expect(mockCreateNews.mock.calls[0][0].llmProvider).toBe('pending');
    });

    it('LLM consensus kapalıyken llmProvider değerini none yazar', async () => {
        const { RssScheduler, mockCreateNews } = await setupScheduler(false);
        const scheduler = new RssScheduler(10);

        await (scheduler as any).runCycle();

        expect(mockCreateNews).toHaveBeenCalledTimes(1);
        expect(mockCreateNews.mock.calls[0][0].llmProvider).toBe('none');
    });

    it('haber kaydında nbKategoriId ve kategoriId eşit kaydedilir', async () => {
        const { RssScheduler, mockCreateNews } = await setupScheduler(true);
        const scheduler = new RssScheduler(10);

        await (scheduler as any).runCycle();

        expect(mockCreateNews).toHaveBeenCalledTimes(1);
        const payload = mockCreateNews.mock.calls[0][0];
        expect(payload.nbKategoriId).toBe(payload.kategoriId);
    });

    it('haber her zaman durum=ham olarak başlar', async () => {
        const { RssScheduler, mockCreateNews } = await setupScheduler(true);
        const scheduler = new RssScheduler(10);

        await (scheduler as any).runCycle();

        expect(mockCreateNews).toHaveBeenCalledTimes(1);
        expect(mockCreateNews.mock.calls[0][0].durum).toBe('ham');
    });
});
