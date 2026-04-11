import { MlCategorizationService } from '../src/modules/ml/ml.service';

type ModeArg = 'unigram' | 'unigram-bigram' | 'unigram-bigram-filtered';
type ModelArg = 'naive-bayes' | 'logistic-regression';

function parseMode(): ModeArg {
    const arg = process.argv.find(a => a.startsWith('--mode='));
    if (!arg) return 'unigram-bigram';
    const value = arg.split('=')[1] as ModeArg;
    if (value === 'unigram' || value === 'unigram-bigram' || value === 'unigram-bigram-filtered') {
        return value;
    }
    return 'unigram-bigram';
}

function parseModel(): ModelArg {
    const arg = process.argv.find(a => a.startsWith('--model='));
    if (!arg) return 'naive-bayes';
    const value = arg.split('=')[1] as ModelArg;
    if (value === 'naive-bayes' || value === 'logistic-regression') {
        return value;
    }
    return 'naive-bayes';
}

function parseDiskSupplementLimit(): number {
    const arg = process.argv.find(a => a.startsWith('--disk-supplement='));
    if (!arg) return Number.parseInt(process.env.ML_DISK_SUPPLEMENT_LIMIT || '0', 10);
    const value = Number(arg.split('=')[1]);
    if (!Number.isFinite(value) || value < 0) return 0;
    return value;
}

function parseManualOnly(): boolean {
    return process.argv.includes('--manual-only');
}

async function run() {
    try {
        const diskSupplementLimit = parseDiskSupplementLimit();
        const forceDiskFallback = process.env.FORCE_DISK_FALLBACK !== '0';
        const mode = parseMode();
        const model = parseModel();
        const manualOnly = parseManualOnly();

        console.log('\n📊 [Benchmark] Non-persist diagnostics run başladı...\n');
        console.log(`[Benchmark] model=${model}`);
        console.log(`[Benchmark] preprocessing=${mode}`);
        console.log(`[Benchmark] diskSupplementLimit=${diskSupplementLimit}`);
        console.log(`[Benchmark] FORCE_DISK_FALLBACK=${forceDiskFallback ? 'true' : 'false'}`);
        console.log(`[Benchmark] manualOnly=${manualOnly}`);

        const mlService = new MlCategorizationService(model, mode);

        // Safety net: even accidental persist path should never touch model_state in benchmark mode.
        (mlService as any).saveModelToDb = async () => {
            console.log('[Benchmark] saveModelToDb bypassed (non-persist mode).');
        };

        const start = Date.now();
        let success = false;

        if (forceDiskFallback) {
            console.log('[Benchmark] dataset.json fallback benchmark çalıştırılıyor (non-persist).');
            success = await mlService.loadAndTrainFromDiskFallback();
        } else {
            console.log('[Benchmark] DB benchmark çalıştırılıyor (non-persist).');
            success = await mlService.loadAndTrainFromDB({
                diskSupplementLimit,
                persist: false,
                manualOnlyVerified: manualOnly,
            });
        }

        const duration = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`[Benchmark] Süre: ${duration}s`);
        console.log(`[Benchmark] Sonuç: ${success ? 'SUCCESS' : 'FAILED_BY_GUARD_OR_DATA'}`);
        console.log(`[Benchmark] Accuracy=%${(mlService.lastAccuracy * 100).toFixed(2)} Train=${mlService.trainSize} Test=${mlService.testSize}`);

        // Always exit 0 for safe experimentation workflow; gate script decides PASS/FAIL.
        process.exit(0);
    } catch (error) {
        console.error('[Benchmark] Hata:', error instanceof Error ? error.message : error);
        process.exit(0);
    }
}

run();
