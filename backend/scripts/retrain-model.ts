import { mlService } from '../src/modules/ml/ml.controller';

async function trainModel() {
  try {
    console.log('\n📊 [Training] Loading and training ML model with balanced dataset...\n');
    
    const success = await mlService.loadAndTrainFromDB();
    
    if (success) {
      console.log('\n✅ [Training] Model successfully trained and persisted to database');
    } else {
      console.error('\n❌ [Training] Failed to train model');
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ [Training] Error:', error);
    process.exit(1);
  }
}

trainModel();
