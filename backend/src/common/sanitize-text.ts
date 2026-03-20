/**
 * Metin temizleme aracı.
 * Haber sitelerindeki karakter uyuşmazlığı sorunlarını (CJK karakterleri, kontrol karakterleri vb.) giderir.
 */
export function sanitizeText(text: string | null | undefined): string | null {
  if (!text) return null;
  
  // Türkçe olmayan, kontrol karakteri olan, ve "garip" unicode bloklarını temizle
  // CJK Unified Ideographs: U+4E00–U+9FFF
  // Hiragana: U+3040–U+309F  Katakana: U+30A0–U+30FF
  return text
    .replace(/[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3300-\u33FF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/g, "") // Genişletilmiş CJK/Han/Hangul sil
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")          // kontrol karakterleri
    .replace(/ {2,}/g, " ")                                    // ardışık boşlukları tek boşluğa çevir
    .trim();
}
