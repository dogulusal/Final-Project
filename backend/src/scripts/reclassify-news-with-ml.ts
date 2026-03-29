import 'dotenv/config';
import { prisma } from '../config/database';
import { mlService } from '../modules/ml/ml.controller';
import { ML_CONFIDENCE_THRESHOLD } from '../config/constants';

async function main() {
  console.log('=== ML ile Toplu Kategori Duzeltme Basladi ===');
  const startedAt = Date.now();

  const trained = await mlService.loadAndTrainFromDB();
  if (!trained) {
    throw new Error('ML modeli egitilemedi. Islem durduruldu.');
  }

  const kategoriler = await prisma.kategori.findMany({ select: { id: true, ad: true } });
  const kategoriMap = new Map<string, number>(kategoriler.map(k => [k.ad.toLowerCase(), k.id]));

  const rows = await prisma.haber.findMany({
    where: { durum: { in: ['hazir', 'yayinda'] } },
    select: {
      id: true,
      baslik: true,
      icerik: true,
      kategoriId: true
    }
  });

  let updated = 0;
  let skippedLowConfidence = 0;
  let unchanged = 0;
  let processed = 0;

  console.log(`Toplam islenecek kayit: ${rows.length}`);

  for (const row of rows) {
    const context = (row.icerik || '').slice(0, 1200);
    const prediction = await mlService.categorize(row.baslik, context);
    const predictedId = kategoriMap.get(prediction.kategori.toLowerCase());
    processed++;

    if (processed % 100 === 0) {
      const elapsedSec = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
      const rate = (processed / elapsedSec).toFixed(2);
      const remaining = rows.length - processed;
      const etaSec = Math.floor(remaining / Math.max(0.01, Number(rate)));
      console.log(`[Progress] Islenen: ${processed}/${rows.length} | Guncellenen: ${updated} | Hiz: ${rate}/sn | ETA: ${etaSec} sn`);
    }

    if (!predictedId) {
      unchanged++;
      continue;
    }

    if (prediction.confidence < Math.max(0.60, ML_CONFIDENCE_THRESHOLD)) {
      skippedLowConfidence++;
      continue;
    }

    if (predictedId === row.kategoriId) {
      unchanged++;
      continue;
    }

    await prisma.haber.update({
      where: { id: row.id },
      data: {
        kategoriId: predictedId,
        mlConfidence: prediction.confidence
      }
    });

    updated++;

  }

  console.log('\n=== Ozet ===');
  console.log(`Toplam incelenen: ${rows.length}`);
  console.log(`Guncellenen: ${updated}`);
  console.log(`Dusuk guven nedeniyle atlanan: ${skippedLowConfidence}`);
  console.log(`Degismeyen: ${unchanged}`);
  console.log('=== Islem tamamlandi ===');
}

main()
  .catch((err) => {
    console.error('Script fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
