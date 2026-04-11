/**
 * spot-check-validation.ts
 *
 * Human-in-the-loop spot-check gate for high-confidence records.
 *
 * Purpose:
 *   Prevents blind auto-approval of high-confidence ML predictions.
 *   Batches candidates (confidence > 0.85), samples 3 per batch for manual review,
 *   then applies 3/3 pass rule: all 3 correct → batch accepted; any wrong → full batch rejected.
 *
 * Phases:
 *   Phase 1 (--export): Export candidates and sampled review records to files.
 *   Phase 2 (--apply):  Read completed review file, apply batch accept/reject decisions.
 *
 * Usage:
 *   Phase 1 — export candidates:
 *     npx ts-node scripts/spot-check-validation.ts --export
 *     npx ts-node scripts/spot-check-validation.ts --export --category=Siyaset
 *     npx ts-node scripts/spot-check-validation.ts --export --limit=50
 *
 *   Phase 2 — apply decisions from filled review file:
 *     npx ts-node scripts/spot-check-validation.ts --apply --review-file=backups/spot_check/review_TIMESTAMP.json
 *
 * Review file format (after human fills in):
 *   Each sample entry gets a "decision": "correct" | "wrong"
 *   Batch-level decision is computed automatically from sample decisions.
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CONFIDENCE_THRESHOLD = 0.85;
const BATCH_SIZE = 10;
const SAMPLES_PER_BATCH = 3;
const OUTPUT_DIR = path.join(__dirname, '../../backups/spot_check');

function parseArg(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function sampleRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function exportPhase(categoryFilter?: string, limit?: number) {
  console.log('\n=== SPOT-CHECK VALIDATION — EXPORT PHASE ===');
  console.log(`Confidence threshold: > ${CONFIDENCE_THRESHOLD}`);
  console.log(`Category filter: ${categoryFilter ?? 'ALL'}`);
  console.log(`Max candidates: ${limit ?? 'none'}`);

  const where: any = {
    durum: { in: ['hazir', 'yayinda'] },
    kategoriDogrulandi: false,
    mlConfidence: { gt: CONFIDENCE_THRESHOLD },
  };

  if (categoryFilter) {
    where.kategori = { ad: categoryFilter };
  }

  const candidates = await prisma.haber.findMany({
    where,
    include: { kategori: true },
    orderBy: { mlConfidence: 'desc' },
    take: limit,
  });

  if (candidates.length === 0) {
    console.log('\nNo candidates found matching criteria.');
    await prisma.$disconnect();
    return;
  }

  console.log(`\nFound ${candidates.length} candidate(s).`);

  // Group into batches
  const batches: Array<{
    batchId: number;
    records: typeof candidates;
    sampledForReview: typeof candidates;
  }> = [];

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batchRecords = candidates.slice(i, i + BATCH_SIZE);
    const sampled = sampleRandom(batchRecords, SAMPLES_PER_BATCH);
    batches.push({
      batchId: Math.floor(i / BATCH_SIZE) + 1,
      records: batchRecords,
      sampledForReview: sampled,
    });
  }

  console.log(`Batches: ${batches.length} (${BATCH_SIZE}/batch, ${SAMPLES_PER_BATCH} sampled per batch)`);

  // Build review document
  const reviewDoc = {
    exportedAt: new Date().toISOString(),
    confidenceThreshold: CONFIDENCE_THRESHOLD,
    rule: `3/${SAMPLES_PER_BATCH} correct → batch accepted; any wrong → full batch rejected`,
    totalCandidates: candidates.length,
    batchCount: batches.length,
    batches: batches.map((b) => ({
      batchId: b.batchId,
      totalInBatch: b.records.length,
      allRecordIds: b.records.map((r) => r.id),
      sampledRecords: b.sampledForReview.map((r) => ({
        id: r.id,
        title: r.baslik,
        currentCategory: r.kategori.ad,
        confidence: r.mlConfidence,
        // Human fills this in after review:
        decision: null as 'correct' | 'wrong' | null,
        note: '',
      })),
      // Computed during --apply phase:
      batchDecision: null as 'ACCEPTED' | 'REJECTED' | null,
    })),
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const ts = timestamp();
  const reviewFile = path.join(OUTPUT_DIR, `review_${ts}.json`);
  fs.writeFileSync(reviewFile, JSON.stringify(reviewDoc, null, 2), 'utf8');

  // Print per-batch summary for quick terminal review
  console.log('\n--- Sampled records per batch (requires human review) ---');
  for (const b of batches) {
    console.log(`\n[Batch ${b.batchId}] ids=[${b.records.map((r) => r.id).join(', ')}]`);
    console.log(`  Sampled for review (${b.sampledForReview.length}/${b.records.length}):`);
    for (const r of b.sampledForReview) {
      console.log(`    id=${r.id} conf=${(r.mlConfidence! * 100).toFixed(1)}% cat=${r.kategori.ad} | ${r.baslik.slice(0, 80)}`);
    }
  }

  console.log(`\n✅ Review file written: ${reviewFile}`);
  console.log('→ Open the file, fill in "decision": "correct" | "wrong" for each sampled record.');
  console.log(`→ Then run: npx ts-node scripts/spot-check-validation.ts --apply --review-file=${reviewFile}`);

  await prisma.$disconnect();
}

async function applyPhase(reviewFilePath: string) {
  console.log('\n=== SPOT-CHECK VALIDATION — APPLY PHASE ===');
  console.log(`Review file: ${reviewFilePath}`);

  if (!fs.existsSync(reviewFilePath)) {
    console.error(`ERROR: review file not found: ${reviewFilePath}`);
    process.exit(1);
  }

  const reviewDoc = JSON.parse(fs.readFileSync(reviewFilePath, 'utf8'));

  let totalAccepted = 0;
  let totalRejected = 0;
  let totalApproved = 0;
  const auditLines: string[] = [];

  for (const batch of reviewDoc.batches) {
    const sampleDecisions: string[] = batch.sampledRecords.map((s: any) => s.decision);
    const hasUnfilled = sampleDecisions.some((d: string) => d === null || d === undefined || d === '');
    if (hasUnfilled) {
      console.warn(`[Batch ${batch.batchId}] SKIPPED — some sample decisions not filled in.`);
      auditLines.push(`Batch ${batch.batchId}: SKIPPED (unfilled decisions)`);
      continue;
    }

    const wrongCount = sampleDecisions.filter((d: string) => d === 'wrong').length;
    const batchDecision: 'ACCEPTED' | 'REJECTED' = wrongCount === 0 ? 'ACCEPTED' : 'REJECTED';
    batch.batchDecision = batchDecision;

    if (batchDecision === 'ACCEPTED') {
      // Mark all records in batch as validated
      const ids: number[] = batch.allRecordIds;
      await prisma.haber.updateMany({
        where: { id: { in: ids } },
        data: { kategoriDogrulandi: true },
      });
      totalAccepted++;
      totalApproved += ids.length;
      auditLines.push(`Batch ${batch.batchId}: ACCEPTED (3/3) — ${ids.length} records marked validated [ids: ${ids.join(', ')}]`);
      console.log(`[Batch ${batch.batchId}] ✅ ACCEPTED — ${ids.length} records → kategoriDogrulandi=true`);
    } else {
      auditLines.push(`Batch ${batch.batchId}: REJECTED (${wrongCount} wrong) — sent to manual queue [ids: ${batch.allRecordIds.join(', ')}]`);
      console.log(`[Batch ${batch.batchId}] ❌ REJECTED (${wrongCount} wrong sample(s)) — no DB change, requires manual review`);
      totalRejected++;
    }
  }

  // Write audit log
  const ts = timestamp();
  const auditFile = path.join(OUTPUT_DIR, `audit_${ts}.txt`);
  const auditContent = [
    `Spot-Check Audit Log — ${new Date().toISOString()}`,
    `Review file: ${reviewFilePath}`,
    ``,
    ...auditLines,
    ``,
    `TOTALS: batches_accepted=${totalAccepted} batches_rejected=${totalRejected} records_approved=${totalApproved}`,
  ].join('\n');
  fs.writeFileSync(auditFile, auditContent, 'utf8');

  // Update review file with computed batch decisions
  fs.writeFileSync(reviewFilePath, JSON.stringify(reviewDoc, null, 2), 'utf8');

  console.log('\n=== SUMMARY ===');
  console.log(`Batches accepted : ${totalAccepted}`);
  console.log(`Batches rejected : ${totalRejected}`);
  console.log(`Records approved : ${totalApproved}`);
  console.log(`Audit log written: ${auditFile}`);

  await prisma.$disconnect();
}

async function main() {
  const doExport = hasFlag('export');
  const doApply = hasFlag('apply');

  if (!doExport && !doApply) {
    console.log('Usage:');
    console.log('  npx ts-node scripts/spot-check-validation.ts --export [--category=Siyaset] [--limit=50]');
    console.log('  npx ts-node scripts/spot-check-validation.ts --apply --review-file=<path>');
    process.exit(0);
  }

  if (doExport) {
    const category = parseArg('category');
    const limitStr = parseArg('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    await exportPhase(category, limit);
  } else if (doApply) {
    const reviewFile = parseArg('review-file');
    if (!reviewFile) {
      console.error('ERROR: --review-file=<path> required for --apply');
      process.exit(1);
    }
    await applyPhase(reviewFile);
  }
}

main().catch((err) => {
  console.error('spot-check-validation failed:', err);
  process.exit(1);
});
