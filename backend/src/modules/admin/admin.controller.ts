import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database';
import { mlService } from '../ml/ml.controller';
import { LLM_PIPELINE_ENABLED, LLM_DAILY_QUOTA } from '../../config/constants';
import { verifyJwtToken } from '../../middleware/auth.middleware';
import { requireRole, UserRole } from '../../middleware/role.middleware';
import { createLoginResponse } from '../../common/auth';
import { AuthService } from './auth.service';
import { loginLimiter } from '../../middleware/rate-limiters';
import { cacheMiddleware } from '../../middleware/cache.middleware';
import fs from 'fs';
import path from 'path';

const router = Router();

/**
 * POST /api/auth/login
 * Email ve şifre ile giriş yap, JWT token al
 * Rate limited: 5 requests per 15 minutes per IP
 */
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
    try {
        const { email, sifre } = req.body;

        if (!email || !sifre) {
            return res.status(400).json({
                success: false,
                error: 'Email ve şifre gereklidir'
            });
        }

        // Kullanıcı doğrula
        const user = await AuthService.login(email, sifre);

        // JWT token'ları oluştur
        const tokens = createLoginResponse(user.id, user.email, 'admin' as any);

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    ad: user.ad
                },
                ...tokens
            }
        });
    } catch (error: any) {
        console.error('[Auth] Login hatası:', error.message);
        res.status(401).json({
            success: false,
            error: error.message || 'Giriş başarısız'
        });
    }
});

/**
 * GET /api/admin/stats
 * Yönetici paneli için gerçek verileri döner.
 * Auth: JWT token required, admin role required
 */
router.get('/stats', verifyJwtToken, requireRole([UserRole.ADMIN]), cacheMiddleware(30), async (_req: Request, res: Response) => {
    try {
        const [
            totalNews,
            activeCategories,
            newsByDurum,
            newsByLlmProvider,
            verifiedRecords,
            pendingRecords,
            disputedRecords
        ] = await Promise.all([
            prisma.haber.count(),
            prisma.kategori.count(),
            prisma.haber.groupBy({
                by: ['durum'],
                _count: { id: true }
            }),
            prisma.haber.groupBy({
                by: ['llmProvider'],
                _count: { id: true }
            }),
            prisma.haber.count({
                where: {
                    kategoriDogrulandi: true
                } as any
            }),
            prisma.haber.count({
                where: {
                    durum: 'ham',
                    kategoriDogrulandi: false
                } as any
            }),
            prisma.disputeQueue.count({
                where: {
                    durum: 'bekliyor'
                } as any
            })
        ]);

        // Ortalama Güven Skoru
        const confidenceStats = await prisma.haber.aggregate({
            _avg: {
                mlConfidence: true
            },
            _count: {
                mlConfidence: true
            },
            where: {
                mlConfidence: { not: null },
                durum: 'hazir'
            }
        });

        // Gerçek ML Doğruluğu
        const mlPerformance = await mlService.getAccuracy();
        const verificationRate = totalNews > 0
            ? Math.round((verifiedRecords / totalNews) * 100)
            : 0;

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
                mlTrainSize: mlPerformance.trainSize,
                mlTestSize: mlPerformance.testSize,
                avgPredictionConfidence: confidenceStats._avg.mlConfidence ? (confidenceStats._avg.mlConfidence * 100).toFixed(1) : 0,
                confidenceSampleSize: confidenceStats._count?.mlConfidence ?? 0,
                avgConfidence: confidenceStats._avg.mlConfidence ? (confidenceStats._avg.mlConfidence * 100).toFixed(1) : 0,
                mlVerification: {
                    totalRecords: totalNews,
                    verifiedRecords,
                    verificationRate,
                    pendingRecords,
                    disputedRecords,
                },
                abTestCount,
                recentCategorizations: recentCategorizations.map(h => ({
                    id: h.id,
                    baslik: h.baslik,
                    tahmin: h.kategori.ad,
                    dogruluk: h.mlConfidence ?? 0,
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
import { llmUsageService } from '../llm/llm-usage';

router.get('/scheduler-status', verifyJwtToken, requireRole([UserRole.ADMIN]), cacheMiddleware(15), (req: Request, res: Response) => {
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

/**
 * PATCH /api/admin/news/:id/category
 * Haber kategorisini manuel düzeltir.
 */
router.patch('/news/:id/category', verifyJwtToken, requireRole([UserRole.ADMIN]), async (req: Request, res: Response) => {
    try {
        const newsId = parseInt(req.params.id, 10);
        const kategoriId = parseInt(req.body?.kategoriId, 10);

        if (!Number.isInteger(newsId) || !Number.isInteger(kategoriId)) {
            return res.status(400).json({ success: false, error: 'Geçerli haberId ve kategoriId zorunludur' });
        }

        const [news, kategori] = await Promise.all([
            prisma.haber.findUnique({ where: { id: newsId } }),
            prisma.kategori.findUnique({ where: { id: kategoriId } })
        ]);

        if (!news) {
            return res.status(404).json({ success: false, error: 'Haber bulunamadı' });
        }

        if (!kategori) {
            return res.status(404).json({ success: false, error: 'Kategori bulunamadı' });
        }

        const updated = await prisma.haber.update({
            where: { id: newsId },
            data: {
                kategori: {
                    connect: { id: kategoriId }
                },
                mlConfidence: null,
                kategoriDogrulandi: true
            } as any,
            include: {
                kategori: true
            }
        });

        return res.json({
            success: true,
            data: {
                id: updated.id,
                baslik: updated.baslik,
                kategoriId: updated.kategoriId,
                kategori: updated.kategori.ad
            }
        });
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error.message || 'Kategori güncellenemedi' });
    }
});

/**
 * GET /api/admin/llm-usage
 * LLM token kullanımı ve maliyet istatistikleri
 * Query params:
 * - days: Son kaç gün (default: 30)
 */
router.get('/llm-usage', verifyJwtToken, requireRole([UserRole.ADMIN]), cacheMiddleware(180), async (req: Request, res: Response) => {
    try {
        const days = Math.min(parseInt(req.query.days as string) || 30, 365);
        const stats = await llmUsageService.getStats(days);
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error: any) {
        console.error('[Admin LLM Usage] Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'LLM kullanım istatistikleri alınamadı' 
        });
    }
});

/**
 * GET /api/admin/sentiment-stats
 * Sentiment dağılımı ve güven skorları
 */
router.get('/sentiment-stats', verifyJwtToken, requireRole([UserRole.ADMIN]), cacheMiddleware(120), async (req: Request, res: Response) => {
    try {
        // Haberler bu üç kategoriye ayrılıyor: Pozitif | Negatif | Nötr
        const sentimentBreakdown = await prisma.haber.groupBy({
            by: ['sentiment'],
            where: {
                sentiment: { not: null },
                durum: 'hazir'
            },
            _count: {
                id: true
            }
        });

        // Ortalama güven skoru
        const confidenceStats = await prisma.haber.aggregate({
            _avg: {
                mlConfidence: true
            },
            _min: {
                mlConfidence: true
            },
            _max: {
                mlConfidence: true
            },
            where: {
                mlConfidence: { not: null }
            }
        });

        // Son 7 günün sentiment trendi
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const trendData = await prisma.haber.groupBy({
            by: ['sentiment', 'yayinlanmaTarihi'],
            where: {
                sentiment: { not: null },
                yayinlanmaTarihi: { gte: sevenDaysAgo },
                durum: 'hazir'
            },
            _count: {
                id: true
            },
            orderBy: {
                yayinlanmaTarihi: 'asc'
            }
        });

        // Dağılımı yüzde olarak hesapla
        const totalCount = sentimentBreakdown.reduce((sum, item) => sum + item._count.id, 0);
        const distribution = sentimentBreakdown.reduce((acc: any, item) => {
            const percentage = totalCount > 0 ? (item._count.id / totalCount) * 100 : 0;
            acc[item.sentiment || 'bilinmiyor'] = {
                count: item._count.id,
                percentage: Math.round(percentage)
            };
            return acc;
        }, {});

        res.json({
            success: true,
            data: {
                distribution,
                totalArticles: totalCount,
                confidence: {
                    average: confidenceStats._avg.mlConfidence ? Math.round(confidenceStats._avg.mlConfidence * 100) : 0,
                    min: confidenceStats._min.mlConfidence ? Math.round(confidenceStats._min.mlConfidence * 100) : 0,
                    max: confidenceStats._max.mlConfidence ? Math.round(confidenceStats._max.mlConfidence * 100) : 0
                },
                trend: trendData.map(item => ({
                    date: item.yayinlanmaTarihi.toISOString().split('T')[0],
                    sentiment: item.sentiment,
                    count: item._count.id
                }))
            }
        });
    } catch (error: any) {
        console.error('[Admin Sentiment Stats] Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Sentiment istatistikleri alınamadı' 
        });
    }
});

export const adminRouter = router;
