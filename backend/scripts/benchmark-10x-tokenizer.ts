import { MlCategorizationService } from '../src/modules/ml/ml.service';

type ModeArg = 'unigram' | 'unigram-bigram' | 'unigram-bigram-filtered';
type ModelArg = 'naive-bayes' | 'logistic-regression';

type RunResult = {
  run: number;
  success: boolean;
  accuracy: number;
  macroF1: number;
  siyasetF1: number;
  siyasetSupport: number;
  trainSize: number;
  testSize: number;
  durationSec: number;
  categorySupports: Record<string, number>;
};

function parseMode(): ModeArg {
  const arg = process.argv.find((a) => a.startsWith('--mode='));
  if (!arg) return 'unigram-bigram';
  const value = arg.split('=')[1] as ModeArg;
  if (value === 'unigram' || value === 'unigram-bigram' || value === 'unigram-bigram-filtered') {
    return value;
  }
  return 'unigram-bigram';
}

function parseModel(): ModelArg {
  const arg = process.argv.find((a) => a.startsWith('--model='));
  if (!arg) return 'naive-bayes';
  const value = arg.split('=')[1] as ModelArg;
  if (value === 'naive-bayes' || value === 'logistic-regression') {
    return value;
  }
  return 'naive-bayes';
}

function parseRuns(): number {
  const arg = process.argv.find((a) => a.startsWith('--runs='));
  if (!arg) return 10;
  const value = Number(arg.split('=')[1]);
  if (!Number.isFinite(value) || value <= 0) return 10;
  return Math.floor(value);
}

function parseDiskSupplementLimit(): number {
  const arg = process.argv.find((a) => a.startsWith('--disk-supplement='));
  if (!arg) return Number.parseInt(process.env.ML_DISK_SUPPLEMENT_LIMIT || '0', 10);
  const value = Number(arg.split('=')[1]);
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
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

function safeNum(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return value;
}

function stats(values: number[]): { mean: number; std: number; min: number; max: number } {
  if (values.length === 0) {
    return { mean: 0, std: 0, min: 0, max: 0 };
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (values.length === 1) {
    return { mean, std: 0, min, max };
  }

  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  const std = Math.sqrt(variance);
  return { mean, std, min, max };
}

async function runSingleBenchmark(
  run: number,
  model: ModelArg,
  mode: ModeArg,
  forceDiskFallback: boolean,
  diskSupplementLimit: number,
  manualOnly: boolean,
  maxDbSamples?: number,
): Promise<RunResult> {
  const mlService = new MlCategorizationService(model, mode);

  (mlService as any).saveModelToDb = async () => {
    // Non-persist experiment mode.
  };

  const start = Date.now();
  let success = false;

  if (forceDiskFallback) {
    success = await mlService.loadAndTrainFromDiskFallback();
  } else {
    success = await mlService.loadAndTrainFromDB({
      diskSupplementLimit,
      persist: false,
      manualOnlyVerified: manualOnly,
      maxDbSamples,
    });
  }

  const diagnostics = (mlService as any).lastDiagnostics;
  const siyasetMetrics = diagnostics?.metrics?.Siyaset;

  const categorySupports: Record<string, number> = {};
  if (diagnostics?.metrics) {
    for (const [cat, m] of Object.entries(diagnostics.metrics)) {
      categorySupports[cat] = safeNum((m as any)?.support);
    }
  }

  return {
    run,
    success,
    accuracy: safeNum(mlService.lastAccuracy),
    macroF1: safeNum(diagnostics?.macroF1),
    siyasetF1: safeNum(siyasetMetrics?.f1),
    siyasetSupport: safeNum(siyasetMetrics?.support),
    trainSize: safeNum(mlService.trainSize),
    testSize: safeNum(mlService.testSize),
    durationSec: (Date.now() - start) / 1000,
    categorySupports,
  };
}

async function main() {
  try {
    const runs = parseRuns();
    const diskSupplementLimit = parseDiskSupplementLimit();
    const forceDiskFallback = process.env.FORCE_DISK_FALLBACK !== '0';
    const mode = parseMode();
    const model = parseModel();
    const manualOnly = parseManualOnly();
    const maxDbSamples = parseMaxDbSamples();

    console.log('');
    console.log('=== BENCHMARK 10X TOKENIZER STABILITY ===');
    console.log(`runs=${runs}`);
    console.log(`model=${model}`);
    console.log(`mode=${mode}`);
    console.log(`diskSupplementLimit=${diskSupplementLimit}`);
    console.log(`FORCE_DISK_FALLBACK=${forceDiskFallback ? 'true' : 'false'}`);
    console.log(`manualOnly=${manualOnly}`);
    if (typeof maxDbSamples === 'number') {
      console.log(`maxDbSamples=${maxDbSamples}`);
    }
    console.log('');

    const results: RunResult[] = [];

    for (let i = 1; i <= runs; i++) {
      const r = await runSingleBenchmark(i, model, mode, forceDiskFallback, diskSupplementLimit, manualOnly, maxDbSamples);
      results.push(r);

      console.log(
        `[Run ${r.run.toString().padStart(2, '0')}] ` +
          `success=${r.success ? 'Y' : 'N'} ` +
          `acc=${(r.accuracy * 100).toFixed(2)} ` +
          `macroF1=${r.macroF1.toFixed(3)} ` +
          `siyasetF1=${r.siyasetF1.toFixed(3)} ` +
          `support=${r.siyasetSupport} ` +
          `train=${r.trainSize} ` +
          `test=${r.testSize} ` +
          `dur=${r.durationSec.toFixed(1)}s`,
      );

      const lowSupport = Object.entries(r.categorySupports).filter(([, s]) => s < 10);
      if (lowSupport.length > 0) {
        console.log(`[Run ${r.run.toString().padStart(2, '0')}][WARN] Low test support: ${lowSupport.map(([c, s]) => `${c}=${s}`).join(', ')}`);
      }
    }

    const accStats = stats(results.map((r) => r.accuracy));
    const macroStats = stats(results.map((r) => r.macroF1));
    const siyasetStats = stats(results.map((r) => r.siyasetF1));
    const supportStats = stats(results.map((r) => r.siyasetSupport));

    console.log('');
    console.log('=== SUMMARY (mean ± std | min..max) ===');
    console.log(
      `Accuracy      ${(accStats.mean * 100).toFixed(2)} ± ${(accStats.std * 100).toFixed(2)} | ${(accStats.min * 100).toFixed(2)}..${(accStats.max * 100).toFixed(2)}`,
    );
    console.log(
      `Macro-F1      ${macroStats.mean.toFixed(3)} ± ${macroStats.std.toFixed(3)} | ${macroStats.min.toFixed(3)}..${macroStats.max.toFixed(3)}`,
    );
    console.log(
      `Siyaset F1    ${siyasetStats.mean.toFixed(3)} ± ${siyasetStats.std.toFixed(3)} | ${siyasetStats.min.toFixed(3)}..${siyasetStats.max.toFixed(3)}`,
    );
    console.log(
      `Siyaset Supp. ${supportStats.mean.toFixed(1)} ± ${supportStats.std.toFixed(1)} | ${supportStats.min.toFixed(0)}..${supportStats.max.toFixed(0)}`,
    );

    console.log('');
    if (siyasetStats.std > 0.05) {
      console.log('Decision: std > 0.05 -> Önce support/veri sorunu çözülmeli, hard negative aşamasına geçmeyin.');
    } else {
      console.log('Decision: std <= 0.05 -> Bigram listesi/coverage üzerinden iyileştirmeye devam edin.');
    }

    // Per-category support table (min/mean/max across runs)
    const allCats = Array.from(new Set(results.flatMap((r) => Object.keys(r.categorySupports)))).sort();
    if (allCats.length > 0) {
      console.log('');
      console.log('=== CATEGORY TEST SUPPORT (min / mean / max across runs) ===');
      for (const cat of allCats) {
        const vals = results.map((r) => r.categorySupports[cat] ?? 0);
        const catStats = stats(vals);
        const flag = catStats.min < 10 ? ' ⚠ LOW' : '';
        console.log(`  ${cat.padEnd(12)} min=${catStats.min.toFixed(0).padStart(3)} mean=${catStats.mean.toFixed(1).padStart(5)} max=${catStats.max.toFixed(0).padStart(3)}${flag}`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('benchmark-10x-tokenizer failed:', error);
    process.exit(1);
  }
}

main();
