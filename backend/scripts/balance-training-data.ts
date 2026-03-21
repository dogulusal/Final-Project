/**
 * balance-training-data.ts
 *
 * Faz 2.2 — Eğitim verisi dengeleme scripti
 *
 * Kullanım:
 *   npx ts-node scripts/balance-training-data.ts
 *
 * Yapılanlar:
 *   1. DB'den durum='hazir' olan haberleri çeker (canlı, onaylanmış)
 *   2. Her kategorideki mevcut örnek sayısını loglar (2.1 sorgusu eşdeğeri)
 *   3. Hedef eşiği (TARGET_PER_CATEGORY) sağlayan kategorileri dataset.json'a aktarır
 *   4. Eksik kategorilerde upsampling (tekrar örnekleme) uygular
 *   5. Sonucu training/naive-bayes/dataset.json'a yazar
 *
 * ÖNEMLİ: Script çalıştırılmadan önce DB dağılımını görün (log çıktısı).
 * Upsampling stratejisini o veriye göre ayarlayın.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const TARGET_PER_CATEGORY = 50;  // Hedef: her kategori için min örnek
const MIN_DB_REQUIRED = 300;     // DB'de bu kadar 'hazir' haber yoksa çıkmaz

interface TrainingExample {
    text: string;
    category: string;
}

function upsample(examples: TrainingExample[], targetCount: number): TrainingExample[] {
    if (examples.length === 0) return [];
    const result: TrainingExample[] = [...examples];
    while (result.length < targetCount) {
        // Rastgele bir örneği kopyala (circular)
        result.push({ ...examples[result.length % examples.length] });
    }
    return result.slice(0, targetCount);
}

async function main() {
    console.log('[Balance] DB bağlantısı kuruluyor...');

    const approvedNews = await prisma.haber.findMany({
        where: { durum: { in: ['hazir', 'yayinda'] } },
        select: {
            baslik: true,
            metaAciklama: true,
            icerik: true,
            kategori: {
                select: { ad: true }
            }
        },
        orderBy: { yayinlanmaTarihi: 'desc' },
    });

    const total = approvedNews.length;
    console.log(`\n[Balance] Toplam 'hazir/yayinda' haber: ${total}`);

    if (total < MIN_DB_REQUIRED) {
        console.warn(`[Balance] ⚠️  DB henüz dolmamış (${total} < ${MIN_DB_REQUIRED}). Faz 2 için ${MIN_DB_REQUIRED}+ haber gerekli.`);
        console.warn('[Balance] İkinci Iterasyon Tetikleyicileri karşılanmadan bu scripti çalıştırmayın.');
        await prisma.$disconnect();
        process.exit(1);
    }

    // Kategori dağılımını göster (2.1 sorgusu eşdeğeri)
    const byCategory: Record<string, TrainingExample[]> = {};
    for (const news of approvedNews) {
        const cat = news.kategori.ad;
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push({
            text: `${news.baslik} ${news.metaAciklama || ''} ${news.icerik || ''}`.trim(),
            category: cat,
        });
    }

    console.log('\n[Balance] === DB Kategori Dağılımı (2.1 Sorgusu) ===');
    const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length);
    sortedCategories.forEach(([cat, examples]) => {
        const bar = '█'.repeat(Math.round(examples.length / 5));
        const pct = ((examples.length / total) * 100).toFixed(1);
        console.log(`  ${cat.padEnd(15)} ${String(examples.length).padStart(4)} örnek  (${pct}%)  ${bar}`);
    });
    console.log('');

    // Upsampling ile dengele
    const balanced: TrainingExample[] = [];
    for (const [cat, examples] of sortedCategories) {
        if (examples.length < 3) {
            console.warn(`[Balance] Skipped: '${cat}' (${examples.length} örnek < 3 minimum)`);
            continue;
        }
        const sampled = upsample(examples, Math.max(examples.length, TARGET_PER_CATEGORY));
        balanced.push(...sampled);
        console.log(`[Balance] ${cat.padEnd(15)} ${examples.length} → ${sampled.length} örnek (upsampled: ${examples.length < TARGET_PER_CATEGORY ? '✓' : '-'})`);
    }

    // Karıştır
    const shuffled = balanced.sort(() => 0.5 - Math.random());

    // dataset.json'a yaz
    const outputPath = path.resolve(__dirname, '../../training/naive-bayes/dataset.json');

    // Yedek al
    const backupPath = outputPath.replace('.json', `.backup-${Date.now()}.json`);
    if (fs.existsSync(outputPath)) {
        fs.copyFileSync(outputPath, backupPath);
        console.log(`\n[Balance] Yedek alındı: ${path.basename(backupPath)}`);
    }

    fs.writeFileSync(outputPath, JSON.stringify(shuffled, null, 2), 'utf8');
    console.log(`\n[Balance] ✅ dataset.json güncellendi: ${shuffled.length} toplam örnek`);
    console.log(`[Balance] Çıktı: ${outputPath}`);
    console.log('\n[Balance] Şimdi backend\'i yeniden başlatın — ML modeli bu veriyle otomatik yeniden eğitilecek.');

    await prisma.$disconnect();
}

main().catch(async (err) => {
    console.error('[Balance] Hata:', err);
    await prisma.$disconnect();
    process.exit(1);
});
