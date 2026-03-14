import { PrismaClient } from '@prisma/client';
import { ImageService } from '../modules/news/image.service';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function backfill() {
  console.log('--- Haber Görseli Backfill Başlatıldı ---');
  
  const newsWithoutImages = await prisma.haber.findMany({
    where: {
      OR: [
        { gorselUrl: null },
        { gorselUrl: '' }
      ]
    },
    include: {
      kategori: true
    }
  });

  console.log(`${newsWithoutImages.length} adet görseli eksik haber bulundu.`);

  let updatedCount = 0;
  for (const item of newsWithoutImages) {
    const imageUrl = ImageService.getRandomImageForCategory(item.kategori.slug);
    
    await prisma.haber.update({
      where: { id: item.id },
      data: { gorselUrl: imageUrl }
    });
    
    updatedCount++;
    if (updatedCount % 100 === 0) {
      console.log(`${updatedCount} haber güncellendi...`);
    }
  }

  console.log(`Bitti! Toplam ${updatedCount} haber görseli güncellendi.`);
  await prisma.$disconnect();
}

backfill().catch(err => {
  console.error('Hata:', err);
  process.exit(1);
});
