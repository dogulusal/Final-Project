import { Router, Request, Response, NextFunction } from 'express';
import { NewsService, newsEventEmitter } from './news.service';
import { ValidationError } from '../../middleware/error-handler';

const router = Router();
const newsService = new NewsService();

/**
 * 0) GET /api/news/live
 * SSE Endpoint for Real-time Breaking News (Faz 4)
 */
router.get('/live', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Bağlantı kopmaması için periyodik Heartbeat
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 30000);

    const onNewNews = (news: any) => {
        res.write(`data: ${JSON.stringify(news)}\n\n`);
    };

    newsEventEmitter.on('new-news', onNewNews);

    req.on('close', () => {
        clearInterval(heartbeat);
        newsEventEmitter.off('new-news', onNewNews);
    });
});

/**
 * 1) GET /api/news
 * Son eklenen haberleri listeler. (?limit=30&status=hazir)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const status = req.query.status as string;
        const search = req.query.search as string;

        const result = await newsService.getRecentNews(page, limit, status, search);

        res.json({
            success: true,
            count: result.data.length,
            total: result.total,
            totalPages: result.totalPages,
            page,
            data: result.data
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
        const { baslik, kategoriId, kategoriAd, status } = req.body;

        if (!baslik || typeof baslik !== 'string') {
            throw ValidationError('baslik alani gereklidir.');
        }

        let dbKategoriId = parseInt(kategoriId);

        // n8n'den gelen string kategori adını (örn: "Teknoloji") ID'ye dönüştür
        if (isNaN(dbKategoriId) && kategoriAd) {
            const { PrismaClient } = require('@prisma/client');
            const prisma = new PrismaClient();
            const foundCat = await prisma.kategori.findFirst({ where: { ad: kategoriAd } });
            if (foundCat) {
                dbKategoriId = foundCat.id;
            } else {
                dbKategoriId = 7; // 7 = 'Genel' kategorisi fallback olarak
            }
        }

        if (isNaN(dbKategoriId)) {
            throw ValidationError('Geçerli bir kategoriId veya kategoriAd gereklidir.');
        }

        let parsedConfidence: number | undefined = undefined;
        if (req.body.mlConfidence !== undefined && req.body.mlConfidence !== null) {
            parsedConfidence = parseFloat(req.body.mlConfidence);
        }

        const savedNews = await newsService.createNews({
            baslik: req.body.baslik,
            icerik: req.body.icerik,
            metaAciklama: req.body.metaAciklama,
            kategoriId: dbKategoriId,
            kaynakUrl: req.body.kaynakUrl,
            gorselUrl: req.body.gorselUrl,
            sentiment: req.body.sentiment,
            durum: status || 'ham',
            mlConfidence: parsedConfidence,
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
 * 3) POST /api/news/check-duplicate
 * n8n workflow'u: Haberin daha önce kaydedilip kaydedilmediğini kontrol eder.
 */
router.post('/check-duplicate', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { title } = req.body;

        if (!title || typeof title !== 'string') {
            throw ValidationError('Lütfen kontrol edilecek başlığı (title) body içerisinde gönderin.');
        }

        const result = await newsService.isDuplicate(title);

        res.json({
            success: true,
            is_duplicate: result.duplicate,
            similarity: result.similarity || 0,
            matched_title: result.matchedTitle || null
        });
    } catch (error) {
        next(error);
    }
});

/**
 * 4) GET /api/news/:slug
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
