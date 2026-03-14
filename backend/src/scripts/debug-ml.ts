import { MlCategorizationService } from '../modules/ml/ml.service';
import { prisma } from '../config/database';

async function debugML() {
  const mlService = new MlCategorizationService();
  console.log('--- ML Debug: Accuracy Investigation ---');
  
  // 1. Check data quality
  const approvedNews = await prisma.haber.findMany({
    where: { durum: { in: ['hazir', 'yayinda'] } },
    include: { kategori: true },
    take: 10 // Let's see some samples
  });

  console.log('Sample Data from DB:');
  approvedNews.forEach(n => {
    console.log(`- [${n.kategori.ad}] ${n.baslik.substring(0, 50)}...`);
  });

  // 2. Trigger manual train
  console.log('\nRetraining...');
  await mlService.loadAndTrainFromDB();
  
  // 3. Get metrics
  const metrics = await mlService.getAccuracy();
  console.log('\nFinal Metrics:', metrics);

  // 4. Manual Test
  const testTitle = 'Fenerbahçe maçı şampiyonluk yolunda kritik galibiyet aldı';
  const prediction = await mlService.categorize(testTitle);
  console.log(`\nManual Test: "${testTitle}"`);
  console.log(`Prediction: ${prediction.kategori} (Confidence: ${prediction.confidence.toFixed(2)})`);
  console.log('Top Scores:', Object.entries(prediction.allScores).sort((a,b) => b[1]-a[1]).slice(0, 3));

  await prisma.$disconnect();
}

debugML();
