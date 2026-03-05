import { Router, Request, Response, NextFunction } from 'express';
import { SocialService } from './social.service';
import { ValidationError } from '../../middleware/error-handler';

const router = Router();
const socialService = new SocialService();

router.post('/publish', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { baslik, ozet, gorsel_url, haber_url, etiketler } = req.body;

        if (!baslik || !ozet || !haber_url) {
            throw ValidationError("baslik, ozet ve haber_url alanları gereklidir.");
        }

        const payload = {
            baslik,
            ozet,
            gorsel_url: gorsel_url || "",
            haber_url,
            etiketler: etiketler || []
        };

        const results = await socialService.publishAll(payload);

        res.status(200).json({
            success: true,
            message: "Sosyal medya paylaşımları simüle edildi.",
            data: results
        });
    } catch (error) {
        next(error);
    }
});

export const socialRouter = router;
