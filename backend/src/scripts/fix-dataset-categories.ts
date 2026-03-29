import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import pLimit from 'p-limit';
import { GeminiProvider } from '../modules/llm/providers/gemini.provider';

const prisma = new PrismaClient();
const BATCH_SIZE = 10;
const CONCURRENCY_LIMIT = 3;
const CHECKPOINT_FILE = path.resolve(__dirname, 'fix-dataset-checkpoint.json');

// Kategori eşleşmeleri için olası ID'ler
const CATEGORIES: Record<string, number> = {
    'Spor': 0, 'Ekonomi': 0, 'Teknoloji': 0,
    'Siyaset': 0, 'Dünya': 0, 'Sağlık': 0, 'Genel': 0
};

async function loadCategories() {
    const cats = await prisma.kategori.findMany();
    cats.forEach(c => {
        if (CATEGORIES[c.ad] !== undefined) {
            CATEGORIES[c.ad] = c.id;
        }
    });

    for (const [key, val] of Object.entries(CATEGORIES)) {
        if (val === 0) {
            // "Genel" kategorisini map edip default verelim
            const fallback = cats.find(c => c.slug === 'genel');
            CATEGORIES[key] = fallback ? fallback.id : 1;
        }
    }
}

async function checkCJKGuard() {
    const dirtyCount = await prisma.haber.count({
        where: { baslik: { contains: "謀" } }
    });
    if (dirtyCount > 0) {
        throw new Error(`Önce sanitize-existing-news çalıştır! ${dirtyCount} bozuk kayıt bulundu.`);
    }
}

/**
 * Gönderilen batch için LLM'e tek bir prompt gönderip cevap alır.
 */
async function processBatch(batch: any[]): Promise<any[]> {
    const promptLines = batch.map((item, index) => 
        `[ID: ${item.id}] BAŞLIK: "${item.baslik}"`
    ).join("\n");

    const systemPrompt = `
Sen deneyimli bir haber editörüsün. Sana verilen haber başlıklarını şu kategorilerden birine ve YALNIZCA BİRİNE ata:
Spor, Ekonomi, Teknoloji, Siyaset, Dünya, Sağlık, Genel.

KATEGORİ TANIMLARI (kesin referans):
- Spor: Futbol, basketbol, tenis, olimpiyat, maç sonucu, transfer, sporcu, lig, turnuva
- Ekonomi: Borsa, faiz, enflasyon, dolar/euro, merkez bankası, şirket kazancı, ihracat, bütçe, vergi, kredi
- Teknoloji: Yapay zeka, yazılım, donanım, telefon, bilgisayar, siber güvenlik, uzay, robot, uygulama, oyun
- Siyaset: Meclis, bakan, cumhurbaşkanı, seçim, parti, kanun, yasa, hükümet kararı, anayasa
- Dünya: Yabancı ülke haberleri, savaş, uluslararası ilişkiler, NATO, BM, küresel olaylar, yabancı lider
- Sağlık: Hastalık, tedavi, aşı, hastane, doktor, ilaç, kanser, salgın, medikal araştırma
- Genel: Kaza, suç, cinayet, yangın, sel, deprem, trafik kazası, soygun, gasp, tutuklanma, yerel haber, sosyal olay, magazin, insan ilgisi hikayesi

KURALLAR:
1. Kesinlikle başka kelime kullanma! Listelenen kategoriler dışında hiçbir şey yazma.
2. Çıktıyı JSON array formatında ver: [{"id": 1, "kategori": "Siyaset"}, {"id": 2, "kategori": "Dünya"}]
3. Her haber için kesinlikle doğru tek bir analiz yap.
4. Kazalar, suçlar, yerel olaylar, afetler MUTLAKA Genel kategorisine girmeli.
5. Sağlık haberleri varsa (hastalık, aşı, hastane) Sağlık kategorisi kullan, Genel değil.
`;

    const userPrompt = `
Aşağıdaki haberleri kategorize et ve JSON olarak döndür:
${promptLines}
`;

    try {
        const provider = new GeminiProvider();
        
        // Interface'e uygun olarak systemPrompt her zaman gönderilmeli
        const response = await (provider as any).generateContent(userPrompt, systemPrompt);
        
        // Gemini JSON mode ile döndüğüön olsa bile markdown code block temizliği yap
        let content = (response.content as string)
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
        
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error: any) {
        console.error(`Batch LLM hatası (Gemini): ${error.message}`);
        return [];
    }
}

async function fixDataset(isDryRun: boolean) {
    await checkCJKGuard();
    await loadCategories();

    console.log(`=== Dataset Kategorileri Düzeltme Modülü Başlıyor (${isDryRun ? "DRY-RUN RUN" : "CANLI"}) ===`);
    
    // Checkpoint okuma
    let processedIds: number[] = [];
    // Debug: DB'deki toplam hazir/yayinda sayısı
    const dbTotal = await prisma.haber.count({ where: { durum: { in: ['hazir', 'yayinda'] } } });
    console.log(`DB'de toplam ${dbTotal} adet 'hazir' veya 'yayinda' haber bulundu.`);

    // Haberleri çek
    const allNews = await prisma.haber.findMany({
        where: { 
            durum: { in: ['hazir', 'yayinda'] },
            id: { notIn: processedIds.length > 0 ? processedIds : [0] }
        },
        select: { id: true, baslik: true, kategoriId: true },
        orderBy: { id: 'asc' }
    });

    console.log(`Filtreleme sonrası işlenecek toplam ${allNews.length} haber var. (Atlanan: ${processedIds.length})`);

    let selectedNews = allNews;
    if (LIMIT > 0) {
        selectedNews = RANDOM_SAMPLE ? shuffleArray(allNews).slice(0, LIMIT) : allNews.slice(0, LIMIT);
        console.log(`Örneklem modu: ${selectedNews.length} haber (${RANDOM_SAMPLE ? 'rastgele' : 'ilk kayıtlar'}) işlenecek.`);
    }

    if (selectedNews.length === 0) {
        console.log("İşlem tamamlandı veya işlenecek yeni haber yok!");
        return;
    }

    // Haberleri 10'arlı batch'lere ayır
    const batches = [];
    for (let i = 0; i < selectedNews.length; i += BATCH_SIZE) {
        batches.push(selectedNews.slice(i, i + BATCH_SIZE));
    }

    const limit = pLimit(CONCURRENCY_LIMIT);
    let totalProcessedInSession = 0;
    
    const tasks = batches.map(batch => limit(async () => {
        const results = await processBatch(batch);
        
        for (const res of results) {
            const newsItem = batch.find(n => n.id === res.id);
            if (!newsItem) continue;

            const categoryName = res.kategori;
            const newCatId = CATEGORIES[categoryName] || CATEGORIES['Genel'];
            
            if (isDryRun) {
                console.log(`[DRY-RUN] ID ${res.id}: "${newsItem.baslik.substring(0, 30)}..." -> ${categoryName}`);
            } else {
                if (newCatId !== newsItem.kategoriId) {
                     await prisma.haber.update({
                         where: { id: res.id },
                         data: {
                             kategoriId: newCatId,
                             kategoriDogrulandi: true,
                             mlConfidence: null
                         } as any
                     });
                     console.log(`[UPDATED] ID ${res.id} -> ${categoryName}`);
                } else {
                     // Kategori aynı ama doğrulanmış olarak işaretle
                     await prisma.haber.update({
                         where: { id: res.id },
                         data: { kategoriDogrulandi: true } as any
                     });
                }
            }
            
            processedIds.push(res.id);
            totalProcessedInSession++;

            // Her 50 işlemde bir checkpoint kaydet
            if (totalProcessedInSession % 50 === 0 && !isDryRun) {
                fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(processedIds));
                console.log(`[CHECKPOINT] ${processedIds.length} ID kaydedildi.`);
            }
        }
    }));

    await Promise.all(tasks);

    // Son checkpoint kaydı
    if (!isDryRun) {
        fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(processedIds));
        console.log(`\n🎉 Tüm işlemler tamamlandı. (Toplam düzeltilen: ${processedIds.length})`);
        
        // İşimiz bitince checkpoint dosyasını silebiliriz
        fs.unlinkSync(CHECKPOINT_FILE);
        console.log(`Checkpoint dosyası temizlendi.`);
    } else {
        console.log(`\n🎉 DRY RUN tamamlandı.`);
    }
}

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10);
const RANDOM_SAMPLE = args.includes('--random-sample');

function shuffleArray<T>(input: T[]): T[] {
    const arr = [...input];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

fixDataset(isDryRun).catch(e => {
    console.error("Script fatal error:", e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
});
