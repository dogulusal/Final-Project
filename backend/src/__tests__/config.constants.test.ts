/**
 * Config constants test — consensus pipeline settings
 * TDD: these tests FAIL before LLM_CONSENSUS_* constants are exported from constants.ts
 */

describe('LLM Consensus Worker Constants', () => {
    beforeEach(() => {
        jest.resetModules();
        // Clear env vars so defaults are tested
        delete process.env.LLM_CONSENSUS_ENABLED;
        delete process.env.LLM_CONSENSUS_BATCH_SIZE;
        delete process.env.LLM_CONSENSUS_INTERVAL_MS;
        delete process.env.LLM_CONSENSUS_MAX_RETRIES;
    });

    it('LLM_CONSENSUS_ENABLED defaults to true', async () => {
        const { LLM_CONSENSUS_ENABLED } = await import('../config/constants');
        expect(LLM_CONSENSUS_ENABLED).toBe(true);
    });

    it('LLM_CONSENSUS_BATCH_SIZE defaults to 10', async () => {
        const { LLM_CONSENSUS_BATCH_SIZE } = await import('../config/constants');
        expect(LLM_CONSENSUS_BATCH_SIZE).toBe(10);
    });

    it('LLM_CONSENSUS_INTERVAL_MS defaults to 30000', async () => {
        const { LLM_CONSENSUS_INTERVAL_MS } = await import('../config/constants');
        expect(LLM_CONSENSUS_INTERVAL_MS).toBe(30000);
    });

    it('LLM_CONSENSUS_MAX_RETRIES defaults to 3', async () => {
        const { LLM_CONSENSUS_MAX_RETRIES } = await import('../config/constants');
        expect(LLM_CONSENSUS_MAX_RETRIES).toBe(3);
    });

    it('LLM_CONSENSUS_ENABLED reads from env var', async () => {
        process.env.LLM_CONSENSUS_ENABLED = 'false';
        const { LLM_CONSENSUS_ENABLED } = await import('../config/constants');
        expect(LLM_CONSENSUS_ENABLED).toBe(false);
    });

    it('LLM_CONSENSUS_BATCH_SIZE reads from env var', async () => {
        process.env.LLM_CONSENSUS_BATCH_SIZE = '20';
        const { LLM_CONSENSUS_BATCH_SIZE } = await import('../config/constants');
        expect(LLM_CONSENSUS_BATCH_SIZE).toBe(20);
    });
});
