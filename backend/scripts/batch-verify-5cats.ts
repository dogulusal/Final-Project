import { PrismaClient } from '@prisma/client';
import { mlService } from '../src/modules/ml/ml.controller';

/**
 * Faz 4 Batch Verify: 5 kategoriden 7'şer haber seç, verify et, retrain
 * Kategoriler: Teknoloji, Ekonomi, Genel, Dünya, Sağlık
 * (Siyaset hariç: dataset.json'da 129 kayıt zaten var, risk yok)
 * (Spor hariç: 0.394 confidence HIGH RISK)
 * Total: 35 kayıt/batch
 */

const prisma = new PrismaClient();

async function verifyBatch5Categories() {
  try {
    console.log('\n🔄 [Batch Verify Faz 4] 5 kategori, 35 kayıt batch başlıyor...\n');

    // Read current accuracy before batch
    const modelBefore = await prisma.modelState.findFirst({
      orderBy: { version: 'desc' }
    });
    
    if (!modelBefore) {
      console.error('[Batch] No model found in DB');
      process.exit(1);
    }

    const accuracyBefore = modelBefore.accuracy ?? 0;
    console.log(`[Batch] Model state before: v${modelBefore.version}, accuracy=%${(accuracyBefore * 100).toFixed(2)}`);

    // Target 5 kategoriler
    const targetCategories = ['Teknoloji', 'Ekonomi', 'Genel', 'Dünya', 'Sağlık'];
    
    // Fetch categoryIds for target categories
    const categoryMap = await prisma.kategori.findMany({
      where: { ad: { in: targetCategories } },
      select: { id: true, ad: true }
    });

    const catIdMap: Record<number, string> = {};
    categoryMap.forEach(c => {
      catIdMap[c.id] = c.ad;
    });

    console.log(`[Batch] Target kategoriler: ${categoryMap.map(c => c.ad).join(', ')}`);

    // SQL: Select 7 random haberler per category from hazir/yayinda, not yet verified
    const targetIds: number[] = [];
    
    for (const cat of categoryMap) {
      const haberler = await prisma.haber.findMany({
        where: {
          kategoriId: cat.id,
          durum: { in: ['hazir', 'yayinda'] },
          kategoriDogrulandi: false  // Not yet verified
        },
        orderBy: {
          yayinlanmaTarihi: 'asc'
        },
        take: 7,
        select: { id: true }
      });

      console.log(`[Batch] ${cat.ad}: Found ${haberler.length} candidates`);
      targetIds.push(...haberler.map(h => h.id));
    }

    if (targetIds.length === 0) {
      console.warn('[Batch] No unverified haberler found in target categories');
      process.exit(0);
    }

    console.log(`\n[Batch] Total haberler to verify: ${targetIds.length}`);
    console.log(`[Batch] IDs: [${targetIds.slice(0, 10).join(', ')}${targetIds.length > 10 ? '...' : ''}]\n`);

    // Mark these haberler as verified (kategoriDogrulandi = true)
    const updateResult = await prisma.haber.updateMany({
      where: { id: { in: targetIds } },
      data: { kategoriDogrulandi: true }
    });

    console.log(`[Batch] ✓ Marked ${updateResult.count} haberler as verified (tentative)\n`);

    // Retrain with new data
    console.log('[ML] Retraining with new verified data...\n');
    const retrainSuccess = await mlService.loadAndTrainFromDB({
      diskSupplementLimit: 0  // No disk supplement, pure DB + dataset.json for weak cats
    });

    if (!retrainSuccess) {
      console.error('[Batch] ❌ Retrain failed, rolling back verification...\n');
      const rollbackResult = await prisma.haber.updateMany({
        where: { id: { in: targetIds } },
        data: { kategoriDogrulandi: false }
      });
      console.log(`[Batch] Rolled back ${rollbackResult.count} haberler\n`);
      process.exit(1);
    }

    // Check accuracy post-retrain
    const modelAfter = await prisma.modelState.findFirst({
      orderBy: { version: 'desc' }
    });

    if (!modelAfter) {
      console.error('[Batch] No model found after retrain');
      // Rollback on failure
      const rollbackResult = await prisma.haber.updateMany({
        where: { id: { in: targetIds } },
        data: { kategoriDogrulandi: false }
      });
      console.log(`[Batch] Rolled back ${rollbackResult.count} haberler due to no model\n`);
      process.exit(1);
    }

    const accuracyAfter = modelAfter.accuracy ?? accuracyBefore;
    const accuracyDelta = (accuracyAfter - accuracyBefore) * 100;

    console.log(`[Batch] Model state after: v${modelAfter.version}, accuracy=%${(accuracyAfter * 100).toFixed(2)}`);
    console.log(`[Batch] Δ Accuracy: %${accuracyDelta.toFixed(2)}\n`);

    // Critical Guard: Check if model is the SAME VERSION as before (indicating Guard 4 rejected save)
    if (modelAfter.version === modelBefore.version) {
      console.error(`❌ [Batch] BAŞARISIZ: Model version unchanged (v${modelAfter.version}). Guard likely rejected due to calibration failure.\n`);
      console.error(`[Batch] Rolling back ${updateResult.count} haberler...\n`);
      const rollbackResult = await prisma.haber.updateMany({
        where: { id: { in: targetIds } },
        data: { kategoriDogrulandi: false }
      });
      console.log(`[Batch] Rolled back ${rollbackResult.count} haberler\n`);
      process.exit(1);
    }

    // Guard 1 check: If accuracy dropped > 5pp, explicitly roll back
    if ((accuracyAfter ?? 0) < (accuracyBefore ?? 0) - 0.05) {
      console.error(`❌ [Batch] BAŞARISIZ: Accuracy dropped > 5pp. Rolling back...\n`);
      const rollbackResult = await prisma.haber.updateMany({
        where: { id: { in: targetIds } },
        data: { kategoriDogrulandi: false }
      });
      console.log(`[Batch] Rolled back ${rollbackResult.count} haberler\n`);
      process.exit(1);
    }

    // All checks passed!
    console.log(`✅ [Batch] BAŞARILI: Model improved/stable and saved. Batch haberler verified.\n`);
    console.log(`[Batch Summary]`);
    console.log(`  - Kategoriler: ${targetCategories.join(', ')}`);
    console.log(`  - Verified: ${updateResult.count} haberler`);
    console.log(`  - Accuracy before: %${((accuracyBefore ?? 0) * 100).toFixed(2)}`);
    console.log(`  - Accuracy after: %${((accuracyAfter ?? 0) * 100).toFixed(2)}`);
    console.log(`  - Δ Accuracy: %${accuracyDelta.toFixed(2)}`);
    console.log(`  - Model version: v${modelAfter.version}\n`);
    process.exit(0);

  } catch (error) {
    console.error('[Batch] Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyBatch5Categories();
