import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log("=== ML Eğitim Verisi Oluşturma Başlıyor ===");

  try {
    // 1. Dosya Yollarını Belirle
    const rootDir = path.resolve(__dirname, '../../..');
    const datasetDirPath = path.resolve(rootDir, 'training/naive-bayes');
    const datasetPath = path.resolve(datasetDirPath, 'dataset.json');
    const backupPath = path.resolve(datasetDirPath, 'dataset.backup.json');

    console.log(`Hedef dizin: ${datasetDirPath}`);

    if (!fs.existsSync(datasetDirPath)) {
      fs.mkdirSync(datasetDirPath, { recursive: true });
    }

    // 2. Mevcut Veriyi Yedekle
    if (fs.existsSync(datasetPath)) {
      fs.copyFileSync(datasetPath, backupPath);
      console.log(`Mevcut veri seti yedeklendi: ${backupPath}`);
    }

    // 3. DB'den Temiz Veriyi Çek
    console.log("Veritabanına bağlanılıyor...");
    const news = await prisma.haber.findMany({
      where: {
        durum: { in: ['hazir', 'yayinda'] }
      },
      include: {
        kategori: true
      }
    });

    console.log(`DB'de ${news.length} adet temiz haber bulundu.`);

    if (news.length < 5) {
      console.warn("Eğitim için yeterli haber yok.");
      return;
    }

    // 4. ML Formatına Dönüştür
    const dataset = news.map(item => {
        if (!item.kategori) {
            console.warn(`Haber ID ${item.id} kategorisi eksik, atlanıyor.`);
            return null;
        }
        return {
            text: `${item.baslik} ${item.icerik || ''}`.trim(),
            category: item.kategori.ad
        };
    }).filter(Boolean);

    // 5. JSON Olarak Kaydet
    fs.writeFileSync(datasetPath, JSON.stringify(dataset, null, 2), 'utf-8');
    console.log(`Yeni eğitim veri seti başarıyla oluşturuldu: ${datasetPath}`);
    console.log(`Toplam Örnek Sayısı: ${dataset.length}`);
    
    const distribution: Record<string, number> = {};
    dataset.forEach((d: any) => {
      distribution[d.category] = (distribution[d.category] || 0) + 1;
    });
    console.log("Kategori Dağılımı:", distribution);

  } catch (err) {
    console.error("KRİTİK HATA:", err);
    throw err;
  }
}

main()
  .catch(e => {
    console.error("Script fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
