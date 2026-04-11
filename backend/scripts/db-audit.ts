import { PrismaClient } from '@prisma/client';

/**
 * DB Audit Sorgusu:
 * 623 verified haber'in kategori dağılımı, llm_provider, augmented_at analizi
 * Restore tahrifatı tespit etmek için
 */

const prisma = new PrismaClient();

async function auditDB() {
  try {
    console.log('\n📊 [DB Audit] Başlıyorum...\n');

    // All verified haberler
    const haberler = await prisma.haber.findMany({
      where: {
        durum: { in: ['hazir', 'yayinda'] },
        kategoriDogrulandi: true
      },
      include: {
        kategori: true
      }
    });

    console.log(`📌 Total verified haberler: ${haberler.length}\n`);

    // Group by category
    const byCategory: Record<string, any[]> = {};
    haberler.forEach(h => {
      const cat = h.kategori.ad;
      if (!byCategory[cat]) {
        byCategory[cat] = [];
      }
      byCategory[cat].push(h);
    });

    console.log('📊 [Kategori Dağılımı]\n');
    console.log('Kategori          | Toplam | LLM Provider (Counts)           | Augmented (null/not-null) | Avg Confidence');
    console.log('─'.repeat(100));

    const categoryStats: Array<{cat: string; total: number; llmDist: Record<string, number>; augmentedNull: number; avgConf: number}> = [];

    for (const [cat, records] of Object.entries(byCategory)) {
      const llmDist: Record<string, number> = {};
      let augmentedNull = 0;
      let totalConfidence = 0;

      records.forEach(r => {
        const provider = r.llmProvider || 'none';
        llmDist[provider] = (llmDist[provider] || 0) + 1;
        if (!r.augmentedAt) augmentedNull++;
        totalConfidence += (r.mlConfidence || 0);
      });

      const avgConf = (totalConfidence / records.length).toFixed(3);
      const augmentedNonNull = records.length - augmentedNull;

      const llmStr = Object.entries(llmDist)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');

      console.log(
        `${cat.padEnd(17)} | ${records.length.toString().padEnd(5)} | ${llmStr.padEnd(30)} | ${augmentedNull}/${augmentedNonNull}`.padEnd(75) + `| ${avgConf}`
      );

      categoryStats.push({
        cat,
        total: records.length,
        llmDist,
        augmentedNull,
        avgConf: parseFloat(avgConf)
      });
    }

    console.log('\n');

    // Analysis
    console.log('🔍 [Restoration Risk Analysis]\n');
    
    categoryStats.forEach(stat => {
      const riskFactors = [];

      // High augmented count = potential bias
      const augmentedNonNull = stat.total - stat.augmentedNull;
      if (augmentedNonNull > stat.total * 0.5) {
        riskFactors.push(`High augmentation (${augmentedNonNull}/${stat.total} = ${(augmentedNonNull/stat.total*100).toFixed(0)}%)`);
      }

      // Low confidence = model uncertainty
      if (stat.avgConf < 0.6) {
        riskFactors.push(`Low avg confidence (${stat.avgConf})`);
      }

      // LLM provider distribution
      if (stat.llmDist['none'] && stat.llmDist['none'] > stat.total * 0.3) {
        riskFactors.push(`High "none" provider (${stat.llmDist['none']}/${stat.total})`);
      }

      const riskLevel = riskFactors.length >= 2 ? '⚠️  HIGH' : (riskFactors.length === 1 ? '⚡ MEDIUM' : '✓ LOW');
      
      console.log(`${stat.cat.padEnd(17)} | Risk: ${riskLevel.padEnd(12)} | Factors: ${riskFactors.join(' + ') || 'None'}`);
    });

    console.log('\n');

    // Recommendation
    console.log('💡 [Recommendation]\n');
    const lowRiskCats = categoryStats.filter(s => s.avgConf >= 0.6 && (s.total - s.augmentedNull) <= s.total * 0.5);
    const highRiskCats = categoryStats.filter(s => s.avgConf < 0.6 || (s.total - s.augmentedNull) > s.total * 0.5);

    console.log(`Low Risk Categories (suitable for batch verify):`);
    lowRiskCats.forEach(c => console.log(`  • ${c.cat} (${c.total} records, confidence=${c.avgConf})`));

    console.log(`\nHigh Risk Categories (skip or audit first):`);
    highRiskCats.forEach(c => console.log(`  • ${c.cat} (${c.total} records, confidence=${c.avgConf})`));

    console.log('\n');

    process.exit(0);

  } catch (error) {
    console.error('[DB Audit] Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

auditDB();
