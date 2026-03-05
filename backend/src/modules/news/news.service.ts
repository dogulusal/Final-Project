import natural from 'natural';
import { prisma } from '../../config/database';
import { INewsService, CreateNewsDto } from './news.interface';
import { DEDUP_SIMILARITY_THRESHOLD, DEDUP_WINDOW_SIZE } from '../../config/constants';
import { ConflictError, NotFoundError } from '../../middleware/error-handler';

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

        console.log(`[DB] Yeni haber kaydedildi: "${newNews.baslik}" (ID: ${newNews.id})`);
        return newNews;
    }

    /**
     * Jaro-Winkler algoritmasıyla son 50 haberi tarar.
     * (Jaro-Winkler, metinlerin baş tarafına daha çok ağırlık verir, haber başlıkları için idealdir).
     */
    async isDuplicate(baslik: string): Promise<{ duplicate: boolean; similarity?: number; matchedTitle?: string }> {
        const recentNews = await prisma.haber.findMany({
            take: DEDUP_WINDOW_SIZE, // Sadece son 50 haber (Performans için)
            orderBy: {
                yayinlanmaTarihi: 'desc'
            },
            select: {
                id: true,
                baslik: true
            }
        });

        for (const news of recentNews) {
            // Natural.JaroWinklerDistance 0 ile 1 arası değer döner. 1 tam eşleşme, 0 alakasız.
            const similarity = natural.JaroWinklerDistance(baslik.toLowerCase(), news.baslik.toLowerCase(), { ignoreCase: true });

            if (similarity >= DEDUP_SIMILARITY_THRESHOLD) { // Varsayılan: 0.80 (%80)
                console.log(`[Dedup] İptal edildi! Similarity: ${similarity.toFixed(2)} | Gelen: "${baslik}" | DB: "${news.baslik}"`);
                return { duplicate: true, similarity, matchedTitle: news.baslik };
            }
        }

        return { duplicate: false };
    }

    async getRecentNews(limit = 20, status?: string): Promise<any[]> {
        const filters: any = {};
        if (status) {
            filters.durum = status;
        }

        return prisma.haber.findMany({
            where: filters,
            take: limit,
            orderBy: { yayinlanmaTarihi: 'desc' },
            include: { kategori: true }
        });
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
