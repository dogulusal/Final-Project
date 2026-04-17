/**
 * Task 2.5: Dry-Run Evaluator Script
 * Loads persisted model from DB, runs NB / LR / Combined predictions on verified articles,
 * reports per-model accuracy, writes CSV to backend/evaluation-report-YYYY-MM-DD.csv
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
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
    reportPath: string;
}> {
    console.log('[Eval] Loading model from DB...');
    const mlService = new MlCategorizationService();
    const loaded = await mlService.loadModelFromDb();
    if (!loaded) {
        throw new Error('Persisted model could not be loaded from DB. Refusing to retrain in dry-run evaluator.');
    }

    const combined = mlService.useCombinedModel;
    console.log(`[Eval] useCombinedModel=${combined}`);

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
        const combinedPred = await mlService.predictCombinedCategory(text);

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

    return { nbAccuracy, lrAccuracy, combinedAccuracy, total, reportPath };
}

async function main() {
    try {
        const result = await runEvaluatorDry();
        console.log('\n=== EVALUATION RESULTS ===');
        console.log(JSON.stringify({
            total: result.total,
            nbAccuracy: `${(result.nbAccuracy * 100).toFixed(2)}%`,
            lrAccuracy: `${(result.lrAccuracy * 100).toFixed(2)}%`,
            combinedAccuracy: `${(result.combinedAccuracy * 100).toFixed(2)}%`,
            reportPath: result.reportPath,
        }, null, 2));
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
