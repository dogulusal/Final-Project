import request from 'supertest';
import express from 'express';
import { adminRouter } from '../modules/admin/admin.controller';
import { prisma } from '../config/database';
import { mlService } from '../modules/ml/ml.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { AuthService } from '../modules/admin/auth.service';
import jwt from 'jsonwebtoken';

// JWT_SECRET'ı test için sabit değere mock et
const TEST_JWT_SECRET = 'test-secret-minimum-32-chars-long-for-tests';
jest.mock('../config/constants', () => ({
    ...jest.requireActual('../config/constants'),
    JWT_SECRET: 'test-secret-minimum-32-chars-long-for-tests',
    ADMIN_API_KEY: '',
    LLM_PIPELINE_ENABLED: true,
    LLM_DAILY_QUOTA: 100
}));

/**
 * Test admin JWT token oluşturucu
 */
function createAdminToken(): string {
    return jwt.sign(
        { id: 1, email: 'admin@test.com', role: 'admin', type: 'access' },
        TEST_JWT_SECRET,
        { expiresIn: '1h', issuer: 'news-agency', audience: 'news-agency-api' } as any
    );
}

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
        },
        disputeQueue: {
            count: jest.fn(),
        },
        llmKullanim: {
            groupBy: jest.fn(),
            aggregate: jest.fn(),
        }
    }
}));

jest.mock('../modules/ml/dispute-queue.service', () => ({
    bridgeHamVerifiedToDisputeQueue: jest.fn().mockResolvedValue({ synced: 0 }),
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

jest.mock('../modules/admin/auth.service', () => ({
    AuthService: {
        login: jest.fn()
    }
}));

jest.mock('../common/auth', () => ({
    createLoginResponse: jest.fn().mockReturnValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer'
    })
}));

jest.mock('../modules/llm/llm-usage', () => ({
    llmUsageService: {
        getStats: jest.fn().mockResolvedValue({
            period: { days: 30 },
            byProvider: [],
            totalCost: 0
        })
    }
}));

const app = express();
app.use(express.json());
app.use('/api/admin', authMiddleware, adminRouter);

describe('Admin Controller', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- Login Tests ---
    describe('POST /api/admin/login', () => {
        it('should return JWT tokens on valid credentials', async () => {
            (AuthService.login as jest.Mock).mockResolvedValue({
                id: 1,
                email: 'admin@newsagency.com',
                ad: 'Admin'
            });

            const res = await request(app)
                .post('/api/admin/login')
                .send({ email: 'admin@newsagency.com', sifre: 'admin123456' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('accessToken');
            expect(res.body.data).toHaveProperty('tokenType', 'Bearer');
        });

        it('should return 401 on invalid credentials', async () => {
            (AuthService.login as jest.Mock).mockRejectedValue(new Error('Hatalı şifre'));

            const res = await request(app)
                .post('/api/admin/login')
                .send({ email: 'admin@newsagency.com', sifre: 'wrong-pass' });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it('should return 400 if email or password missing', async () => {
            const res = await request(app)
                .post('/api/admin/login')
                .send({ email: 'admin@newsagency.com' }); // sifre eksik

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    // --- Stats Endpoint Tests ---
    describe('GET /api/admin/stats', () => {
        it('should return 401 if no token', async () => {
            const res = await request(app).get('/api/admin/stats');
            expect(res.status).toBe(401);
        });

        it('should return 401 with invalid token', async () => {
            const res = await request(app)
                .get('/api/admin/stats')
                .set('Authorization', 'Bearer invalid.token.here');

            expect(res.status).toBe(401);
        });

        it('should return stats with valid JWT token', async () => {
            (prisma.haber.count as jest.Mock)
                .mockResolvedValueOnce(100)
                .mockResolvedValueOnce(70)
                .mockResolvedValueOnce(20);
            (prisma.kategori.count as jest.Mock).mockResolvedValue(5);
            (prisma.disputeQueue.count as jest.Mock).mockResolvedValue(10);
            (prisma.haber.groupBy as jest.Mock)
                .mockResolvedValueOnce([
                    { durum: 'hazir', _count: { id: 80 } },
                    { durum: 'ham', _count: { id: 20 } }
                ])
                .mockResolvedValueOnce([
                    { llmProvider: 'gemini', _count: { id: 60 } },
                    { llmProvider: null, _count: { id: 40 } }
                ]);
            (prisma.haber.aggregate as jest.Mock).mockResolvedValue({ _avg: { mlConfidence: 0.85 }, _count: { mlConfidence: 80 } });
            (mlService.getAccuracy as jest.Mock).mockResolvedValue({ accuracy: 0.92, trainSize: 1000, testSize: 200 });
            (prisma.haber.findMany as jest.Mock).mockResolvedValue([]);

            const token = createAdminToken();
            const res = await request(app)
                .get('/api/admin/stats')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.stats.totalNews).toBe(100);
            expect(res.body.stats.mlAccuracy).toBe('92.0');
            expect(res.body.stats.breakdown).toHaveProperty('hazir', 80);
            expect(res.body.stats.breakdown).toHaveProperty('ham', 20);
            expect(res.body.stats.llmBreakdown).toBeDefined();
            expect(res.body.stats.pipeline).toEqual(
                expect.objectContaining({ dailyQuota: expect.any(Number) })
            );
        });
    });

    // --- LLM Usage Endpoint Tests ---
    describe('GET /api/admin/llm-usage', () => {
        it('should return 401 without token', async () => {
            const res = await request(app).get('/api/admin/llm-usage');
            expect(res.status).toBe(401);
        });

        it('should return LLM usage stats with valid token', async () => {
            const token = createAdminToken();
            const res = await request(app)
                .get('/api/admin/llm-usage')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('period');
            expect(res.body.data).toHaveProperty('byProvider');
            expect(res.body.data).toHaveProperty('totalCost');
        });
    });

    // --- Scheduler Status Tests ---
    describe('GET /api/admin/scheduler-status', () => {
        it('should return 401 without token', async () => {
            const res = await request(app).get('/api/admin/scheduler-status');
            expect(res.status).toBe(401);
        });

        it('should return scheduler status with valid token', async () => {
            const token = createAdminToken();
            const res = await request(app)
                .get('/api/admin/scheduler-status')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
