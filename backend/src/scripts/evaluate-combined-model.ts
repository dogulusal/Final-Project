/**
 * Task 2.5: Dry-Run Evaluator Script
 * Loads persisted model from DB, runs NB / LR / Combined predictions on verified articles,
 * reports per-model accuracy, writes CSV to backend/evaluation-report-YYYY-MM-DD.csv
 */

import * as fs from 'fs';
import * as path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';
import { MlCategorizationService } from '../modules/ml/ml.service';

const prisma = new PrismaClient();

interface EvalRow {
    articleId: number;
    title: string;
    trueCategory: string;
    nbPred: string;
    lrPred: string;
    combinedPred: string;
    nbCorrect: boolean;
    lrCorrect: boolean;
    combinedCorrect: boolean;
}

export async function runEvaluatorDry(): Promise<{
    nbAccuracy: number;
    lrAccuracy: number;
    combinedAccuracy: number;
    total: number;
    useStacking: boolean;
    perClassAccuracy: Record<string, { nb: string; lr: string; combined: string; winner: string; total: number }>;
    reportPath: string;
}> {
    console.log('[Eval] Loading model from DB...');
    const mlService = new MlCategorizationService();
    const loaded = await mlService.loadModelFromDb();
    if (!loaded) {
        throw new Error('Persisted model could not be loaded from DB. Refusing to retrain in dry-run evaluator.');
    }

    if (!mlService.useCombinedModel) {
        throw new Error(
            'BLOCKER: useCombinedModel=false — LR state DB\'de yok. ' +
            'Faz2 doğrulaması yapılamaz. Önce train pipeline\'ı fix et.'
        );
    }

    const combined = mlService.useCombinedModel;
    console.log(`[Eval] useCombinedModel=${combined} useStacking=${mlService.useStacking}`);

    console.log('[Eval] Fetching verified articles...');
    const articles = await prisma.haber.findMany({
        where: { kategoriDogrulandi: true },
        include: { kategori: true },
        orderBy: { id: 'asc' },
    });
    console.log(`[Eval] Total verified articles: ${articles.length}`);

    const rows: EvalRow[] = [];
    let nbCorrectCount = 0;
    let lrCorrectCount = 0;
    let combinedCorrectCount = 0;

    for (const article of articles) {
        const text = `${article.baslik} ${(article.icerik ?? '').slice(0, 300)}`;
        const trueCategory = article.kategori.ad;

        const nbPred = mlService.predictNbCategory(text);
        const lrPred = await mlService.predictLrCategory(text);
        const combinedResult = await mlService.predictCombinedCategory(text);
        const combinedPred = combinedResult.kategori;

        const nbCorrect = nbPred === trueCategory;
        const lrCorrect = lrPred === trueCategory;
        const combinedCorrect = combinedPred === trueCategory;

        if (nbCorrect) nbCorrectCount++;
        if (lrCorrect) lrCorrectCount++;
        if (combinedCorrect) combinedCorrectCount++;

        rows.push({
            articleId: article.id,
            title: article.baslik.replace(/"/g, '""'),
            trueCategory,
            nbPred,
            lrPred,
            combinedPred,
            nbCorrect,
            lrCorrect,
            combinedCorrect,
        });
    }

    const total = articles.length;
    const nbAccuracy = total > 0 ? nbCorrectCount / total : 0;
    const lrAccuracy = total > 0 ? lrCorrectCount / total : 0;
    const combinedAccuracy = total > 0 ? combinedCorrectCount / total : 0;

    // Per-category breakdown: nb/lr/combined accuracy per class
    const perClassStats: Record<string, { total: number; nbCorrect: number; lrCorrect: number; combinedCorrect: number }> = {};
    for (const row of rows) {
        if (!perClassStats[row.trueCategory]) {
            perClassStats[row.trueCategory] = { total: 0, nbCorrect: 0, lrCorrect: 0, combinedCorrect: 0 };
        }
        perClassStats[row.trueCategory].total++;
        if (row.nbCorrect) perClassStats[row.trueCategory].nbCorrect++;
        if (row.lrCorrect) perClassStats[row.trueCategory].lrCorrect++;
        if (row.combinedCorrect) perClassStats[row.trueCategory].combinedCorrect++;
    }
    const perClassAccuracy: Record<string, { nb: string; lr: string; combined: string; winner: string; total: number }> = {};
    for (const [cat, stats] of Object.entries(perClassStats)) {
        const nb = stats.nbCorrect / stats.total;
        const lr = stats.lrCorrect / stats.total;
        const comb = stats.combinedCorrect / stats.total;
        const winner = comb >= nb && comb >= lr ? 'combined' : (nb >= lr ? 'nb' : 'lr');
        perClassAccuracy[cat] = {
            nb: `${(nb * 100).toFixed(1)}%`,
            lr: `${(lr * 100).toFixed(1)}%`,
            combined: `${(comb * 100).toFixed(1)}%`,
            winner,
            total: stats.total,
        };
    }

    // Write CSV
    const dateTag = process.env.ML_REPORT_DATE_TAG || '2026-04-16';
    const reportPath = path.resolve(
        __dirname,
        '../..',
        `evaluation-report-${dateTag}.csv`
    );
    const header = 'articleId,title,trueCategory,nbPred,lrPred,combinedPred,nbCorrect,lrCorrect,combinedCorrect\n';
    const csvBody = rows
        .map(
            (r) =>
                `${r.articleId},"${r.title}","${r.trueCategory}","${r.nbPred}","${r.lrPred}","${r.combinedPred}",${r.nbCorrect},${r.lrCorrect},${r.combinedCorrect}`
        )
        .join('\n');
    fs.writeFileSync(reportPath, header + csvBody, 'utf8');

    return { nbAccuracy, lrAccuracy, combinedAccuracy, total, useStacking: mlService.useStacking, perClassAccuracy, reportPath };
}

async function persistEvaluationResult(result: {
    nbAccuracy: number;
    lrAccuracy: number;
    combinedAccuracy: number;
    total: number;
    useStacking: boolean;
}): Promise<void> {
    const modelStateRepo = (prisma as any).modelState;
    if (!modelStateRepo) {
        console.warn('[Eval] modelState repository erişimi yok, evaluation metrikleri persist edilemedi.');
        return;
    }

    const state = await modelStateRepo.findUnique({ where: { id: 1 } });
    if (!state) {
        console.warn('[Eval] model_state kaydı bulunamadı, evaluation metrikleri persist edilemedi.');
        return;
    }

    const currentModelData = state.modelData;
    if (!currentModelData || typeof currentModelData !== 'object' || Array.isArray(currentModelData)) {
        console.warn('[Eval] model_data beklenmeyen formatta, evaluation metrikleri persist edilemedi.');
        return;
    }

    const asRecord = currentModelData as Record<string, unknown>;
    const existingMetrics =
        asRecord._metrics && typeof asRecord._metrics === 'object' && !Array.isArray(asRecord._metrics)
            ? (asRecord._metrics as Record<string, unknown>)
            : {};

    const nextModelData: Record<string, unknown> = {
        ...asRecord,
        _metrics: {
            ...existingMetrics,
            lastVerifiedEval: {
                nbAccuracy: result.nbAccuracy,
                lrAccuracy: result.lrAccuracy,
                combinedAccuracy: result.combinedAccuracy,
                total: result.total,
                useStacking: result.useStacking,
                evaluatedAt: new Date().toISOString(),
            }
        }
    };

    await modelStateRepo.update({
        where: { id: 1 },
        data: {
            modelData: nextModelData as Prisma.InputJsonValue
        }
    });

    console.log(`[Eval] model_state içine verified evaluation yazıldı. Combined=%${(result.combinedAccuracy * 100).toFixed(2)} n=${result.total}`);
}

async function main() {
    try {
        const result = await runEvaluatorDry();
        await persistEvaluationResult(result);
        console.log('\n=== EVALUATION RESULTS ===');
        console.log(JSON.stringify({
            total: result.total,
            nbAccuracy: `${(result.nbAccuracy * 100).toFixed(2)}%`,
            lrAccuracy: `${(result.lrAccuracy * 100).toFixed(2)}%`,
            combinedAccuracy: `${(result.combinedAccuracy * 100).toFixed(2)}%`,
            useStacking: result.useStacking,
            reportPath: result.reportPath,
        }, null, 2));
        console.log('\n=== PER-CLASS BREAKDOWN ===');
        const sorted = Object.entries(result.perClassAccuracy).sort(([a], [b]) => a.localeCompare(b));
        for (const [cat, stats] of sorted) {
            const marker = stats.winner === 'combined' ? '✓comb' : stats.winner === 'nb' ? '  NB ' : '  LR ';
            console.log(`  ${marker} ${cat.padEnd(12)} NB=${stats.nb.padStart(6)} LR=${stats.lr.padStart(6)} Combined=${stats.combined.padStart(6)} (n=${stats.total})`);
        }
    } finally {
        await prisma.$disconnect();
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
