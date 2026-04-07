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

function calculateMacroF1(metrics: Record<string, { f1: number }>): number {
    const values = Object.values(metrics).map(m => m.f1);
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function upsample(examples: TrainingExample[], targetCount: number): TrainingExample[] {
    if (examples.length === 0) return [];
    const result: TrainingExample[] = [...examples];
    while (result.length < targetCount) {
        result.push({ ...examples[result.length % examples.length] });
    }
    return result.slice(0, targetCount);
}

function seededShuffle<T>(array: T[], seed: number): T[] {
    const arr = [...array];
    let s = seed;
    for (let i = arr.length - 1; i > 0; i--) {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        const j = Math.abs(s) % (i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

async function main() {
    console.log(`\n[Faz3] === N-gram + Model Karşılaştırması ===`);
    console.log(`[Faz3] Config: ${selectedConfig} | Model: ${selectedModel.toUpperCase()}\n`);
    
    const approvedNews = await prisma.haber.findMany({
        where: {
            durum: { in: ['hazir', 'yayinda'] },
            kategoriDogrulandi: true,
        },
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

    const SPLIT_SEED = 42;
    const shuffled = seededShuffle(balanced, SPLIT_SEED);
    const splitIdx = Math.floor(shuffled.length * 0.8);
    const trainSet = shuffled.slice(0, splitIdx);
    const testSet = shuffled.slice(splitIdx);

    console.log(`[Faz3] Split sabitlendi - seed: ${SPLIT_SEED}`);
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
    const macroF1 = calculateMacroF1(metrics);

    // -- Confusion Matrix --------------------------------------------------
    const confusionMatrix: Record<string, Record<string, number>> = {};
    categories.forEach(cat => {
        confusionMatrix[cat] = {};
        categories.forEach(other => {
            confusionMatrix[cat][other] = 0;
        });
    });

    predictions.forEach(({ actual, predicted }) => {
        if (confusionMatrix[actual] && confusionMatrix[actual][predicted] !== undefined) {
            confusionMatrix[actual][predicted]++;
        }
    });

    const targetCategories = ['Siyaset', 'Genel'];
    console.log('\n[Faz3] -- Confusion Matrix (Siyaset & Genel) --');
    targetCategories.forEach(target => {
        const row = confusionMatrix[target];
        if (!row) {
            return;
        }

        const total = Object.values(row).reduce((a, b) => a + b, 0);
        if (total === 0) {
            console.log(`\n  Gercek: ${target} (0 ornek)`);
            return;
        }

        console.log(`\n  Gercek: ${target} (toplam ${total} ornek)`);
        categories
            .filter(cat => cat !== target)
            .sort((a, b) => row[b] - row[a])
            .forEach(cat => {
                if (row[cat] > 0) {
                    const pct = ((row[cat] / total) * 100).toFixed(1);
                    console.log(`    -> ${cat.padEnd(12)} ${row[cat]} ornek  (${pct}%)`);
                }
            });

        const correctByTarget = row[target] || 0;
        console.log(`    + Dogru       ${correctByTarget} ornek  (${((correctByTarget / total) * 100).toFixed(1)}%)`);
    });

    console.log('\n[Faz3] -- Hard-Negative Pairs (oncelik sirasi) --');
    const hardNegatives: Record<string, number> = {};
    predictions.forEach(({ actual, predicted }) => {
        if (targetCategories.includes(actual) && actual !== predicted && categories.includes(predicted)) {
            const key = `${actual} -> ${predicted}`;
            hardNegatives[key] = (hardNegatives[key] || 0) + 1;
        }
    });
    Object.entries(hardNegatives)
        .sort(([, a], [, b]) => b - a)
        .forEach(([pair, count]) => {
            console.log(`  ${pair.padEnd(25)} ${count} ornek`);
        });

    // -- Genel->Siyaset: Otomatik Kova Ayirici ----------------------------
    const siyasetSinyalleri = [
        'meclis', 'bakan', 'parti', 'milletvekili', 'yasa', 'secim',
        'muhalefet', 'iktidar', 'cumhurbaskan', 'anayasa', 'hukumet',
        'protesto', 'gosteri', 'yargi', 'dava', 'mahkeme', 'tutuklama'
    ];

    // Leakage guard: hard-negative havuzu sadece train setinden üretilir.
    const trainPredictions: Array<{ actual: string; predicted: string }> = [];
    trainSet.forEach(item => {
        const tokens = preprocessText(item.text, selectedConfig);
        const processedText = tokens.join(' ');
        try {
            const predicted = classifier.classify(processedText);
            trainPredictions.push({ actual: item.category, predicted });
        } catch (e) {
            trainPredictions.push({ actual: item.category, predicted: 'unknown' });
        }
    });

    const muhtemelMislabeled: typeof trainSet = [];
    const gercekGenel: typeof trainSet = [];

    trainSet.forEach((item, idx) => {
        const predicted = trainPredictions[idx];
        if (!predicted) {
            return;
        }
        if (predicted.actual === 'Genel' && predicted.predicted === 'Siyaset') {
            const textLower = item.text.toLowerCase();
            const sinyalSayisi = siyasetSinyalleri.filter(k => textLower.includes(k)).length;
            if (sinyalSayisi >= 2) {
                muhtemelMislabeled.push(item);
            } else {
                gercekGenel.push(item);
            }
        }
    });

    console.log('\n[Faz3] -- Kova Analizi --');
    console.log(`  Muhtemel mislabeled (Siyaset olmali): ${muhtemelMislabeled.length}`);
    muhtemelMislabeled.forEach((item, i) => {
        console.log(`  [${i + 1}] ${item.text.substring(0, 100)}...`);
    });

    console.log(`\n  Gercek Genel (hard-negative adayi): ${gercekGenel.length}`);
    gercekGenel.forEach((item, i) => {
        console.log(`  [${i + 1}] ${item.text.substring(0, 100)}...`);
    });

    // -- Genel->Saglik: Kova Ayirici -------------------------------------
    const saglikSinyalleri = [
        'hastane', 'doktor', 'hasta', 'tedavi', 'ilac', 'saglik bakanligi',
        'sağlık bakanlığı', 'klinik', 'ameliyat', 'tani', 'teşhis', 'teshis', 'asi', 'aşı',
        'pandemi', 'salgin', 'salgın', 'hemsire', 'hemşire', 'acil', 'yogun bakim', 'yoğun bakım',
        'kanser', 'diyabet', 'obezite'
    ];

    const muhtemelMislabeledSaglik: typeof trainSet = [];
    const gercekGenelSaglik: typeof trainSet = [];

    trainSet.forEach((item, idx) => {
        const predicted = trainPredictions[idx];
        if (!predicted) {
            return;
        }
        if (predicted.actual === 'Genel' && predicted.predicted === 'Sağlık') {
            const textLower = item.text.toLowerCase();
            const sinyalSayisi = saglikSinyalleri.filter(k => textLower.includes(k)).length;
            if (sinyalSayisi >= 2) {
                muhtemelMislabeledSaglik.push(item);
            } else {
                gercekGenelSaglik.push(item);
            }
        }
    });

    console.log('\n[Faz3] -- Kova Analizi: Genel -> Saglik --');
    console.log(`  Muhtemel mislabeled (Saglik olmali): ${muhtemelMislabeledSaglik.length}`);
    muhtemelMislabeledSaglik.forEach((item, i) => {
        console.log(`  [${i + 1}] ${item.text.substring(0, 100)}...`);
    });

    console.log(`\n  Gercek Genel (hard-negative adayi): ${gercekGenelSaglik.length}`);
    gercekGenelSaglik.forEach((item, i) => {
        console.log(`  [${i + 1}] ${item.text.substring(0, 100)}...`);
    });

    // -- Hard-Negative Injection ------------------------------------------
    const hardNegativePool = [...gercekGenel, ...gercekGenelSaglik];

    console.log('\n[Faz3] -- Hard-Negative Injection --');
    console.log(`  Havuz: ${hardNegativePool.length} ornek Genel egitimine ekleniyor`);

    const existingTexts = new Set(trainSet.map(i => i.text));
    let injectedCount = 0;
    hardNegativePool.forEach(item => {
        if (!existingTexts.has(item.text)) {
            trainSet.push({ ...item, category: 'Genel' });
            existingTexts.add(item.text);
            injectedCount++;
        }
    });
    console.log(`  Eklenen (duplicate haric): ${injectedCount}`);

    // Mislabeled duzeltme (manuel - kova analizinde Siyaset olmasi gerekenler)
    let mislabeledFixed = 0;
    muhtemelMislabeled.forEach(item => {
        const idx = trainSet.findIndex(t => t.text === item.text);
        if (idx !== -1) {
            if (trainSet[idx].category !== 'Siyaset') {
                trainSet[idx].category = 'Siyaset';
                mislabeledFixed++;
            }
        } else {
            trainSet.push({ ...item, category: 'Siyaset' });
            existingTexts.add(item.text);
            mislabeledFixed++;
        }
    });
    console.log(`  Mislabeled duzeltme: ${mislabeledFixed} ornek Siyaset'e tasindi`);
    console.log(`  Yeni training set boyutu: ${trainSet.length}`);

    // Ikinci tur egitim: injection ve mislabeled duzeltme sonrasi
    const classifierRound2 = new Classifier();
    trainSet.forEach((item) => {
        const tokens = preprocessText(item.text, selectedConfig);
        const processedText = tokens.join(' ');
        classifierRound2.addDocument(processedText, item.category);
    });
    classifierRound2.train();

    const predictionsRound2: Array<{ actual: string; predicted: string }> = [];
    testSet.forEach((item) => {
        const tokens = preprocessText(item.text, selectedConfig);
        const processedText = tokens.join(' ');
        try {
            const predicted = classifierRound2.classify(processedText);
            predictionsRound2.push({ actual: item.category, predicted });
        } catch (e) {
            predictionsRound2.push({ actual: item.category, predicted: 'unknown' });
        }
    });

    const { accuracy: accuracyRound2, metrics: metricsRound2 } = calculateMetrics(predictionsRound2, categories);
    const genelToSiyasetRound2 = predictionsRound2.filter(p => p.actual === 'Genel' && p.predicted === 'Siyaset').length;
    const genelF1Round2 = metricsRound2['Genel']?.f1 ?? 0;

    console.log('\n[Faz3] -- Ikinci Tur Sonuclari (Injection Sonrasi) --');
    console.log(`  Eklenen hard-negative sayisi: ${injectedCount}`);
    console.log(`  Yeni Genel F1: ${genelF1Round2.toFixed(3)}`);
    console.log(`  Genel->Siyaset pair sayisi: ${genelToSiyasetRound2}`);
    console.log(`  Ikinci tur accuracy: %${(accuracyRound2 * 100).toFixed(2)}`);

    // -- Hard-Negative Ornek Ciktisi (Genel -> Siyaset, train-only) ------
    console.log('\n[Faz3] -- Hard-Negative Ornekler: Genel -> Siyaset (train-only) --');
    let hnCount = 0;
    trainSet.forEach((item, idx) => {
        const predicted = trainPredictions[idx];
        if (!predicted) {
            return;
        }
        if (predicted.actual === 'Genel' && predicted.predicted === 'Siyaset') {
            const source = (item as any).source || 'bilinmiyor';
            console.log(`\n  [${++hnCount}] ${item.text.substring(0, 120)}...`);
            console.log(`      Kaynak: ${source}`);
        }
    });
    console.log(`\nToplam Genel->Siyaset hard-negative: ${hnCount}`);

    console.log(`\n[Faz3] === METRIKLERI ===`);
    console.log(`[Faz3] Accuracy: %${(accuracy * 100).toFixed(2)}`);
    console.log(`[Faz3] Macro-F1: ${macroF1.toFixed(3)}`);
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
