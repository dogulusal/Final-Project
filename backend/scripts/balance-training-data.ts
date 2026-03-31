/**
 * balance-training-data.ts
 *
 * Faz 2.2 → Faz 3 — Eğitim verisi dengeleme + N-gram/Model karşılaştırması
 *
 * Kullanım:
 *   npx ts-node scripts/balance-training-data.ts [--config=A|B|C] [--model=nb|lr]
 */

import { PrismaClient } from '@prisma/client';
import natural from 'natural';

const prisma = new PrismaClient();

const TARGET_PER_CATEGORY = 50;
const MIN_DB_REQUIRED = 300;

interface TrainingExample {
    text: string;
    category: string;
}

const args = process.argv.slice(2);
let selectedConfig: 'A' | 'B' | 'C' = 'B';
let selectedModel: 'nb' | 'lr' = 'nb';

for (const arg of args) {
    if (arg.startsWith('--config=')) {
        const val = arg.split('=')[1];
        if (['A', 'B', 'C'].includes(val)) selectedConfig = val as 'A' | 'B' | 'C';
    }
    if (arg.startsWith('--model=')) {
        const val = arg.split('=')[1].toLowerCase();
        if (['nb', 'lr'].includes(val)) selectedModel = val as 'nb' | 'lr';
    }
}

function preprocessText(text: string, mode: string): string[] {
    const normalized = text.toLowerCase().trim();
    const tokens = normalized.match(/\b\w+\b/g) || [];
    
    if (mode === 'A') return tokens;
    
    if (mode === 'B' || mode === 'C') {
        const bigrams: string[] = [];
        for (let i = 0; i < tokens.length - 1; i++) {
            bigrams.push(`${tokens[i]}_${tokens[i + 1]}`);
        }
        let result = [...tokens, ...bigrams];
        if (mode === 'C') result = result.filter(t => t.length >= 3);
        return result;
    }
    return tokens;
}

function calculateMetrics(predictions: Array<{ actual: string; predicted: string }>, categories: string[]) {
    const metrics: Record<string, any> = {};
    
    categories.forEach(cat => {
        const tp = predictions.filter(p => p.actual === cat && p.predicted === cat).length;
        const fp = predictions.filter(p => p.actual !== cat && p.predicted === cat).length;
        const fn = predictions.filter(p => p.actual === cat && p.predicted !== cat).length;
        
        const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
        const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
        const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
        
        metrics[cat] = { precision, recall, f1 };
    });
    
    const accuracy = predictions.filter(p => p.actual === p.predicted).length / predictions.length;
    return { accuracy, metrics };
}

function upsample(examples: TrainingExample[], targetCount: number): TrainingExample[] {
    if (examples.length === 0) return [];
    const result: TrainingExample[] = [...examples];
    while (result.length < targetCount) {
        result.push({ ...examples[result.length % examples.length] });
    }
    return result.slice(0, targetCount);
}

async function main() {
    console.log(`\n[Faz3] === N-gram + Model Karşılaştırması ===`);
    console.log(`[Faz3] Config: ${selectedConfig} | Model: ${selectedModel.toUpperCase()}\n`);
    
    const approvedNews = await prisma.haber.findMany({
        where: { durum: { in: ['hazir', 'yayinda'] } },
        select: {
            baslik: true,
            metaAciklama: true,
            icerik: true,
            kategori: { select: { ad: true } }
        },
        orderBy: { yayinlanmaTarihi: 'desc' },
    });

    const total = approvedNews.length;
    console.log(`[Faz3] Toplam haber: ${total}`);

    if (total < MIN_DB_REQUIRED) {
        console.warn(`[Faz3] ⚠️  Yetersiz veri (${total} < ${MIN_DB_REQUIRED})`);
        await prisma.$disconnect();
        process.exit(1);
    }

    const byCategory: Record<string, TrainingExample[]> = {};
    for (const news of approvedNews) {
        const cat = news.kategori.ad;
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push({
            text: `${news.baslik} ${(news as any).metaAciklama || ''} ${news.icerik || ''}`.trim(),
            category: cat,
        });
    }

    console.log('\n[Faz3] Kategori dağılımı:');
    const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length);
    const categories: string[] = [];
    
    sortedCategories.forEach(([cat, examples]) => {
        categories.push(cat);
        const pct = ((examples.length / total) * 100).toFixed(1);
        console.log(`  ${cat.padEnd(15)} ${String(examples.length).padStart(4)} örnek (${pct}%)`);
    });

    console.log('\n[Faz3] Eğitim seti hazırlanıyor...');
    const balanced: TrainingExample[] = [];
    for (const [cat, examples] of sortedCategories) {
        if (examples.length < 3) continue;
        const sampled = upsample(examples, Math.max(examples.length, TARGET_PER_CATEGORY));
        balanced.push(...sampled);
    }

    const shuffled = balanced.sort(() => 0.5 - Math.random());
    const splitIdx = Math.floor(shuffled.length * 0.8);
    const trainSet = shuffled.slice(0, splitIdx);
    const testSet = shuffled.slice(splitIdx);

    console.log(`[Faz3] Train: ${trainSet.length} | Test: ${testSet.length}`);

    const Classifier = selectedModel === 'lr' 
        ? (natural as any).LogisticRegressionClassifier 
        : (natural as any).BayesClassifier;
    const classifier = new Classifier();

    console.log(`\n[Faz3] Eğitim başlıyor (${selectedConfig} config, ${selectedModel.toUpperCase()})...`);
    trainSet.forEach((item, idx) => {
        const tokens = preprocessText(item.text, selectedConfig);
        const processedText = tokens.join(' ');
        classifier.addDocument(processedText, item.category);
        if ((idx + 1) % 200 === 0) console.log(`[Faz3]   ${idx + 1}/${trainSet.length}`);
    });

    classifier.train();
    console.log(`[Faz3] Model eğitildi. Test ediliyor...\n`);

    const predictions: Array<{ actual: string; predicted: string }> = [];
    testSet.forEach((item, idx) => {
        const tokens = preprocessText(item.text, selectedConfig);
        const processedText = tokens.join(' ');
        try {
            const predicted = classifier.classify(processedText);
            predictions.push({ actual: item.category, predicted });
        } catch (e) {
            predictions.push({ actual: item.category, predicted: 'unknown' });
        }
        if ((idx + 1) % 100 === 0) console.log(`[Faz3]   Test: ${idx + 1}/${testSet.length}`);
    });

    const { accuracy, metrics } = calculateMetrics(predictions, categories);

    console.log(`\n[Faz3] === METRIKLERI ===`);
    console.log(`[Faz3] Accuracy: %${(accuracy * 100).toFixed(2)}`);
    console.log(`\n[Faz3] Per-Category F1:`);
    
    Object.entries(metrics)
        .sort((a: any, b: any) => b[1].f1 - a[1].f1)
        .forEach(([cat, m]: any) => {
            console.log(`  ${cat.padEnd(15)} F1: ${m.f1.toFixed(3)} | P: ${m.precision.toFixed(3)} | R: ${m.recall.toFixed(3)}`);
        });

    const correct = predictions.filter(p => p.actual === p.predicted).length;
    console.log(`\n[Faz3] Doğru tahmin: ${correct}/${predictions.length}`);
    console.log(`[Faz3] === SONUÇ ===`);
    console.log(`Config=${selectedConfig} Model=${selectedModel.toUpperCase()}: Accuracy=%${(accuracy * 100).toFixed(2)}\n`);

    await prisma.$disconnect();
}

main().catch(async (err) => {
    console.error('[Faz3] Hata:', err);
    await prisma.$disconnect();
    process.exit(1);
});
