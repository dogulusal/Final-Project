export interface CreateNewsDto {
    baslik: string;
    icerik?: string;
    metaAciklama?: string;
    kategoriId: number;
    kaynakUrl?: string;
    gorselUrl?: string;
    sentiment?: string;
    durum?: 'ham' | 'hazir' | 'yayinda';
    mlConfidence?: number;
    llmProvider?: string;
}

export interface INewsService {
    /**
     * Yeni haber kaydeder (Aynı haber daha önce varsa engeller - Dedup)
     */
    createNews(data: CreateNewsDto): Promise<any>;

    /**
     * Son eklenen haberlerden DEDUP_WINDOW_SIZE kadarını alarak 
     * verilen başlıkla JaroWinkler-Levenshtein tabanlı benzerlik ölçer.
     * Eşleşirse "true" döner (yani bu haber duplicate/kopya)
     */
    isDuplicate(baslik: string): Promise<{ duplicate: boolean; similarity?: number; matchedTitle?: string }>;

    /**
     * Son haberleri listeleme (Kategori, durum filtresi, arama ve sayfalama)
     */
    getRecentNews(page?: number, limit?: number, status?: string, search?: string): Promise<{ data: any[], total: number, totalPages: number }>;

    /**
     * Slug değerine göre haber detayını getir
     */
    getNewsBySlug(slug: string): Promise<any | null>;
}
