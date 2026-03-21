import request from 'supertest';
import express from 'express';
import { adminRouter } from '../modules/admin/admin.controller';
import { prisma } from '../config/database';
import { mlService } from '../modules/ml/ml.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { ADMIN_API_KEY } from '../config/constants';

// Mock Dependencies
jest.mock('../config/database', () => ({
    prisma: {
        haber: {
            count: jest.fn(),
            groupBy: jest.fn(),
            findMany: jest.fn(),
            aggregate: jest.fn(),
        },
        kategori: {
            count: jest.fn(),
        }
    }
}));

jest.mock('../modules/rss/rss-scheduler', () => ({
    rssScheduler: {
        getStatus: jest.fn().mockReturnValue({ running: true, lastRun: new Date() }),
        start: jest.fn(),
        stop: jest.fn()
    }
}));

jest.mock('../modules/ml/ml.controller', () => ({
    mlService: {
        getAccuracy: jest.fn(),
    }
}));

// We might want to mock the entire auth middleware if we want to test just the controller, 
// OR keep it to test integration. Let's keep it and pass headers.

const app = express();
app.use(express.json());
app.use('/admin', authMiddleware, adminRouter);

describe('Admin Controller', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /admin/stats', () => {
        it('should return 401 if no API key', async () => {
            const res = await request(app).get('/admin/stats');
            expect(res.status).toBe(401);
        });

        it('should return stats if API key is valid', async () => {
            (prisma.haber.count as jest.Mock).mockResolvedValue(100);
            (prisma.kategori.count as jest.Mock).mockResolvedValue(5);
            (prisma.haber.groupBy as jest.Mock)
                // First call: groupBy durum
                .mockResolvedValueOnce([
                    { durum: 'hazir', _count: { id: 80 } },
                    { durum: 'ham', _count: { id: 20 } }
                ])
                // Second call: groupBy llmProvider
                .mockResolvedValueOnce([
                    { llmProvider: 'gemini', _count: { id: 60 } },
                    { llmProvider: null, _count: { id: 40 } }
                ]);
            (prisma.haber.aggregate as jest.Mock).mockResolvedValue({ _avg: { mlConfidence: 0.85 } });
            (mlService.getAccuracy as jest.Mock).mockResolvedValue({ accuracy: 0.92 });
            (prisma.haber.findMany as jest.Mock).mockResolvedValue([]);

            const res = await request(app)
                .get('/admin/stats')
                .set('x-api-key', ADMIN_API_KEY);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.stats.totalNews).toBe(100);
            expect(res.body.stats.mlAccuracy).toBe("92.0");
            // Yeni alanlar
            expect(res.body.stats.breakdown).toHaveProperty('hazir', 80);
            expect(res.body.stats.breakdown).toHaveProperty('ham', 20);
            expect(res.body.stats.llmBreakdown).toBeDefined();
            expect(res.body.stats.pipeline).toEqual(expect.objectContaining({ dailyQuota: expect.any(Number) }));
        });
    });
});
