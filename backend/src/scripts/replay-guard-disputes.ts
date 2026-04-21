/**
 * Replay guard disputes through categorize() with trained model.
 * Measures guard-LLM alignment rate.
 * 
 * Usage: npx ts-node src/scripts/replay-guard-disputes.ts
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { MlCategorizationService } from '../modules/ml/ml.service';
import { prisma } from '../config/database';

interface DisputeFixture {
    id: number;
    title: string;
    summary: string;
    nbCategory: string;
    llmCategory: string;
    mlConfidence: number;
    llmConfidence: number;
}

interface ReplayResult {
    id: number;
    title: string;
    originalNb: string;
    llmCategory: string;
    postGuardCategory: string;
    confidenceBand: string;
    guardOverride: string | null;
    guardTriggered: boolean;
    alignedWithLlm: boolean;
    kural3Triggered: boolean;
    kural3AgainstLlm: boolean;
}

async function main() {
    const fixturePath = path.resolve(__dirname, '../__tests__/fixtures/guard-dispute-42.json');
    const fixtures: DisputeFixture[] = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

    console.log(`Loading trained model from DB...`);
    const mlService = new MlCategorizationService();

    // Load training data from DB and train
    const trainingRows = await prisma.$queryRaw<any[]>`
        SELECT h.baslik || ' ' || COALESCE(h.icerik, '') AS text, k.ad AS category
        FROM haberler h
        JOIN kategoriler k ON k.id = h.kategori_id
        WHERE h.kategori_dogrulandi = true
    `;
    console.log(`Training with ${trainingRows.length} verified records...`);
    await mlService.train(trainingRows.map((r: any) => ({ text: r.text, category: r.category })));

    const results: ReplayResult[] = [];
    let guardTriggered = 0;
    let alignedWithLlm = 0;
    let kural3Triggered = 0;
    let kural3AgainstLlm = 0;

    for (const r of fixtures) {
        const text = r.title + (r.summary ? ' ' + r.summary : '');
        const out = await mlService.categorize(text);

        const override = out.guardOverride ?? null;
        const triggered = override !== null;
        const aligned = triggered && out.kategori === r.llmCategory;

        // Kural 3 detection: override was Siyaset/Dünya and now it's Genel
        const k3 = triggered && (override === 'Siyaset' || override === 'Dünya') && out.kategori === 'Genel';
        const k3Against = k3 && (r.llmCategory === 'Siyaset' || r.llmCategory === 'Dünya');

        if (triggered) guardTriggered++;
        if (aligned) alignedWithLlm++;
        if (k3) kural3Triggered++;
        if (k3Against) kural3AgainstLlm++;

        results.push({
            id: r.id,
            title: r.title.substring(0, 80),
            originalNb: r.nbCategory,
            llmCategory: r.llmCategory,
            postGuardCategory: out.kategori,
            confidenceBand: out.confidenceBand || 'N/A',
            guardOverride: override,
            guardTriggered: triggered,
            alignedWithLlm: aligned,
            kural3Triggered: k3,
            kural3AgainstLlm: k3Against,
        });
    }

    const alignmentRate = guardTriggered > 0 ? alignedWithLlm / guardTriggered : 0;
    const kural3FPRate = kural3Triggered > 0 ? kural3AgainstLlm / kural3Triggered : 0;

    const report = {
        total: fixtures.length,
        guardTriggered,
        alignedWithLlm,
        alignmentRate: Math.round(alignmentRate * 1000) / 1000,
        kural3Triggered,
        kural3AgainstLlm,
        kural3FalsePositiveRate: Math.round(kural3FPRate * 1000) / 1000,
        details: results,
    };

    console.log(`\n=== GUARD REPLAY REPORT ===`);
    console.log(`Total disputes: ${report.total}`);
    console.log(`Guard triggered: ${report.guardTriggered}`);
    console.log(`Aligned with LLM: ${report.alignedWithLlm}`);
    console.log(`Alignment rate: ${(report.alignmentRate * 100).toFixed(1)}%`);
    console.log(`Kural3 triggered: ${report.kural3Triggered}`);
    console.log(`Kural3 false positive rate: ${(report.kural3FalsePositiveRate * 100).toFixed(1)}%`);

    // Print per-record details for triggered guards
    console.log(`\n--- Guard-triggered records ---`);
    for (const r of results.filter(r => r.guardTriggered)) {
        const status = r.alignedWithLlm ? '✓ ALIGNED' : '✗ MISALIGNED';
        console.log(`[${r.id}] ${r.guardOverride}→${r.postGuardCategory} (LLM=${r.llmCategory}) ${status} | "${r.title}"`);
    }

    const outPath = path.resolve(__dirname, '../../tmp/guard-replay-report.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\nReport written to ${outPath}`);

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
