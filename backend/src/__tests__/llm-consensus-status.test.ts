/**
 * GET /api/llm/consensus/status endpoint testleri.
 * Express app ve Prisma mock'lanır.
 */

jest.mock('../config/database', () => ({
    prisma: {
        haber: {
            count: jest.fn(),
        },
    },
}));

jest.mock('../modules/llm/llm-consensus-worker.singleton', () => ({
    llmConsensusWorker: {
        getStatus: jest.fn().mockReturnValue({
            isRunning: true,
            isProcessing: false,
            processedCount: 10,
            consensusCount: 8,
            conflictCount: 2,
            failedCount: 0,
        }),
        processNextBatch: jest.fn().mockResolvedValue(undefined),
        start: jest.fn(),
        stop: jest.fn(),
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
    LLMProviderType: { GEMINI: 'gemini', OLLAMA: 'ollama', ANTHROPIC: 'anthropic', OPENAI: 'openai' },
    LLM_PROVIDER: 'ollama',
    LLM_FALLBACK_PROVIDER: null,
}));

import request from 'supertest';
import express from 'express';
import { consensusRouter } from '../modules/llm/llm.controller';
import { prisma } from '../config/database';

const app = express();
app.use(express.json());
app.use('/api/llm/consensus', consensusRouter);

describe('GET /api/llm/consensus/status', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('worker istatistiklerini ve kuyruk sayımlarını döner', async () => {
        (prisma.haber.count as jest.Mock)
            .mockResolvedValueOnce(5)   // pending
            .mockResolvedValueOnce(2)   // failed
            .mockResolvedValueOnce(1);  // dead

        const res = await request(app).get('/api/llm/consensus/status');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.worker.isRunning).toBe(true);
        expect(res.body.worker.processedCount).toBe(10);
        expect(res.body.queue.pendingCount).toBe(5);
        expect(res.body.queue.failedCount).toBe(2);
        expect(res.body.queue.deadCount).toBe(1);
    });

    it('DB hatası durumunda 500 döner', async () => {
        (prisma.haber.count as jest.Mock).mockRejectedValue(new Error('DB down'));

        const res = await request(app).get('/api/llm/consensus/status');

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('DB down');
    });
});

describe('POST /api/llm/consensus/trigger', () => {
    it('worker batch tetikler ve 200 döner', async () => {
        const res = await request(app).post('/api/llm/consensus/trigger');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
