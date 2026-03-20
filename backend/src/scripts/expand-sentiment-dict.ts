import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const DICT_PATH = path.resolve(__dirname, '../modules/ml/tr-sentiment-dict.json');

// Basit türkçe stop words listesi
const stopWords = new Set([
     'bir', 've', 'ile', 'için', 'bu', 'da', 'de', 'gibi', 'en', 'çok', 'daha',
     'olarak', 'olan', 'kadar', 'sonra', 'önce', 'göre', 'var', 'yok', 'ise',
     'mi', 'mı', 'mu', 'mü', 'ne', 'kendi', 'ama', 'fakat', 'lakin', 'ancak'
]);

async function expandSentimentDict() {
    console.log('=== Otomatik Sentiment Sözlüğü Genişletici ===');

    if (!fs.existsSync(DICT_PATH)) {
        console.error(`Bulunamadı: ${DICT_PATH}`);
        return;
    }

    const currentDict: Record<string, number> = JSON.parse(fs.readFileSync(DICT_PATH, 'utf-8'));
    const initialWordCount = Object.keys(currentDict).length;
    console.log(`Mevcut kelime sayısı: ${initialWordCount}`);

    // LLM'in açıkça sentiment atadığı kayıtları bul (Nötr hariç)
    const news = await prisma.haber.findMany({
        where: {
            sentiment: { in: ['Pozitif', 'Negatif'] }
        },
        select: { baslik: true, sentiment: true }
    });

    console.log(`Taranacak etiketli başlık sayısı: ${news.length}`);

    if (news.length === 0) {
        console.log('Yeterli eğitim verisi yok.');
        return;
    }

    const wordFreq: { pos: Record<string, number>, neg: Record<string, number> } = {
        pos: {},
        neg: {}
    };

    // Kelimeleri çıkar ve kategorisine göre say
    for (const n of news) {
        const words = n.baslik.toLowerCase()
            .replace(/[^\w\sğüşıöç]/gi, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3 && !stopWords.has(w));
        
        words.forEach(w => {
            if (n.sentiment === 'Pozitif') {
                wordFreq.pos[w] = (wordFreq.pos[w] || 0) + 1;
            } else if (n.sentiment === 'Negatif') {
                wordFreq.neg[w] = (wordFreq.neg[w] || 0) + 1;
            }
        });
    }

    let addedCount = 0;
    
    // Potansiyel Negatif Kelimeler (Frequency > 3)
    for (const [word, freq] of Object.entries(wordFreq.neg)) {
        // Eğer negatif haberi sayısı yüksek, ama pozitif haberde hiç geçmemişse
        const posFreq = wordFreq.pos[word] || 0;
        if (freq >= 3 && posFreq === 0 && currentDict[word] === undefined) {
             currentDict[word] = -1; // baseline score
             addedCount++;
             console.log(`[+] Yeni Kelime Eklendi (Neg): ${word} (Frekans: ${freq})`);
        }
    }

    // Potansiyel Pozitif Kelimeler (Frequency > 3)
    for (const [word, freq] of Object.entries(wordFreq.pos)) {
        const negFreq = wordFreq.neg[word] || 0;
        if (freq >= 3 && negFreq === 0 && currentDict[word] === undefined) {
             currentDict[word] = 1; // baseline score
             addedCount++;
             console.log(`[+] Yeni Kelime Eklendi (Poz): ${word} (Frekans: ${freq})`);
        }
    }

    if (addedCount > 0) {
        fs.writeFileSync(DICT_PATH, JSON.stringify(currentDict, null, 2), 'utf-8');
        console.log(`🎉 Sözlük genişletildi! Yeni kelime eklendi: ${addedCount}. Toplam: ${Object.keys(currentDict).length}`);
    } else {
        console.log(`📉 Belirgin dağılımlı yeni kelime bulunamadı. Değişiklik yapılmadı.`);
    }
}

expandSentimentDict()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
