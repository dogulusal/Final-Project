/**
 * Türkçe Stemmer — Risk Azaltma
 * Türkçe'nin sondan eklemeli yapısı için basit kök ayıklama
 * İleride Zemberek.js ile değiştirilebilir
 */

// 'snowball-stemmers' might not have robust @types if we installed a generic community one, 
// but we cast it or simply use require as a safety net.
import * as Snowball from 'snowball-stemmers';

// Initializing the Turkish stemmer
const stemmer = Snowball.newStemmer('turkish');

/**
 * Türkçe metinden basit ek kırpma (Snowball algoritmaları tabanlı stemming)
 * @param word - Kırpılacak kelime
 * @param minStemLength - Kökün minimum uzunluğu (varsayılan: 3)
 * @returns Kırpılmış kök
 */
export function turkishStem(word: string, minStemLength: number = 3): string {
    const rawWord = word.toLowerCase().trim();
    if (!rawWord || rawWord.length < minStemLength) return rawWord;
    
    // Yüksek doğruluklu resmi kaynak üzerinden kök yakalama
    return stemmer.stem(rawWord);
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
