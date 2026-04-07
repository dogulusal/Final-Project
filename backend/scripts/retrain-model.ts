import { mlService } from '../src/modules/ml/ml.controller';

async function trainModel() {
  try {
    const diskSupplementLimit = Number.parseInt(process.env.ML_DISK_SUPPLEMENT_LIMIT || '0', 10);
    // DEFAULT: FORCE_DISK_FALLBACK=true for production (dataset.json pure training, v51 baseline)
    // Override with FORCE_DISK_FALLBACK=0 to enable DB batch verify (requires SPRINT 3 manual validation)
    const forceDiskFallback = process.env.FORCE_DISK_FALLBACK !== '0';

    console.log('\n📊 [Training] Loading and training ML model with balanced dataset...\n');
    console.log(`[Training] diskSupplementLimit=${diskSupplementLimit}`);
    if (forceDiskFallback) {
      console.log(`[Training] FORCE_DISK_FALLBACK=true (default), using dataset.json pure v51 baseline`);
    } else {
      console.log(`[Training] FORCE_DISK_FALLBACK=false, attempting DB batch verify (requires manual validation)`);
    }
    
    let success: boolean;
    if (forceDiskFallback) {
      success = await mlService.loadAndTrainFromDiskFallback();
    } else {
      success = await mlService.loadAndTrainFromDB({
        diskSupplementLimit
      });
    }
    
    if (success) {
      console.log('\n✅ [Training] Model successfully trained and persisted to database');
      process.exit(0);
    } else {
      console.error('\n❌ [Training] Guard rejected model or training failed. Production model unchanged.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ [Training] Error:', error);
    process.exit(1);
  }
}

trainModel();
