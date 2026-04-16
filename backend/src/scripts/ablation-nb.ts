/**
 * ablation-nb.ts
 * Trains NB only and exits immediately when NB training completes.
 * Used by the Faz 1 ablation runner to avoid hanging on LR training.
 */
import { MlCategorizationService } from '../modules/ml/ml.service';
import { prisma } from '../config/database';

async function runAblationNb() {
  // Intercept console.log to detect NB training completion and exit cleanly
  const origConsoleLog = console.log.bind(console);
  let exitScheduled = false;

  console.log = (...args: any[]) => {
    origConsoleLog(...args);

    if (exitScheduled) return;
    const msg = args.map(String).join(' ');
    // NB done line: [ML] NAIVE-BAYES (unigram-bigram) başarıyla eğitildi.
    if (msg.includes('NAIVE-BAYES') && msg.includes('itildi')) {
      exitScheduled = true;
      setImmediate(async () => {
        console.log = origConsoleLog;
        try {
          await prisma.$disconnect();
        } catch {
          // ignore
        }
        process.exit(0);
      });
    }
  };

  const mlService = new MlCategorizationService();
  await mlService.loadAndTrainFromDB();

  // Fallback: should not reach here, but clean up if so
  await prisma.$disconnect();
}

runAblationNb().catch((err) => {
  console.error('[ablation-nb] Fatal error:', err);
  process.exit(1);
});
