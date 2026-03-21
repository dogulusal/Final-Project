import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database';
import { mlService } from '../ml/ml.controller';
import { LLM_PIPELINE_ENABLED, LLM_DAILY_QUOTA } from '../../config/constants';
import fs from 'fs';
import path from 'path';

const router = Router();

/**
 * GET /api/admin/stats
 * Yönetici paneli için gerçek verileri döner.
 */
router.get('/stats', async (_req: Request, res: Response) => {
    try {
        const [totalNews, activeCategories, newsByDurum, newsByLlmProvider] = await Promise.all([
            prisma.haber.count(),
            prisma.kategori.count(),
            prisma.haber.groupBy({
                by: ['durum'],
                _count: { id: true }
            }),
            prisma.haber.groupBy({
                by: ['llmProvider'],
                _count: { id: true }
            })
        ]);

        // Ortalama Güven Skoru
        const confidenceStats = await prisma.haber.aggregate({
            _avg: {
                mlConfidence: true
            },
            where: {
                mlConfidence: { not: null }
            }
        });

        // Gerçek ML Doğruluğu
        const mlPerformance = await mlService.getAccuracy();

        // Son Kategorizasyon İşlemleri (Gerçek Veri)
        const recentCategorizations = await prisma.haber.findMany({
            where: {
                mlConfidence: { not: null }
            },
            take: 5,
            orderBy: {
                yayinlanmaTarihi: 'desc'
            },
            include: {
                kategori: true
            }
        });

        // A/B Test Sayısı (Dosya sisteminden)
        let abTestCount = 0;
        try {
            const abTestsDir = path.resolve(__dirname, '../../../../training/ab-tests');
            if (fs.existsSync(abTestsDir)) {
                abTestCount = fs.readdirSync(abTestsDir).filter(f => f.endsWith('.json')).length;
            }
        } catch (e) {
            console.error('[Admin Stats] A/B test dizini okunamadı:', e);
        }

        res.json({
            success: true,
            stats: {
                totalNews,
                activeCategories,
                mlAccuracy: (mlPerformance.accuracy * 100).toFixed(1),
                avgConfidence: confidenceStats._avg.mlConfidence ? (confidenceStats._avg.mlConfidence * 100).toFixed(1) : 0,
                abTestCount,
                recentCategorizations: recentCategorizations.map(h => ({
                    id: h.id,
                    baslik: h.baslik,
                    tahmin: h.kategori.ad,
                    guven: (h.mlConfidence! * 100).toFixed(1),
                    tarih: h.yayinlanmaTarihi
                })),
                breakdown: newsByDurum.reduce((acc: any, curr) => {
                    acc[curr.durum] = curr._count.id;
                    return acc;
                }, {}),
                llmBreakdown: newsByLlmProvider.reduce((acc: any, curr) => {
                    acc[curr.llmProvider ?? 'bilinmiyor'] = curr._count.id;
                    return acc;
                }, {}),
                pipeline: {
                    enabled: LLM_PIPELINE_ENABLED,
                    dailyQuota: LLM_DAILY_QUOTA,
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'İstatistikler alınamadı' });
    }
});

import { rssScheduler } from '../rss/rss-scheduler';

router.get('/scheduler-status', (req: Request, res: Response) => {
    try {
        const status = rssScheduler.getStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Scheduler durumu alınamadı' });
    }
});

export const adminRouter = router;
