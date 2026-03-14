import natural from 'natural';
import { prisma } from '../../config/database';
import { INewsService, CreateNewsDto } from './news.interface';
import { DEDUP_SIMILARITY_THRESHOLD, DEDUP_WINDOW_SIZE } from '../../config/constants';
import { ConflictError, NotFoundError } from '../../middleware/error-handler';
import { EventEmitter } from 'events';

export const newsEventEmitter = new EventEmitter();

import { redis as redisClient } from '../../config/redis';
import crypto from 'crypto';

export class NewsService implements INewsService {

    /**
     * Haberi slug(url dostu isim) oluşturarak güvenli bir şekilde kaydeder.
     * Node Best Practices: Hata fırlatmayı tercih eder (ConflictError).
     */
    async createNews(data: CreateNewsDto): Promise<any> {
        // 1. Önce Kopya (Deduplication) kontrolü yap
        const dupCheck = await this.isDuplicate(data.baslik);

        if (dupCheck.duplicate) {
            throw ConflictError(`Bu haber zaten eklenmiş. (Benzerlik: %${(dupCheck.similarity! * 100).toFixed(1)}, Eşleşen: "${dupCheck.matchedTitle}")`);
        }

        // 2. Slug oluştur (Büyük harf küçült, Türkçe karakter düzelt, boşlukları tire yap)
        let slug = this.generateSlug(data.baslik);

        // Slug çakışmasını engelle
        const existingSlug = await prisma.haber.findUnique({ where: { slug } });
        if (existingSlug) {
            slug = `${slug}-${Date.now()}`;
        }

        // 3. Veritabanına kaydet
        const newNews = await prisma.haber.create({
            data: {
                baslik: data.baslik,
                slug,
                icerik: data.icerik || null,
                metaAciklama: data.metaAciklama || null,
                kategoriId: data.kategoriId,
                kaynakUrl: data.kaynakUrl || null,
                gorselUrl: data.gorselUrl || null,
                sentiment: data.sentiment || 'Nötr',
                durum: data.durum || 'ham',
                mlConfidence: data.mlConfidence || null,
                llmProvider: data.llmProvider || null,
                okumaSuresiDakika: data.icerik ? Math.ceil(data.icerik.split(' ').length / 200) : 1, // Basit ortalama
            },
            include: {
                kategori: true
            }
        });

        // 4. Redis Fingerprint ve Cache güncelle
        try {
            const fingerprint = this.generateFingerprint(data.baslik);
            await redisClient.sadd('news:fingerprints', fingerprint);
            await redisClient.expire('news:fingerprints', 48 * 3600); // 48 saat

            // Son haberleri Redis listesinde de tutalım (L1 Cache)
            await redisClient.lpush('news:recent_titles', data.baslik);
            await redisClient.ltrim('news:recent_titles', 0, DEDUP_WINDOW_SIZE - 1);
        } catch (e) {
            console.error('[Redis Error] Cache güncellenemedi:', e);
        }

        console.log(`[DB] Yeni haber kaydedildi: "${newNews.baslik}" (ID: ${newNews.id})`);
        
        // SSE üzerinden dinleyen istemcilere bildir:
        newsEventEmitter.emit('new-news', newNews);
        
        return newNews;
    }

    /**
     * İki seviyeli Deduplication:
     * L1: Redis Set (Fingerprint) - %100 eşleşme (Çok hızlı)
     * L2: Jaro-Winkler Similarity - %80+ benzerlik (Redis List üzerinden)
     */
    async isDuplicate(baslik: string): Promise<{ duplicate: boolean; similarity?: number; matchedTitle?: string }> {
        const fingerprint = this.generateFingerprint(baslik);

        try {
            // L1: Exact Fingerprint Check
            const isExists = await redisClient.sismember('news:fingerprints', fingerprint);
            if (isExists) {
                return { duplicate: true, similarity: 1, matchedTitle: 'Kesin Eşleşme (Hash)' };
            }

            // L2: Semantic Similarity Check (Redis listesi üzerinden)
            let titles = await redisClient.lrange('news:recent_titles', 0, DEDUP_WINDOW_SIZE - 1);

            // Eğer Redis boşsa (örneğin yeni restart veya cache temizliği), DB'den çek ve cache'i ısıt
            if (titles.length === 0) {
                const dbNews = await prisma.haber.findMany({
                    take: DEDUP_WINDOW_SIZE,
                    orderBy: { yayinlanmaTarihi: 'desc' },
                    select: { baslik: true }
                });
                titles = dbNews.map(n => n.baslik);
                
                if (titles.length > 0) {
                    await redisClient.rpush('news:recent_titles', ...titles);
                }
            }

            for (const cachedTitle of titles) {
                const similarity = natural.JaroWinklerDistance(baslik.toLowerCase(), cachedTitle.toLowerCase(), { ignoreCase: true });
                if (similarity >= DEDUP_SIMILARITY_THRESHOLD) {
                    return { duplicate: true, similarity, matchedTitle: cachedTitle };
                }
            }
        } catch (e) {
            console.error('[Redis Error] Dedup işlemi sırasında hata, DB fallback yapılıyor:', e);
            // Hata durumunda eski yoldan (DB) devam et (Resiliency)
            return this.isDuplicateDatabaseFallback(baslik);
        }

        return { duplicate: false };
    }

    private async isDuplicateDatabaseFallback(baslik: string): Promise<{ duplicate: boolean; similarity?: number; matchedTitle?: string }> {
        const recentNews = await prisma.haber.findMany({
            take: DEDUP_WINDOW_SIZE,
            orderBy: { yayinlanmaTarihi: 'desc' },
            select: { baslik: true }
        });

        for (const news of recentNews) {
            const similarity = natural.JaroWinklerDistance(baslik.toLowerCase(), news.baslik.toLowerCase(), { ignoreCase: true });
            if (similarity >= DEDUP_SIMILARITY_THRESHOLD) {
                return { duplicate: true, similarity, matchedTitle: news.baslik };
            }
        }
        return { duplicate: false };
    }

    private generateFingerprint(title: string): string {
        // Küçük harf, boşluksuz ve temizlenmiş metnin hash'i
        const clean = title.toLowerCase().replace(/\s+/g, '').trim();
        return crypto.createHash('sha1').update(clean).digest('hex');
    }

    async getRecentNews(page = 1, limit = 20, status?: string, search?: string): Promise<{ data: any[], total: number, totalPages: number }> {
        const filters: any = {};
        if (status) {
            filters.durum = status;
        }

        if (search) {
            filters.OR = [
                { baslik: { contains: search, mode: 'insensitive' } },
                { icerik: { contains: search, mode: 'insensitive' } },
                { metaAciklama: { contains: search, mode: 'insensitive' } }
            ];
        }

        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            prisma.haber.findMany({
                where: filters,
                skip,
                take: limit,
                orderBy: { yayinlanmaTarihi: 'desc' },
                include: { kategori: true }
            }),
            prisma.haber.count({ where: filters })
        ]);

        return {
            data,
            total,
            totalPages: Math.ceil(total / limit)
        };
    }

    async getNewsBySlug(slug: string): Promise<any | null> {
        const news = await prisma.haber.findUnique({
            where: { slug },
            include: { kategori: true }
        });

        if (!news) {
            throw NotFoundError('Haber');
        }

        // Okunma sayısını artır (Atomic operation)
        await prisma.haber.update({
            where: { id: news.id },
            data: { goruntulemeSayisi: { increment: 1 } }
        });

        return news;
    }

    private generateSlug(title: string): string {
        return title.toLowerCase()
            .trim()
            .replace(/[ğ]/g, 'g')
            .replace(/[ü]/g, 'u')
            .replace(/[ş]/g, 's')
            .replace(/[ı]/g, 'i')
            .replace(/[ö]/g, 'o')
            .replace(/[ç]/g, 'c')
            .replace(/[^a-z0-9 -]/g, '') // Özel karakterleri sil
            .replace(/\s+/g, '-')       // Boşlukları tireye çevir
            .replace(/-+/g, '-');       // Tekrarlayan tireleri tek tire yap
    }
}
