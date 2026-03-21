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
    if (!url || typeof url !== 'string') {
        res.status(400).json({ success: false, error: 'URL gereklidir' });
        return;
    }

    // SSRF koruması: yalnızca https:// veya http:// ile başlayan harici URL'lere izin ver
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        res.status(400).json({ success: false, error: 'Geçersiz URL formatı' });
        return;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        res.status(400).json({ success: false, error: 'Yalnızca HTTP/HTTPS protokolüne izin verilir' });
        return;
    }
    // İç ağ adreslerini engelle (SSRF)
    const hostname = parsed.hostname.toLowerCase();
    const isInternal = hostname === 'localhost' || hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' || hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') || hostname.startsWith('172.') ||
        hostname.endsWith('.local') || hostname === '::1';
    if (isInternal) {
        res.status(400).json({ success: false, error: 'İç ağ adreslerine erişime izin verilmez' });
        return;
    }

    const isHealthy = await rssService.checkHealth(url);
    res.json({ success: true, url, isHealthy });
});

export const rssRouter = router;
