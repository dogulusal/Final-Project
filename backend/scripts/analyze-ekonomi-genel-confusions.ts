import { MlCategorizationService } from '../src/modules/ml/ml.service';
import { prisma } from '../src/config/database';

type Sample = {
  id: number;
  title: string;
  text: string;
  category: string;
  publishedAt: Date;
  isManualValidated: boolean;
};

type Misclass = {
  id: number;
  actual: string;
  predicted: string;
  confidence: number;
  title: string;
  summary: string;
};

function normalizeScores(classifications: Array<{ label: string; value: number }>): Record<string, number> {
  const scores: Record<string, number> = {};
  if (!classifications.length) return scores;
  const total = classifications.reduce((sum, c) => sum + c.value, 0);
  classifications.forEach((c) => {
    scores[c.label] = total > 0 ? c.value / total : 1 / classifications.length;
  });
  return scores;
}

async function main() {
  const manualRows = await (prisma as any).$queryRawUnsafe('SELECT haber_id FROM manuel_validasyonlar');
  const manualIds = new Set<number>(
    (manualRows as any[])
      .map((r: any) => Number(r.haber_id))
      .filter((id: number) => Number.isFinite(id)),
  );

  const approvedNews = await (prisma as any).haber.findMany({
    where: {
      durum: { in: ['hazir', 'yayinda'] },
      kategoriDogrulandi: true,
      id: { in: Array.from(manualIds) },
    },
    include: { kategori: true },
    orderBy: { yayinlanmaTarihi: 'asc' },
  });

  const rawDataset: Sample[] = approvedNews.map((news: any) => ({
    id: Number(news.id),
    title: news.baslik,
    text: (news.baslik + ' ' + (news.metaAciklama || '') + ' ' + (news.icerik ? news.icerik.slice(0, 300) : '')).trim(),
    category: news?.kategori?.ad,
    publishedAt: news.yayinlanmaTarihi,
    isManualValidated: true,
  })).filter((s: Sample) => !!s.category);

  const byCategory: Record<string, Sample[]> = {};
  rawDataset.forEach((s) => {
    if (!byCategory[s.category]) byCategory[s.category] = [];
    byCategory[s.category].push(s);
  });

  const trainSet: Sample[] = [];
  const testSet: Sample[] = [];

  // Same temporal split logic: oldest 80% train, newest 20% test per category.
  for (const samples of Object.values(byCategory)) {
    if (samples.length < 3) continue;
    const temporal = [...samples].sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
    const splitIndex = Math.max(1, Math.floor(temporal.length * 0.8));
    const catTrain = temporal.slice(0, splitIndex);
    const catTest = temporal.slice(splitIndex);

    // Mimic manual-only weighting effect (5x)
    catTrain.forEach((s) => {
      for (let i = 0; i < 5; i++) trainSet.push({ ...s });
    });
    testSet.push(...catTest);
  }

  const ml = new MlCategorizationService('naive-bayes', 'unigram-bigram');
  const anyMl = ml as any;
  anyMl.initializeClassifier();

  trainSet.forEach((sample) => {
    const tokens = anyMl.preprocess(sample.text, 'unigram-bigram');
    const processed = tokens.join(' ');
    anyMl.classifier.addDocument(processed, sample.category);
  });
  anyMl.classifier.train();

  const targetMisclasses: Misclass[] = [];
  for (const sample of testSet) {
    const tokens = anyMl.preprocess(sample.text, 'unigram-bigram');
    const processed = tokens.join(' ');
    const predicted = anyMl.classifier.classify(processed) as string;

    const classifications = (anyMl.classifier.getClassifications(processed) || []) as Array<{ label: string; value: number }>;
    const scores = normalizeScores(classifications);
    const confidence = scores[predicted] ?? 0;

    const isEkonomiGenelPair =
      (sample.category === 'Ekonomi' && predicted === 'Genel') ||
      (sample.category === 'Genel' && predicted === 'Ekonomi');

    if (isEkonomiGenelPair) {
      targetMisclasses.push({
        id: sample.id,
        actual: sample.category,
        predicted,
        confidence,
        title: sample.title,
        summary: sample.text.slice(0, 220),
      });
    }
  }

  targetMisclasses.sort((a, b) => b.confidence - a.confidence);
  const top5 = targetMisclasses.slice(0, 5);

  console.log('=== Ekonomi <-> Genel Highest-Confidence Misclassifications (Top 5) ===');
  if (!top5.length) {
    console.log('No Ekonomi<->Genel misclassifications found in current temporal test split.');
  } else {
    top5.forEach((row, idx) => {
      console.log('');
      console.log(`${idx + 1}) ID=${row.id} | ${row.actual} -> ${row.predicted} | confidence=${(row.confidence * 100).toFixed(2)}%`);
      console.log(`   Baslik: ${row.title}`);
      console.log(`   Ozet: ${row.summary.replace(/\s+/g, ' ').trim()}`);
    });
  }

  console.log('');
  console.log(`Total pair errors in split: ${targetMisclasses.length}`);

}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
