import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Get category distribution
    const distribution = await prisma.$queryRaw`
      SELECT k.ad as kategori, COUNT(h.id) as haber_sayisi
      FROM haberler h
      JOIN kategoriler k ON h.kategori_id = k.id
      GROUP BY k.ad
      ORDER BY haber_sayisi DESC
    `;

    console.log('\n=== DB KATEGORİ DAĞILIMI (29 Mart 2026) ===\n');

    let totalNews = 0;
    const rows = distribution as Array<{ kategori: string; haber_sayisi: number }>;
    
    for (const row of rows) {
      totalNews += row.haber_sayisi;
    }

    for (const row of rows) {
      const pct = ((row.haber_sayisi / totalNews) * 100).toFixed(1);
      const status = row.haber_sayisi >= 50 ? '✅' : '❌';
      console.log(`${status} ${row.kategori.padEnd(15)} | ${String(row.haber_sayisi).padStart(4)} haber | ${pct.padStart(5)}%`);
    }

    console.log('\n' + '='.repeat(50));
    console.log(`TOPLAM HABER: ${totalNews}`);
    console.log('HEDEF: Her kategoride en az 50 örnek (Faz 2 Adım 7 dengeleme)');
    console.log('MIN_DB_THRESHOLD: 50');
    console.log('ALWAYS_SUPPLEMENT_LIMIT: 600 (oversampling maksimumu)');
    
    // Analysis
    const underThreshold = rows.filter(r => r.haber_sayisi < 50).length;
    const overThreshold = rows.filter(r => r.haber_sayisi >= 50).length;
    
    console.log('\n📊 ÖZET:');
    console.log(`  - Tarih kategorileri: ${overThreshold} (hedefin üzerinde)`);
    console.log(`  - Dengelemelere ihtiyaç: ${underThreshold} (hedefin altında)`);
    console.log(`  - DB hazır olma durumu: ${underThreshold === 0 ? '✅ HAZIR' : '⚠️  DÜZELTİLMESİ GEREK'}`);
    
    console.log('\n💡 Faz 2 Adım 7 Sonraki Adım:');
    console.log('  backend/scripts/balance-training-data.ts çalıştır →');
    console.log('  training/naive-bayes/dataset.json güncelle');
    
  } catch (error) {
    console.error('Hata:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
