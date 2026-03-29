/**
 * review-low-confidence.ts
 *
 * Düşük ML güven skorlu haberleri listeler — manuel inceleme için.
 * Bu haberleri DB'de doğru kategoriye güncellerseniz, model bir sonraki
 * loadAndTrainFromDB() çağrısında bu düzeltmeyi öğrenir.
 *
 * Kullanım:
 *   npx ts-node scripts/review-low-confidence.ts
 *   npx ts-node scripts/review-low-confidence.ts --fix   (interaktif düzeltme modu)
 *
 * Çıktı:
 *   - ID, başlık, mevcut kategori, güven skoru
 *   - Güncelleme SQL'i (toplu düzeltme için hazır)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONFIDENCE_THRESHOLD = 0.75; // Bu altındaki haberler incelemeye alınır
const LIMIT = 30;

async function main() {
    const lowConfidenceNews = await prisma.haber.findMany({
        where: {
            mlConfidence: { lt: CONFIDENCE_THRESHOLD, not: null },
            durum: { in: ['hazir', 'yayinda'] }
        },
        include: { kategori: true },
        orderBy: { mlConfidence: 'asc' },
        take: LIMIT,
    });

    if (lowConfidenceNews.length === 0) {
        console.log(`✅ Tüm haberler %${(CONFIDENCE_THRESHOLD * 100).toFixed(0)}+ güven skoruna sahip. Düzeltme gerekmez.`);
        await prisma.$disconnect();
        return;
    }

    const allCategories = await prisma.kategori.findMany({ orderBy: { ad: 'asc' } });

    console.log(`\n[Review] ${lowConfidenceNews.length} düşük güvenli haber bulundu (< %${(CONFIDENCE_THRESHOLD * 100).toFixed(0)}):\n`);
    console.log('Kategoriler:');
    allCategories.forEach(k => console.log(`  [${k.id}] ${k.ad}`));
    console.log('');
    console.log('─'.repeat(100));

    // Kategori dağılımı analizi
    const categoryDist: Record<string, number> = {};
    lowConfidenceNews.forEach(h => {
        const cat = h.kategori.ad;
        categoryDist[cat] = (categoryDist[cat] || 0) + 1;
    });

    console.log('\n📊 Düşük güven dağılımı (hangi kategoriler sorunlu?):');
    Object.entries(categoryDist)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, count]) => {
            console.log(`  ${cat.padEnd(15)} ${count} haber`);
        });

    console.log('\n📋 Düşük güvenli haberler (en düşükten yükseğe):');
    console.log('─'.repeat(100));
    lowConfidenceNews.forEach((h, i) => {
        const conf = ((h.mlConfidence ?? 0) * 100).toFixed(1);
        const baslik = h.baslik.length > 70 ? h.baslik.substring(0, 70) + '...' : h.baslik;
        console.log(`${String(i + 1).padStart(2)}. [ID:${h.id}] %${conf.padStart(5)} | ${h.kategori.ad.padEnd(12)} | ${baslik}`);
    });

    console.log('\n─'.repeat(100));
    console.log('\n💡 Düzeltme nasıl yapılır?');
    console.log('   Yanlış görünen bir haberin kategorisini güncellemek için:');
    console.log('   npx ts-node scripts/review-low-confidence.ts --update <ID> <KategoriID>');
    console.log('   Örnek: npx ts-node scripts/review-low-confidence.ts --update 42 3');
    console.log('\n   Ardından modeli yeniden eğitmek için:');
    console.log('   curl -X POST http://localhost:3001/api/ml/train -H "x-api-key: ag-agency-secret-token-2026"');

    // --update <id> <katId> modu
    const args = process.argv.slice(2);
    if (args[0] === '--update' && args[1] && args[2]) {
        const haberId = parseInt(args[1]);
        const kategoriId = parseInt(args[2]);
        const kat = allCategories.find(k => k.id === kategoriId);
        if (!kat) {
            console.error(`\n❌ Kategori ID ${kategoriId} bulunamadı.`);
        } else {
            await prisma.haber.update({
                where: { id: haberId },
                data: {
                    kategori: {
                        connect: { id: kategoriId }
                    },
                    mlConfidence: null,
                    kategoriDogrulandi: true
                } as any
            });
            console.log(`\n✅ Haber #${haberId} → '${kat.ad}' olarak güncellendi.`);
            console.log('   Şimdi modeli yeniden eğitin: POST /api/ml/train');
        }
    }

    await prisma.$disconnect();
}

main().catch(async err => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
});
