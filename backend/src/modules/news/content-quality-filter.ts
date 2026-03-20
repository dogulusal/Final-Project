// modules/news/content-quality-filter.ts

export interface ContentQualityReport {
    isValid: boolean;
    reason?: string;
}

export class ContentQualityFilter {
    private readonly MIN_TITLE_LENGTH = 10;
    private readonly MAX_TITLE_LENGTH = 200;
    private readonly MIN_CONTENT_WORDS = 50;
    
    // Basit spam ve istenmeyen kelime pattern'leri
    private readonly SPAM_PATTERNS = [
        /\btıkla\b/i, 
        /\bkazan\b/i, 
        /\bücretsiz\b/i, 
        /\bhemen başvur\b/i,
        /\bşok\b/i,
        /\bflaş\b/i,
        /\bmilyoner\b/i,
        /18\+/i
    ];

    /**
     * Gelen haberin kalite standartlarına uyup uymadığını kontrol eder.
     * @param title Haberin başlığı
     * @param content Haberin içeriği
     * @returns ContentQualityReport objesi
     */
    validateQuality(title: string, content: string): ContentQualityReport {
        // 1. Başlık Uzunluğu Kontrolü
        if (!title || title.length < this.MIN_TITLE_LENGTH) {
            return { isValid: false, reason: `Başlık çok kısa (Min: ${this.MIN_TITLE_LENGTH})` };
        }
        
        if (title.length > this.MAX_TITLE_LENGTH) {
            return { isValid: false, reason: `Başlık çok uzun (Max: ${this.MAX_TITLE_LENGTH})` };
        }

        // 2. İçerik Uzunluğu Kontrolü (Sadece düzgün bir içerik varsa kontrol et)
        if (content) {
            const wordCount = content.trim().split(/\s+/).length;
            if (wordCount < this.MIN_CONTENT_WORDS) {
                return { isValid: false, reason: `İçerik çok yetersiz (Min ${this.MIN_CONTENT_WORDS} kelime, bulundu: ${wordCount})` };
            }
        }

        // 3. Spam / Tık Tuzağı (Clickbait) Kontrolü
        for (const pattern of this.SPAM_PATTERNS) {
            if (pattern.test(title)) {
                return { isValid: false, reason: `Spam/Clickbait tespit edildi: Başlık '${pattern.source}' içeriyor.` };
            }
            if (content && pattern.test(content)) {
                // Return just warning or fully invalidate? We'll invalidate to keep quality high.
                return { isValid: false, reason: `Spam/Reklam tespit edildi: İçerik '${pattern.source}' pattern'ı barındırıyor.` };
            }
        }

        // 4. Dil Tespiti (Çok temel bir Türkçe harf / kelime kontrolü. İleride frang/langdetect kütüphanesi eklenebilir)
        const trChars = (title.match(/[ğüşıöçĞÜŞİÖÇ]/g) || []).length;
        const totalChars = title.replace(/\s+/g, '').length;
        
        // CJK Data Poisoning kontrolünü de buraya dahil edelim
        const containsCJK = /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(title);
        if (containsCJK) {
            return { isValid: false, reason: `Yabancı karakterler (Korece/Çince/Japonca) tespit edildi.` };
        }

        return { isValid: true };
    }
}
