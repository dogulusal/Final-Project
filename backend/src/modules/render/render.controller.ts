import { Router, Request, Response } from 'express';
import { NewsRenderService } from './render.service';
import { RenderPreset, RENDER_PRESET_DIMENSIONS } from './render.interface';

const router = Router();
const renderService = new NewsRenderService();

// Geçerli preset'lerin listesi
const VALID_PRESETS = Object.values(RenderPreset);

router.post('/generate', async (req: Request, res: Response) => {
    const { title, category, source, date, preset } = req.body;

    if (!title) {
        res.status(400).json({ success: false, error: 'title alanı gereklidir' });
        return;
    }

    const selectedPreset = VALID_PRESETS.includes(preset)
        ? preset as RenderPreset
        : RenderPreset.TWITTER_POST; // Varsayılan

    try {
        const result = await renderService.renderNewsImage(
            {
                baslik: title,
                kategori: category || 'Genel',
                kaynak: source || 'AI Haber Ajansı',
                tarih: date || new Date().toLocaleDateString('tr-TR'),
            },
            selectedPreset,
        );

        // Direk PNG olarak döndürüyoruz
        res.set({
            'Content-Type': result.mimeType,
            'Content-Length': result.buffer.length.toString(),
            'X-Image-Width': result.width.toString(),
            'X-Image-Height': result.height.toString(),
        });
        res.send(result.buffer);
    } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Görsel oluşturulamadı' });
    }
});

// Mevcut preset listesini döndüren yardımcı endpoint
router.get('/presets', (_req: Request, res: Response) => {
    res.json({
        success: true,
        presets: Object.entries(RENDER_PRESET_DIMENSIONS).map(([key, dims]) => ({
            name: key,
            width: dims.width,
            height: dims.height,
        })),
    });
});

export const renderRouter = router;
