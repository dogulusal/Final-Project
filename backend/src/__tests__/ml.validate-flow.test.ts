jest.mock('../config/database', () => ({
    prisma: {
        $transaction: jest.fn(async (ops: Array<Promise<any>>) => Promise.all(ops)),
        haber: {
            update: jest.fn(),
        },
        manuelValidasyon: {
            create: jest.fn().mockResolvedValue({ id: 1 }),
        },
    },
}));

jest.mock('../modules/ml/ml.service', () => ({
    MlCategorizationService: jest.fn().mockImplementation(() => ({
        loadAndTrainFromDB: jest.fn().mockResolvedValue(true),
        loadAndTrainFromDiskFallback: jest.fn().mockResolvedValue(true),
    })),
}));

import express from 'express';
import request from 'supertest';
import { mlProtectedRouter } from '../modules/ml/ml.controller';
import { prisma } from '../config/database';

const app = express();
app.use(express.json());
app.use('/api/ml', mlProtectedRouter);

describe('PUT /api/ml/validate-batch skip behavior', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (prisma.haber.update as jest.Mock).mockResolvedValue({});
        (prisma.manuelValidasyon.create as jest.Mock).mockResolvedValue({ id: 1 });
    });

    it('skip kararında haber alanlarını değiştirmez ve durum ham kalır', async () => {
        const payload = {
            batchId: 'batch-skip-test',
            validatedBy: 'cli@test',
            decisions: [
                {
                    haberId: 101,
                    eskiKategoriId: 2,
                    yeniKategoriId: 5,
                    kararTuru: 'skip',
                },
            ],
        };

        const res = await request(app).put('/api/ml/validate-batch').send(payload);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(prisma.haber.update).not.toHaveBeenCalled();
        expect(prisma.manuelValidasyon.create).toHaveBeenCalledTimes(1);
        expect(prisma.manuelValidasyon.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    kararTuru: 'skip',
                    notlar: 'Atlandı',
                }),
            }),
        );
    });
});
