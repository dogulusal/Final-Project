import { NewsItem } from "@/types/news";

/**
 * Kullanıcının okuma geçmişine göre haberleri kişiselleştirilmiş şekilde sıralar.
 * 
 * @param news Haber listesi
 * @param interests Kategori Id bazlı tıklama sayıları { [categoryId]: count }
 * @returns Sıralanmış haber listesi
 */
export function personalizedSort(news: NewsItem[], interests: Record<number, number>): NewsItem[] {
    // 1. KURAL: Eğer history çok azsa (3 tıklamadan azsa), sıralamayı bozma (Sorun 5 İyileştirmesi)
    const totalClicks = Object.values(interests).reduce((a, b) => a + b, 0);
    if (totalClicks < 3) return news;

    return [...news].sort((a, b) => {
        const scoreA = (interests[a.kategoriId] || 0) * 0.3;
        const scoreB = (interests[b.kategoriId] || 0) * 0.3;

        // Skoru yüksek olan (daha çok ilgi duyulan kategori) üste çıkar
        // Eğer skorlar eşitse orijinal tarih/id sırasını (veya news listesindeki sırayı) korur
        return scoreB - scoreA;
    });
}
