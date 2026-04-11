/**
 * export-boundary-cases.ts
 *
 * Exports Genel <-> Siyaset boundary cases for manual review.
 *
 * Finds records that the model classifies near the Genel/Siyaset decision boundary:
 *   - Category=Genel but Siyaset confidence is within X% of top score
 *   - Category=Siyaset but confidence is below low-confidence threshold
 *
 * Labeling policy (per spec):
 *   - If uncertain → keep as Genel
 *   - Do NOT force ambiguous records into Siyaset
 *
 * Usage:
 *   npx ts-node scripts/export-boundary-cases.ts
 *   npx ts-node scripts/export-boundary-cases.ts --limit=30 --gap=0.15
 *
 * Output:
 *   - backups/benchmark_state/boundary_cases_TIMESTAMP.csv   (human review sheet)
 *   - backups/benchmark_state/boundary_cases_TIMESTAMP.json  (machine-readable)
 *
 * After manual review, apply corrections directly via SQL or the existing
 * review-low-confidence.ts --fix flow.
 */

import fs from 'fs';
import path from 'path';
import { MlCategorizationService } from '../src/modules/ml/ml.service';
import { prisma } from '../src/config/database';

const OUTPUT_DIR = path.join(__dirname, '../../backups/benchmark_state');
const DEFAULT_LIMIT = 30;
const DEFAULT_GAP = 0.15;        // Siyaset score within 15pp of top score counts as "near-boundary"
const LOW_CONF_SIYASET = 0.65;   // Siyaset records with confidence below this are candidates

function parseArg(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : undefined;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
}

function normalizeScores(classifications: Array<{ label: string; value: number }>): Record<string, number> {
  if (!classifications.length) return {};
  const total = classifications.reduce((s, c) => s + c.value, 0);
  const out: Record<string, number> = {};
  classifications.forEach((c) => {
    out[c.label] = total > 0 ? c.value / total : 1 / classifications.length;
  });
  return out;
}

async function main() {
  const limitArg = parseArg('limit');
  const gapArg = parseArg('gap');
  const limit = limitArg ? parseInt(limitArg, 10) : DEFAULT_LIMIT;
  const gap = gapArg ? parseFloat(gapArg) : DEFAULT_GAP;

  console.log('\n=== EXPORT GENEL<->SIYASET BOUNDARY CASES ===');
  console.log(`Limit: ${limit} records`);
  console.log(`Near-boundary gap: ${(gap * 100).toFixed(0)}pp`);
  console.log(`Low-conf Siyaset threshold: < ${(LOW_CONF_SIYASET * 100).toFixed(0)}%`);

  // Load and train model
  console.log('\nTraining model on manual-only verified data...');
  const mlService = new MlCategorizationService('naive-bayes', 'unigram-bigram');
  (mlService as any).saveModelToDb = async () => {};
  const ok = await mlService.loadAndTrainFromDB({ persist: false, manualOnlyVerified: true });

  if (!ok) {
    console.error('Model training failed. Aborting.');
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`Model trained. accuracy=${(mlService.lastAccuracy * 100).toFixed(2)}%`);

  // Load candidate records
  const manualRows = await (prisma as any).$queryRawUnsafe('SELECT haber_id FROM manuel_validasyonlar');
  const manualIds = new Set<number>((manualRows as any[]).map((r: any) => Number(r.haber_id)));

  const allVerified = await prisma.haber.findMany({
    where: {
      durum: { in: ['hazir', 'yayinda'] },
      kategoriDogrulandi: true,
    },
    include: { kategori: true },
    orderBy: { yayinlanmaTarihi: 'asc' },
  });

  console.log(`Loaded ${allVerified.length} verified records for scoring.`);

  type BoundaryRecord = {
    id: number;
    title: string;
    currentCategory: string;
    isManualValidated: boolean;
    predictedCategory: string;
    topScore: number;
    siyasetScore: number;
    genelScore: number;
    gap: number;
    boundaryType: 'GENEL_NEAR_SIYASET' | 'SIYASET_LOW_CONF';
    suggestedAction: string;
    humanDecision: string;  // filled in manually: "keep" | "move:Siyaset" | etc.
    note: string;
  };

  const boundaryRecords: BoundaryRecord[] = [];

  for (const news of allVerified) {
    const text = (news.baslik + ' ' + (news.metaAciklama || '') + ' ' + (news.icerik ? (news.icerik as string).slice(0, 300) : '')).trim();
    const tokens = (mlService as any).preprocess(text, 'unigram-bigram');
    const processedText = tokens.join(' ');

    let classifications: Array<{ label: string; value: number }> = [];
    try {
      classifications = mlService.classifier.getClassifications(processedText) || [];
    } catch {
      continue;
    }

    const scores = normalizeScores(classifications);
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) continue;

    const topScore = sorted[0][1];
    const predictedCategory = sorted[0][0];
    const siyasetScore = scores['Siyaset'] ?? 0;
    const genelScore = scores['Genel'] ?? 0;

    const catName = news.kategori.ad;
    const isManualValidated = manualIds.has(Number(news.id));

    // Type 1: Genel records where Siyaset is near-boundary
    if (catName === 'Genel') {
      const siyasetGap = topScore - siyasetScore;
      if (siyasetGap <= gap) {
        boundaryRecords.push({
          id: Number(news.id),
          title: news.baslik,
          currentCategory: catName,
          isManualValidated,
          predictedCategory,
          topScore: Math.round(topScore * 1000) / 1000,
          siyasetScore: Math.round(siyasetScore * 1000) / 1000,
          genelScore: Math.round(genelScore * 1000) / 1000,
          gap: Math.round(siyasetGap * 1000) / 1000,
          boundaryType: 'GENEL_NEAR_SIYASET',
          suggestedAction: 'Review: is this Siyaset? If uncertain → keep as Genel.',
          humanDecision: '',
          note: '',
        });
      }
    }

    // Type 2: Siyaset records with low confidence
    if (catName === 'Siyaset' && news.mlConfidence !== null && (news.mlConfidence ?? 1) < LOW_CONF_SIYASET) {
      boundaryRecords.push({
        id: Number(news.id),
        title: news.baslik,
        currentCategory: catName,
        isManualValidated,
        predictedCategory,
        topScore: Math.round(topScore * 1000) / 1000,
        siyasetScore: Math.round(siyasetScore * 1000) / 1000,
        genelScore: Math.round(genelScore * 1000) / 1000,
        gap: Math.round((topScore - siyasetScore) * 1000) / 1000,
        boundaryType: 'SIYASET_LOW_CONF',
        suggestedAction: 'Review: is this actually Genel or another category?',
        humanDecision: '',
        note: '',
      });
    }
  }

  // Deduplicate (a record can only appear once)
  const seen = new Set<number>();
  const deduped = boundaryRecords.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  // Sort: smallest gap first (hardest cases first)
  deduped.sort((a, b) => a.gap - b.gap);

  // Apply limit
  const final = deduped.slice(0, limit);

  console.log(`\nBoundary candidates found: ${deduped.length}`);
  console.log(`  GENEL_NEAR_SIYASET : ${deduped.filter((r) => r.boundaryType === 'GENEL_NEAR_SIYASET').length}`);
  console.log(`  SIYASET_LOW_CONF   : ${deduped.filter((r) => r.boundaryType === 'SIYASET_LOW_CONF').length}`);
  console.log(`Exporting top ${final.length} (hardest boundary cases first).`);

  // Print review table to terminal
  console.log('\n' + '─'.repeat(120));
  console.log(`${'ID'.padEnd(6)} ${'Type'.padEnd(22)} ${'Current'.padEnd(10)} ${'Predicted'.padEnd(11)} ${'Top'.padEnd(6)} ${'Siyaset'.padEnd(9)} ${'Gap'.padEnd(6)} Title`);
  console.log('─'.repeat(120));
  for (const r of final) {
    const mv = r.isManualValidated ? '✓' : ' ';
    console.log(
      `${String(r.id).padEnd(6)} ${r.boundaryType.padEnd(22)} ${r.currentCategory.padEnd(10)} ${r.predictedCategory.padEnd(11)} ` +
      `${(r.topScore * 100).toFixed(1).padEnd(6)} ${(r.siyasetScore * 100).toFixed(1).padEnd(9)} ${(r.gap * 100).toFixed(1).padEnd(6)} ` +
      `[${mv}] ${r.title.slice(0, 60)}`
    );
  }
  console.log('─'.repeat(120));

  // Write CSV
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const ts = timestamp();

  const csvHeader = 'id,boundaryType,currentCategory,isManualValidated,predictedCategory,topScore,siyasetScore,genelScore,gap,suggestedAction,humanDecision,note,title';
  const csvRows = final.map((r) =>
    [
      r.id,
      r.boundaryType,
      r.currentCategory,
      r.isManualValidated,
      r.predictedCategory,
      r.topScore,
      r.siyasetScore,
      r.genelScore,
      r.gap,
      `"${r.suggestedAction}"`,
      r.humanDecision,
      r.note,
      `"${r.title.replace(/"/g, "'")}"`,
    ].join(',')
  );
  const csvContent = [csvHeader, ...csvRows].join('\n');
  const csvFile = path.join(OUTPUT_DIR, `boundary_cases_${ts}.csv`);
  fs.writeFileSync(csvFile, csvContent, 'utf8');

  // Write JSON
  const jsonFile = path.join(OUTPUT_DIR, `boundary_cases_${ts}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify({
    exportedAt: new Date().toISOString(),
    labelingPolicy: 'If uncertain → keep as Genel. Do NOT force ambiguous records into Siyaset.',
    totalCandidates: deduped.length,
    exported: final.length,
    records: final,
  }, null, 2), 'utf8');

  console.log(`\n✅ CSV  written: ${csvFile}`);
  console.log(`✅ JSON written: ${jsonFile}`);
  console.log('\nNext steps:');
  console.log('  1. Open the CSV, fill in "humanDecision" column: "keep" | "move:Siyaset" | "move:Genel" | other');
  console.log('  2. Apply corrections via SQL UPDATE or review-low-confidence.ts --fix');
  console.log('  3. Retrain and run Batch-21c benchmark');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('export-boundary-cases failed:', err);
  process.exit(1);
});
