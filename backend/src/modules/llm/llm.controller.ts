import { Router, Request, Response } from 'express';
import { ContentGenerationService } from './llm.service';
import { llmConsensusWorker } from './llm-consensus-worker.singleton';
import { prisma } from '../../config/database';

const router = Router();
const llmService = new ContentGenerationService();

router.post('/generate', async (req: Request, res: Response) => {
    const { title, summary, category, url } = req.body;

    if (!title || !summary) {
        res.status(400).json({ success: false, error: 'title ve summary alanları gereklidir' });
        return;
    }

    try {
        console.log(`[LLM Controller] Özgünleştirme isteği alındı: "${title}"`);
        const result = await llmService.generate({
            baslik: title,
            ozet: summary,
            kategori: category || 'Genel',
            kaynak_url: url || 'Bilinmeyen Kaynak'
        });

        res.json({
            success: true,
            original_title: title,
            generated: result
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' });
    }
});

export const llmRouter = router;

// --- Consensus Pipeline Status & Control ---
const consensusRouter = Router();

consensusRouter.get('/status', async (_req: Request, res: Response) => {
    try {
        const [pendingCount, failedCount, deadCount] = await Promise.all([
            prisma.haber.count({ where: { llmProvider: 'pending' } }),
            prisma.haber.count({ where: { llmProvider: 'failed' } }),
            prisma.haber.count({ where: { llmProvider: 'dead' } }),
        ]);
        res.json({
            success: true,
            worker: llmConsensusWorker.getStatus(),
            queue: { pendingCount, failedCount, deadCount },
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' });
    }
});

consensusRouter.post('/trigger', async (_req: Request, res: Response) => {
    try {
        llmConsensusWorker.processNextBatch();
        res.json({ success: true, message: 'Batch tetiklendi.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' });
    }
});

export { consensusRouter };
