/**
 * Combined Score Distribution Simulation
 * 
 * Runs NB-only and NB+LR combined model on existing DB articles
 * to compare confidence distributions and calibrate 3-tier thresholds.
 * 
 * Usage: npx ts-node --transpile-only src/scripts/simulate-combined-scores.ts
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Force combined model ON for this simulation
process.env.ML_USE_COMBINED_MODEL = 'true';
process.env.ML_USE_CLASS_ROUTING = 'true';

async function main() {
  const prisma = new PrismaClient();

  // Dynamic import to pick up env overrides
  const { MlCategorizationService } = await import('../modules/ml/ml.service');
  const mlService = new MlCategorizationService();

  console.log('=== Combined Score Simülasyonu ===\n');
  console.log('Model eğitiliyor...');
  const trained = await mlService.loadAndTrainFromDB({});
  if (!trained) {
    console.error('Model eğitilemedi!');
    process.exit(1);
  }
  console.log('Model hazır.\n');

  // Sample articles: stratified by current confidence bands
  const articles = await prisma.$queryRaw<Array<{
    id: number;
    baslik: string;
    icerik: string | null;
    ml_confidence: number | null;
    kategori_id: number;
    nb_kategori_id: number | null;
    kategori_ad: string;
  }>>`
    SELECT h.id, h.baslik, LEFT(h.icerik, 500) AS icerik,
           h.ml_confidence, h.kategori_id, h.nb_kategori_id,
           COALESCE(k.ad, 'Genel') AS kategori_ad
    FROM haberler h
    LEFT JOIN kategoriler k ON k.id = h.kategori_id
    WHERE h.durum = 'hazir'
    ORDER BY RANDOM()
    LIMIT 500
  `;

  console.log(`${articles.length} haber üzerinde simülasyon...\n`);

  const nbScores: number[] = [];
  const combinedScores: number[] = [];
  const nbCorrect: number[] = [];
  const combinedCorrect: number[] = [];

  // Category-level tracking
  const catStats: Record<string, { nbConfs: number[]; combConfs: number[]; nbMatch: number; combMatch: number; total: number }> = {};

  for (const art of articles) {
    const text = `${art.baslik} ${(art.icerik || '').slice(0, 300)}`.trim();
    if (!text) continue;

    try {
      // NB-only (current pipeline)
      const nbResult = await mlService.categorize(art.baslik, art.icerik || undefined);

      // Combined NB+LR
      const nbProbs = (mlService as any).getNbProbabilities(text);
      const lrProbs = await (mlService as any).getLrProbabilities(text);
      const cats = (mlService as any).indexCategory() as string[];
      const combined = (mlService as any).softVoteCombine(nbProbs, lrProbs, cats) as number[];

      let maxIdx = 0;
      for (let i = 1; i < combined.length; i++) {
        if (combined[i] > combined[maxIdx]) maxIdx = i;
      }
      const combinedConf = combined[maxIdx];
      const combinedCat = cats[maxIdx];

      nbScores.push(nbResult.confidence);
      combinedScores.push(combinedConf);

      const isNbCorrect = nbResult.kategori === art.kategori_ad ? 1 : 0;
      const isCombCorrect = combinedCat === art.kategori_ad ? 1 : 0;
      nbCorrect.push(isNbCorrect);
      combinedCorrect.push(isCombCorrect);

      // Per-category
      if (!catStats[art.kategori_ad]) {
        catStats[art.kategori_ad] = { nbConfs: [], combConfs: [], nbMatch: 0, combMatch: 0, total: 0 };
      }
      const cs = catStats[art.kategori_ad];
      cs.nbConfs.push(nbResult.confidence);
      cs.combConfs.push(combinedConf);
      cs.nbMatch += isNbCorrect;
      cs.combMatch += isCombCorrect;
      cs.total += 1;
    } catch (e) {
      // Skip errors
    }
  }

  // === Summary Statistics ===
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const median = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const percentile = (arr: number[], p: number) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * p);
    return sorted[Math.min(idx, sorted.length - 1)];
  };

  console.log('=== GENEL İSTATİSTİKLER ===');
  console.log(`Toplam: ${nbScores.length} haber\n`);

  console.log('                  NB-only    Combined');
  console.log(`Ortalama conf:    ${avg(nbScores).toFixed(3)}      ${avg(combinedScores).toFixed(3)}`);
  console.log(`Medyan conf:      ${median(nbScores).toFixed(3)}      ${median(combinedScores).toFixed(3)}`);
  console.log(`P10 conf:         ${percentile(nbScores, 0.10).toFixed(3)}      ${percentile(combinedScores, 0.10).toFixed(3)}`);
  console.log(`P25 conf:         ${percentile(nbScores, 0.25).toFixed(3)}      ${percentile(combinedScores, 0.25).toFixed(3)}`);
  console.log(`P75 conf:         ${percentile(nbScores, 0.75).toFixed(3)}      ${percentile(combinedScores, 0.75).toFixed(3)}`);
  console.log(`P90 conf:         ${percentile(nbScores, 0.90).toFixed(3)}      ${percentile(combinedScores, 0.90).toFixed(3)}`);
  console.log(`Accuracy (vs DB): ${(avg(nbCorrect) * 100).toFixed(1)}%      ${(avg(combinedCorrect) * 100).toFixed(1)}%`);

  // Distribution bins
  const bins = [0, 0.30, 0.45, 0.55, 0.65, 0.75, 0.85, 1.01];
  const binLabels = ['<0.30', '0.30-0.44', '0.45-0.54', '0.55-0.64', '0.65-0.74', '0.75-0.84', '>=0.85'];

  console.log('\n=== DAĞILIM (confidence band → haber sayısı) ===');
  console.log('Band          NB-only    Combined');
  for (let i = 0; i < bins.length - 1; i++) {
    const nbCount = nbScores.filter(s => s >= bins[i] && s < bins[i + 1]).length;
    const combCount = combinedScores.filter(s => s >= bins[i] && s < bins[i + 1]).length;
    console.log(`${binLabels[i].padEnd(14)} ${String(nbCount).padStart(5)}      ${String(combCount).padStart(5)}`);
  }

  // 3-tier threshold analysis
  console.log('\n=== 3-TIER EŞİK ANALİZİ ===');
  const thresholds = [
    { high: 0.80, low: 0.55 },
    { high: 0.75, low: 0.50 },
    { high: 0.70, low: 0.45 },
    { high: 0.85, low: 0.60 },
  ];

  for (const t of thresholds) {
    const highCount = combinedScores.filter(s => s >= t.high).length;
    const midCount = combinedScores.filter(s => s >= t.low && s < t.high).length;
    const lowCount = combinedScores.filter(s => s < t.low).length;

    // Accuracy per tier
    const highAcc = combinedCorrect.filter((_, i) => combinedScores[i] >= t.high);
    const midAcc = combinedCorrect.filter((_, i) => combinedScores[i] >= t.low && combinedScores[i] < t.high);
    const lowAcc = combinedCorrect.filter((_, i) => combinedScores[i] < t.low);

    const pctAcc = (arr: number[]) => arr.length ? (avg(arr) * 100).toFixed(1) + '%' : 'N/A';

    console.log(`\n  Eşikler: HIGH >= ${t.high}, MID >= ${t.low}, LOW < ${t.low}`);
    console.log(`  HIGH (direkt yayınla):  ${highCount} haber (${(highCount / combinedScores.length * 100).toFixed(1)}%) — doğruluk: ${pctAcc(highAcc)}`);
    console.log(`  MID (LLM consensus):    ${midCount} haber (${(midCount / combinedScores.length * 100).toFixed(1)}%) — doğruluk: ${pctAcc(midAcc)}`);
    console.log(`  LOW (inceleme kuyruğu): ${lowCount} haber (${(lowCount / combinedScores.length * 100).toFixed(1)}%) — doğruluk: ${pctAcc(lowAcc)}`);
  }

  // Per-category breakdown
  console.log('\n=== KATEGORİ BAZLI ===');
  console.log('Kategori      N    NB avg   Comb avg   NB acc   Comb acc');
  for (const [cat, s] of Object.entries(catStats).sort((a, b) => b[1].total - a[1].total)) {
    console.log(
      `${cat.padEnd(14)} ${String(s.total).padStart(3)}  ` +
      `${avg(s.nbConfs).toFixed(3)}    ${avg(s.combConfs).toFixed(3)}      ` +
      `${(s.nbMatch / s.total * 100).toFixed(0)}%      ${(s.combMatch / s.total * 100).toFixed(0)}%`
    );
  }

  await prisma.$disconnect();
  console.log('\n✓ Simülasyon tamamlandı.');
}

main().catch(e => {
  console.error('Hata:', e);
  process.exit(1);
});
