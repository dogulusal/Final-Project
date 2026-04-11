import { MlCategorizationService } from '../src/modules/ml/ml.service';
import { prisma } from '../src/config/database';

type ModelArg = 'naive-bayes' | 'logistic-regression';

type Sample = {
  id: number;
  text: string;
  category: string;
  publishedAt: Date;
};

function parseModel(): ModelArg {
  const arg = process.argv.find((a) => a.startsWith('--model='));
  if (!arg) return 'naive-bayes';
  const value = arg.split('=')[1] as ModelArg;
  return value === 'logistic-regression' ? 'logistic-regression' : 'naive-bayes';
}

function parseSamples(): number {
  const arg = process.argv.find((a) => a.startsWith('--samples='));
  if (!arg) return 1000;
  const value = Number(arg.split('=')[1]);
  if (!Number.isFinite(value) || value <= 0) return 1000;
  return Math.floor(value);
}

function parseManualOnly(): boolean {
  return process.argv.includes('--manual-only');
}

function parseMaxDbSamples(): number | undefined {
  const arg = process.argv.find((a) => a.startsWith('--max-db-samples='));
  if (!arg) return undefined;
  const value = Number(arg.split('=')[1]);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.floor(value);
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function stats(values: number[]) {
  if (!values.length) {
    return { mean: 0, std: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.length > 1
    ? values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1)
    : 0;

  return {
    mean,
    std: Math.sqrt(variance),
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

async function loadSamples(manualOnly: boolean): Promise<Sample[]> {
  let manualIds: number[] | undefined;

  if (manualOnly) {
    const rows = await (prisma as any).$queryRawUnsafe('SELECT haber_id FROM manuel_validasyonlar');
    manualIds = (rows as any[])
      .map((r: any) => Number(r.haber_id))
      .filter((id: number) => Number.isFinite(id));
  }

  const approvedNews = await (prisma as any).haber.findMany({
    where: {
      durum: { in: ['hazir', 'yayinda'] },
      kategoriDogrulandi: true,
      ...(manualOnly ? { id: { in: manualIds || [] } } : {}),
    },
    include: { kategori: true },
    orderBy: { yayinlanmaTarihi: 'asc' },
  });

  return approvedNews
    .map((news: any) => ({
      id: Number(news.id),
      text: ((news.baslik || '') + ' ' + (news.metaAciklama || '') + ' ' + (news.icerik ? news.icerik.slice(0, 300) : '')).trim(),
      category: news?.kategori?.ad,
      publishedAt: news.yayinlanmaTarihi,
    }))
    .filter((s: Sample) => !!s.category && s.text.length > 0);
}

async function main() {
  const model = parseModel();
  const samplesToRun = parseSamples();
  const manualOnly = parseManualOnly();
  const maxDbSamples = parseMaxDbSamples();

  console.log('=== INFERENCE LATENCY BENCHMARK ===');
  console.log(`model=${model}`);
  console.log(`samples=${samplesToRun}`);
  console.log(`manualOnly=${manualOnly}`);
  if (typeof maxDbSamples === 'number') {
    console.log(`maxDbSamples=${maxDbSamples}`);
  }

  const ml = new MlCategorizationService(model, 'unigram-bigram');

  const ok = await ml.loadAndTrainFromDB({
    persist: false,
    manualOnlyVerified: manualOnly,
    diskSupplementLimit: 0,
    maxDbSamples,
  });

  if (!ok) {
    console.error('Training failed, latency benchmark aborted.');
    process.exit(1);
  }

  const dataset = await loadSamples(manualOnly);
  if (!dataset.length) {
    console.error('No samples found for latency benchmark.');
    process.exit(1);
  }

  // Deterministic round-robin over validated corpus.
  const latenciesMs: number[] = [];
  for (let i = 0; i < samplesToRun; i++) {
    const sample = dataset[i % dataset.length];
    const t0 = process.hrtime.bigint();
    await ml.categorize(sample.text);
    const t1 = process.hrtime.bigint();
    const ms = Number(t1 - t0) / 1_000_000;
    latenciesMs.push(ms);
  }

  const s = stats(latenciesMs);
  console.log('');
  console.log('=== LATENCY SUMMARY (ms) ===');
  console.log(`mean ${s.mean.toFixed(3)}`);
  console.log(`std  ${s.std.toFixed(3)}`);
  console.log(`p50  ${s.p50.toFixed(3)}`);
  console.log(`p95  ${s.p95.toFixed(3)}`);
  console.log(`p99  ${s.p99.toFixed(3)}`);
  console.log(`min  ${s.min.toFixed(3)}`);
  console.log(`max  ${s.max.toFixed(3)}`);

  await (prisma as any).$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('benchmark-inference-latency failed:', err);
  try {
    await (prisma as any).$disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
