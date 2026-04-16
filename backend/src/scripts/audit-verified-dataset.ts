import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function auditDataset() {
  console.log('=== DATASET QUALITY AUDIT ===\n');

  // 1. Total verified count
  const totalVerified = await prisma.haber.count({
    where: { kategoriDogrulandi: true },
  });
  console.log(`Total verified articles: ${totalVerified}`);

  // 2. Category distribution
  const categoryDistribution = await prisma.haber.groupBy({
    by: ['kategoriId'],
    where: { kategoriDogrulandi: true },
    _count: true,
    orderBy: { _count: { kategoriId: 'desc' } },
  });

  // Resolve category names
  const kategoriler = await prisma.kategori.findMany();
  const katMap = new Map(kategoriler.map((k) => [k.id, k.ad]));

  console.log('\nCategory Distribution:');
  for (const dist of categoryDistribution) {
    const name = katMap.get(dist.kategoriId) ?? `id:${dist.kategoriId}`;
    console.log(`  ${name}: ${dist._count}`);
  }

  // 3. Sample 50 verified articles for manual review
  const sample = await prisma.haber.findMany({
    where: { kategoriDogrulandi: true },
    include: { kategori: true },
    take: 50,
    skip: Math.max(0, Math.floor(Math.random() * Math.max(0, totalVerified - 50))),
  });

  console.log(`\nSample of ${sample.length} articles for manual review:`);
  for (let i = 0; i < sample.length; i++) {
    console.log(`${i + 1}. [${sample[i].kategori.ad}] ${sample[i].baslik}`);
  }

  // 4. Class imbalance check
  const counts = categoryDistribution.map((d) => d._count);
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);
  const imbalanceRatio = minCount > 0 ? maxCount / minCount : Infinity;

  console.log(`\nClass Imbalance Ratio (max/min): ${imbalanceRatio.toFixed(2)}x`);
  if (imbalanceRatio > 4) {
    console.warn('⚠️  WARNING: Severe class imbalance detected (>4x). Upsampling may be needed.');
  } else {
    console.log('✓ Class balance acceptable');
  }

  // 5. Noise detection (CJK characters, HTML remnants)
  let noiseCount = 0;
  for (const article of sample) {
    const combinedText = `${article.baslik} ${article.icerik ?? ''}`;
    if (/[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/.test(combinedText)) {
      noiseCount++;
      console.warn(`  Noise [CJK] article id=${article.id}: ${article.baslik.slice(0, 60)}`);
    }
    if (/<[^>]*>/.test(combinedText)) {
      noiseCount++;
      console.warn(`  Noise [HTML] article id=${article.id}: ${article.baslik.slice(0, 60)}`);
    }
  }

  const noisePercentage = (noiseCount / sample.length) * 100;
  console.log(`\nNoise detection: ${noiseCount} articles with issues (${noisePercentage.toFixed(1)}%)`);
  if (noisePercentage > 2) {
    console.warn('⚠️  WARNING: Noise level >2%. Data cleaning recommended before training.');
  } else {
    console.log('✓ Noise level acceptable (<2%)');
  }

  // 6. Decision gate
  const isGreen = noisePercentage <= 2 && imbalanceRatio <= 4;
  console.log(`\n=== AUDIT DECISION: ${isGreen ? '✅ GREEN — Data ready for Faz 1' : '🔴 RED — Review issues above'} ===`);

  await prisma.$disconnect();
}

auditDataset().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
