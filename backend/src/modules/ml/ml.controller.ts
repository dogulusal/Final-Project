import { Router, Request, Response } from 'express';
import { MlCategorizationService } from './ml.service';

const router = Router();
const mlService = new MlCategorizationService();

// Sisteme başladığında otomatik olarak diskteki JSON modeli yükle ve eğit
mlService.loadAndTrainFromDisk().then(success => {
    if (success) {
        console.log('[ML Controller] Model hazır ve gelen isteklere açık.');
    }
});

router.post('/train', async (_req: Request, res: Response) => {
    try {
        const success = await mlService.loadAndTrainFromDisk();
        if (success) {
            res.json({ success: true, message: 'Model diskteki dataset.json üzerinden başarıyla eğitildi.' });
        } else {
            res.status(500).json({ success: false, message: 'Model eğitimi başarısız oldu.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' });
    }
});

router.get('/categorize', async (req: Request, res: Response) => {
    const title = req.query.title as string;

    if (!title) {
        res.status(400).json({ success: false, error: 'Lütfen tahmin edilecek başlığı (title) query parametresi olarak gönderin.' });
        return;
    }

    try {
        const result = await mlService.categorize(title);
        res.json({
            success: true,
            query: title,
            kategori: result.kategori,
            guven_skoru: result.confidence,
            detayli_skorlar: result.allScores,
            uyari: result.confidence < 0.60 ? 'Düşük güven skoru - İnsan incelemesi gerekebilir' : null
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' });
    }
});

export const mlRouter = router;
