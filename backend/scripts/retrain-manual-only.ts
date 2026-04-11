// Persist manual-only trained model to DB
import { mlService } from '../src/modules/ml/ml.controller';

async function main() {
  console.log('[RetainManualOnly] Training with manual-only verified data...');
  const success = await mlService.loadAndTrainFromDB({
    diskSupplementLimit: 0,
    persist: true,
    manualOnlyVerified: true,
  });
  if (success) {
    console.log('[RetainManualOnly] Model persisted successfully');
    process.exit(0);
  } else {
    console.error('[RetainManualOnly] Training failed or guard rejected model');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
