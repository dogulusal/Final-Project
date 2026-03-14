import { RssParserService } from '../modules/rss/rss.service';
import { RSS_SOURCES } from '../config/constants';
import { prisma } from '../config/database';
import { MlCategorizationService } from '../modules/ml/ml.service';
import { NewsService } from '../modules/news/news.service';

/**
 * seed-dataset.ts
 * 
 * Bu script bir defalık veya manuel olarak çalıştırılarak:
 * 1. Tanımlı tüm RSS kaynaklarından haberleri topluca çeker.
 * 2. `durum: 'hazir'` olarak doğrudan PostgreSQL veritabanına kaydeder.
 * 3. ML Modelinin bu veriler üzerinden taze bir şekilde eğitimini başlatır.
 * 
 * Kullanım:
 * npx ts-node src/scripts/seed-dataset.ts
 */

const rssService = new RssParserService();
const newsService = new NewsService();
const mlService = new MlCategorizationService();

async function runSeed() {
  console.log('🌱 [Seed Pipeline] Toplu RSS çekim ve ML seed işlemi başlatıldı...\n');
  
  try {
    // 1. Kategorilerin ID'lerini önbelleğe alalım (hızlı eşleştirme için)
    const categoriesDB = await prisma.kategori.findMany();
    const catMap = new Map<string, number>();
    categoriesDB.forEach(c => catMap.set(c.ad, c.id));
    
    // Genel kategorisinin fallback ID'si
    const fallbackCatId = catMap.get('Genel');
    if (!fallbackCatId) {
      throw new Error('"Genel" kategorisi bulunamadı. Lütfen DB kategori seed\'lerinizi kontrol edin.');
    }

    // 2. RSS feed'leri paralel olarak çek
    console.log(`📡 ${RSS_SOURCES.length} RSS kaynağından eşzamanlı veri çekiliyor...`);
    const allRssItems = await rssService.fetchAllFeeds(RSS_SOURCES);
    console.log(`✅ Toplam ${allRssItems.length} taslak haber alındı. Şimdi DB'ye işleniyor...\n`);

    let savedCount = 0;
    let duplicateCount = 0;
    let errCount = 0;

    // 3. Her bir haber için duplicate kontrolü ve DB kaydı
    for (const item of allRssItems) {
      try {
        // İsim benzerliği kontrolü (Hali hazırdaki isDuplicate newsService'te Prisma count yapıyor,
        // seed sırasında DB'ye sormak yerine batch işlem de olabilirdi ama şimdilik mevcut güvenli akışı kullanacağız)
        const check = await newsService.isDuplicate(item.title);
        
        if (check.duplicate) {
          duplicateCount++;
          continue;
        }

        // Kategori adından Kategori ID'si bul
        const catId = catMap.get(item.category) || fallbackCatId;

        // Haberi oluştur
        await newsService.createNews({
          baslik: item.title,
          icerik: item.contentSnippet, // Ham haliyle kaydediyoruz, n8n daha sonra LLM ile güncelleyebilir veya biz doğrudan eğitebiliriz
          kategoriId: catId,
          kaynakUrl: item.link,
          durum: 'hazir', // ML modeli okuyabilsin diye hazir atıyoruz
          llmProvider: 'seed-rss',
        });

        savedCount++;
      } catch (err: any) {
        // newsService.createNews duplicate'lerde throw ConflictError da atıyor olabilir
        if (err.statusCode === 409) {
          duplicateCount++;
        } else {
          errCount++;
          console.error(`❌ Hata (${item.title.substring(0,30)}...):`, err.message);
        }
      }
    }

    console.log(`\n📊 [Seed Pipeline Özet]`);
    console.log(`  - Başarıyla Kaydedilen: ${savedCount}`);
    console.log(`  - Çakışan (Duplicate):  ${duplicateCount}`);
    console.log(`  - Hatalı / Atlanan:     ${errCount}`);
    console.log(`\n🧠 ML modeli yeni verilerle yeniden eğitiliyor...`);

    // 4. ML Modelini trigger'la (Oto Train & Accuracy ölçümü)
    const trainSuccess = await mlService.loadAndTrainFromDB();
    if (trainSuccess) {
      // Yeni accuracy'yi al
      const { accuracy, trainSize, testSize } = await mlService.getAccuracy();
      console.log(`\n🎯 [ML Eğitim Özeti]`);
      console.log(`  - Eğitim Seti Büyüklüğü: ${trainSize} haber`);
      console.log(`  - Test Seti Büyüklüğü:   ${testSize} haber`);
      console.log(`  - Gerçek Accuracy Oranı: %${(accuracy * 100).toFixed(2)}`);
    } else {
      console.warn(`[ML Warn] Model DB üzerinden eğitilemedi!`);
    }

    console.log('\n🎉 Başarıyla tamamlandı!');
  } catch (error) {
    console.error('\n💥 Kritik Seed Hatası:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runSeed();
