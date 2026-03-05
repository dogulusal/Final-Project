import { Router, Request, Response } from 'express';
import { ContentGenerationService } from './llm.service';

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
