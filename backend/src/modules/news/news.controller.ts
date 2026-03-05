import { Router, Request, Response, NextFunction } from 'express';
import { NewsService } from './news.service';
import { ValidationError } from '../../middleware/error-handler';

const router = Router();
const newsService = new NewsService();

/**
 * 1) GET /api/news
 * Son eklenen haberleri listeler. (?limit=30&status=hazir)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;
        const status = req.query.status as string;

        const items = await newsService.getRecentNews(limit, status);

        res.json({
            success: true,
            count: items.length,
            data: items
        });
    } catch (error) {
        next(error); // Error middleware'e yönlendir
    }
});

/**
 * 2) POST /api/news
 * n8n workflow'u veriyi parse, LLM ve render'dan geçirdikten sonra
 * çıkan nihai sonucu buraya kaydedecek.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { baslik, kategoriId, status } = req.body;

        if (!baslik || typeof baslik !== 'string') {
            throw ValidationError('baslik alani gereklidir.');
        }
        if (!kategoriId || isNaN(parseInt(kategoriId))) {
            throw ValidationError('Geçerli bir kategoriId gereklidir.');
        }

        const savedNews = await newsService.createNews({
            baslik: req.body.baslik,
            icerik: req.body.icerik,
            metaAciklama: req.body.metaAciklama,
            kategoriId: parseInt(kategoriId),
            kaynakUrl: req.body.kaynakUrl,
            gorselUrl: req.body.gorselUrl,
            sentiment: req.body.sentiment,
            durum: status || 'hazir',
            mlConfidence: req.body.mlConfidence,
            llmProvider: req.body.llmProvider
        });

        // Durum Code'u 201 (Created)
        res.status(201).json({
            success: true,
            message: 'Haber başarıyla kaydedildi.',
            data: savedNews
        });
    } catch (error) {
        next(error);
    }
});

/**
 * 3) GET /api/news/:slug
 * Okuyucu tıklayıp haberi okumak istediğinde
 */
router.get('/:slug', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { slug } = req.params;
        const newsItem = await newsService.getNewsBySlug(slug);

        res.json({
            success: true,
            data: newsItem
        });
    } catch (error) {
        next(error);
    }
});

export const newsRouter = router;
