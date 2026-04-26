import { MlCategorizationService } from '../src/modules/ml/ml.service';
import { prisma } from '../src/config/database';

async function main() {
  const mlService = new MlCategorizationService();
  const ok = await mlService.loadAndTrainFromDB();
  console.log(JSON.stringify({ trainOk: ok, useCombinedModel: mlService.useCombinedModel }));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
