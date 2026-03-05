import { Router, Request, Response } from 'express';
import { RssParserService } from './rss.service';
import { IRssSource } from './rss.interface';

const router = Router();
const rssService = new RssParserService();

// Test kaynakları
const TEST_SOURCES: IRssSource[] = [
    { id: '1', name: 'NTV Son Dakika', url: 'https://www.ntv.com.tr/son-dakika.rss', category: 'Genel' },
    { id: '2', name: 'BBC Türkçe', url: 'https://feeds.bbci.co.uk/turkce/rss.xml', category: 'Dünya' }
];

router.get('/test', async (_req: Request, res: Response) => {
    try {
        const results = await rssService.fetchAllFeeds(TEST_SOURCES);

        // Güvenlik: En fazla ilk 5 haberi dönelim
        res.json({
            success: true,
            totalItems: results.length,
            sample: results.slice(0, 5)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Bilinmeyen hata'
        });
    }
});

router.post('/health', async (req: Request, res: Response) => {
    const { url } = req.body;
    if (!url) {
        res.status(400).json({ success: false, error: 'URL gereklidir' });
        return;
    }

    const isHealthy = await rssService.checkHealth(url);
    res.json({ success: true, url, isHealthy });
});

export const rssRouter = router;
