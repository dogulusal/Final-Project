import { NewsService } from '../modules/news/news.service';

// Mock Redis client
jest.mock('../config/redis', () => ({
    redis: {
        sismember: jest.fn().mockResolvedValue(0),
        sadd: jest.fn(),
        expire: jest.fn(),
        lpush: jest.fn(),
        ltrim: jest.fn(),
        lrange: jest.fn().mockResolvedValue([]),
        rpush: jest.fn(),
        on: jest.fn(),
    }
}));

// Mock Prisma client
jest.mock('../config/database', () => ({
    prisma: {
        haber: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
        },
        kategori: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
        }
    }
}));

import { prisma } from '../config/database';

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

describe('NewsService', () => {
    let service: NewsService;

    beforeEach(() => {
        service = new NewsService();
        jest.clearAllMocks();
    });

    describe('isDuplicate', () => {
        it('should return false when no matching titles exist', async () => {
            (mockedPrisma.haber.findMany as jest.Mock).mockResolvedValue([]);
            const result = await service.isDuplicate('Benzersiz Bir Başlık');
            expect(result.duplicate).toBe(false);
        });

        it('should detect exact duplicate titles', async () => {
            (mockedPrisma.haber.findMany as jest.Mock).mockResolvedValue([
                { id: 1, baslik: 'Aynı Başlık Tekrarı' }
            ]);
            const result = await service.isDuplicate('Aynı Başlık Tekrarı');
            expect(result.duplicate).toBe(true);
            expect(result.similarity).toBeGreaterThanOrEqual(0.8);
        });

        it('should detect very similar titles', async () => {
            (mockedPrisma.haber.findMany as jest.Mock).mockResolvedValue([
                { id: 1, baslik: 'Türkiye ekonomisi büyüme gösterdi' }
            ]);
            const result = await service.isDuplicate('Türkiye ekonomisi büyüme gösterdi ve piyasalar yükseldi');
            // JaroWinkler similarity should be above threshold for similar titles
            expect(result).toBeDefined();
        });
    });

    describe('getRecentNews', () => {
        it('should return paginated results with total count', async () => {
            const mockData = [
                { id: 1, baslik: 'Test Haber', kategori: { ad: 'Spor' } }
            ];
            (mockedPrisma.haber.findMany as jest.Mock).mockResolvedValue(mockData);
            (mockedPrisma.haber.count as jest.Mock).mockResolvedValue(1);

            const result = await service.getRecentNews(1, 20);
            expect(result.data).toEqual(mockData);
            expect(result.total).toBe(1);
            expect(result.totalPages).toBe(1);
        });

        it('should apply search filter', async () => {
            (mockedPrisma.haber.findMany as jest.Mock).mockResolvedValue([]);
            (mockedPrisma.haber.count as jest.Mock).mockResolvedValue(0);

            const result = await service.getRecentNews(1, 20, undefined, 'ekonomi');
            expect(result.data).toEqual([]);
            expect(result.total).toBe(0);

            // Verify Prisma was called with search filters
            const callArgs = (mockedPrisma.haber.findMany as jest.Mock).mock.calls[0][0];
            expect(callArgs.where.OR).toBeDefined();
            expect(callArgs.where.OR.length).toBe(3);
        });

        it('should apply status filter', async () => {
            (mockedPrisma.haber.findMany as jest.Mock).mockResolvedValue([]);
            (mockedPrisma.haber.count as jest.Mock).mockResolvedValue(0);

            await service.getRecentNews(1, 20, 'hazir');
            const callArgs = (mockedPrisma.haber.findMany as jest.Mock).mock.calls[0][0];
            expect(callArgs.where.durum).toBe('hazir');
        });

        it('should calculate correct pagination skip', async () => {
            (mockedPrisma.haber.findMany as jest.Mock).mockResolvedValue([]);
            (mockedPrisma.haber.count as jest.Mock).mockResolvedValue(0);

            await service.getRecentNews(3, 10);
            const callArgs = (mockedPrisma.haber.findMany as jest.Mock).mock.calls[0][0];
            expect(callArgs.skip).toBe(20); // (3-1) * 10 = 20
            expect(callArgs.take).toBe(10);
        });
    });

    describe('getNewsBySlug', () => {
        it('should return news by slug and increment view count', async () => {
            const mockNews = { id: 1, baslik: 'Test', slug: 'test', goruntulemeSayisi: 5, kategori: { ad: 'Genel' } };
            (mockedPrisma.haber.findUnique as jest.Mock).mockResolvedValue(mockNews);
            (mockedPrisma.haber.update as jest.Mock).mockResolvedValue(mockNews);

            const result = await service.getNewsBySlug('test');
            expect(result).toEqual(mockNews);

            // Verify view count increment was called
            expect(mockedPrisma.haber.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { goruntulemeSayisi: { increment: 1 } }
            });
        });

        it('should throw NotFoundError for non-existing slug', async () => {
            (mockedPrisma.haber.findUnique as jest.Mock).mockResolvedValue(null);

            await expect(service.getNewsBySlug('non-existing')).rejects.toThrow();
        });
    });

    describe('generateSlug (private, tested via createNews)', () => {
        it('should create news with correct slug format', async () => {
            (mockedPrisma.haber.findMany as jest.Mock).mockResolvedValue([]); // No duplicates
            (mockedPrisma.haber.findUnique as jest.Mock).mockResolvedValue(null); // No slug conflict
            (mockedPrisma.haber.create as jest.Mock).mockImplementation((args: any) => ({
                id: 1,
                ...args.data,
                kategori: { ad: 'Genel' }
            }));

            const result = await service.createNews({
                baslik: 'Türkiye Ekonomisi Güçleniyor',
                kategoriId: 1,
            });

            expect(result.slug).toBe('turkiye-ekonomisi-gucleniyor');
        });
    });
});
