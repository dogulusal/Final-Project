/**
 * Türkçe Stemmer — Risk Azaltma
 * Türkçe'nin sondan eklemeli yapısı için basit kök ayıklama
 * İleride Zemberek.js ile değiştirilebilir
 */

const TURKISH_SUFFIXES = [
    // Çoğul ekleri
    'lar', 'ler',
    // Hal ekleri
    'dan', 'den', 'tan', 'ten',
    'da', 'de', 'ta', 'te',
    'nın', 'nin', 'nun', 'nün',
    'ın', 'in', 'un', 'ün',
    'na', 'ne',
    'ya', 'ye',
    // İyelik ekleri
    'ları', 'leri',
    'ım', 'im', 'um', 'üm',
    'sı', 'si', 'su', 'sü',
    // Fiil ekleri
    'mak', 'mek',
    'yor', 'iyor', 'ıyor', 'uyor', 'üyor',
    'dı', 'di', 'du', 'dü', 'tı', 'ti', 'tu', 'tü',
    'mış', 'miş', 'muş', 'müş',
    'acak', 'ecek',
    // Diğer
    'lık', 'lik', 'luk', 'lük',
    'cı', 'ci', 'cu', 'cü', 'çı', 'çi', 'çu', 'çü',
];

// Uzunluğa göre sırala (uzun ekler önce denenecek)
const SORTED_SUFFIXES = [...TURKISH_SUFFIXES].sort((a, b) => b.length - a.length);

/**
 * Türkçe metinden basit ek kırpma (stemming)
 * @param word - Kırpılacak kelime
 * @param minStemLength - Kökün minimum uzunluğu (varsayılan: 3)
 * @returns Kırpılmış kök
 */
export function turkishStem(word: string, minStemLength: number = 3): string {
    let stem = word.toLowerCase().trim();

    for (const suffix of SORTED_SUFFIXES) {
        if (stem.endsWith(suffix) && (stem.length - suffix.length) >= minStemLength) {
            stem = stem.slice(0, -suffix.length);
            break; // Sadece bir kez kırp (agresif kırpma önlenir)
        }
    }

    return stem;
}

/**
 * Bir cümledeki tüm kelimeleri stem'le
 * @param text - Stem'lenecek metin
 * @returns Stem'lenmiş kelime dizisi
 */
export function tokenizeAndStem(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ\s]/g, '') // Özel karakterleri kaldır
        .split(/\s+/)
        .filter(word => word.length > 2)
        .map(word => turkishStem(word));
}
