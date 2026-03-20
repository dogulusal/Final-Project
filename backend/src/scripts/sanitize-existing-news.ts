import { PrismaClient } from '@prisma/client';
import { sanitizeText } from '../common/sanitize-text';
import { MlCategorizationService } from '../modules/ml/ml.service';
import { ImageService } from '../modules/news/image.service';

const prisma = new PrismaClient();
const mlService = new MlCategorizationService();

async function asyncPool(poolLimit: number, array: any[], iteratorFn: any) {
  const ret = [];
  const executing: any[] = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item, array));
    ret.push(p);
    if (poolLimit <= array.length) {
      const e: any = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

async function main() {
  console.log("=== CJK Temizleme ve Sentiment/Image Migration Başlıyor ===");

  const allNews = await prisma.haber.findMany({
    include: { kategori: true }
  });
  console.log(`Veritabanında toplam ${allNews.length} haber bulundu.`);

  if (allNews.length === 0) {
    console.log("İşlenecek kayıt yok. Çıkılıyor.");
    return;
  }

  let successCount = 0;
  let errorStateCount = 0;
  let failCount = 0;

  await asyncPool(5, allNews, async (news: any) => {
    try {
      const baslikSanitized = sanitizeText(news.baslik) ?? "";
      const icerikSanitized = sanitizeText(news.icerik);
      const metaSanitized = sanitizeText(news.metaAciklama);

      // Boş mu kaldı kontrolü
      if (!baslikSanitized || baslikSanitized.trim() === "") {
        await prisma.haber.update({
          where: { id: news.id },
          data: { durum: 'hata' }
        });
        errorStateCount++;
        return;
      }

      let cleanIcerik = icerikSanitized;
      if (cleanIcerik) {
        // HTML duyarlı kaynak linki temizliği
        cleanIcerik = cleanIcerik
          .replace(/\s*\(Kaynak:\s*https?:\/\/[^\)]+\)/gi, "")
          .replace(/<p[^>]*>\s*Kaynak:.*?<\/p>/gi, "")
          .trim();
      }

      // 2. Kategori ve Thumbnail Hash Üretimi
      const uniqueSeedBase = `${news.id}-${news.slug}`;
      const newImageUrl = ImageService.getImageForNews(news.kategori.slug, baslikSanitized, uniqueSeedBase);

      // 3. Sentiment Üretimi
      const sentimentResult = await mlService.analyzeSentiment(`${baslikSanitized} ${cleanIcerik || ''}`);

      await prisma.haber.update({
        where: { id: news.id },
        data: {
          baslik: baslikSanitized,
          icerik: cleanIcerik,
          metaAciklama: metaSanitized,
          gorselUrl: newImageUrl,
          sentiment: sentimentResult.label,
          mlConfidence: null
        }
      });

      successCount++;
      if (successCount % 50 === 0) {
        process.stdout.write(`İşlenen: ${successCount}...\r`);
      }
    } catch (e) {
      failCount++;
      console.error(`\nHaber ID ${news.id} güncellenemedi:`, e);
    }
  });

  console.log(`\n=== Migration Tamamlandı ===`);
  console.log(`Başarıyla güncellenen: ${successCount}`);
  console.log(`KRİTİK: Durumu HATA olarak işaretlenen/bozuk kayıt (Sorun 4 için kontrol): ${errorStateCount}`);
  console.log(`Başarısız olan (Crash): ${failCount}`);
}

main()
  .catch(e => {
    console.error("Migration fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
