const natural = require('natural');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });

async function main() {
    const row = await prisma.$queryRaw`SELECT model_data FROM model_state WHERE id = 1`;
    const md = row[0].model_data;

    // Check stemmer after restore WITHOUT passing stemmer
    const restored = natural.BayesClassifier.restore(md);
    console.log('--- No explicit stemmer ---');
    console.log('stemmer type:', typeof restored.stemmer);
    console.log('stemmer.stem fn?:', typeof restored.stemmer?.stem);
    console.log('stemmer keys:', restored.stemmer ? Object.keys(restored.stemmer).slice(0, 5) : 'null');

    // Check stemmer after restore WITH explicit stemmer
    const restored2 = natural.BayesClassifier.restore(md, natural.PorterStemmer);
    console.log('\n--- Explicit PorterStemmer ---');
    console.log('stemmer.stem fn?:', typeof restored2.stemmer?.stem);

    // Compare predictions
    const tests = [
        'borsa enflasyon faiz merkez bankasi',
        'fenerbahce mac sampiyonluk gol',
        'meclis milletvekili hukumet karar',
        'rusya ukrayna nato savas',
        'yapay zeka iphone uygulama',
    ];

    console.log('\n--- Predictions comparison ---');
    for (const t of tests) {
        const p1 = restored.classify(t);
        const p2 = restored2.classify(t);
        const c1 = (restored.getClassifications(t) || []).slice(0,3).map(c => `${c.label}:${c.value.toExponential(2)}`).join(', ');
        console.log(`"${t.slice(0,30)}" | no-stem=${p1} | w-stem=${p2}`);
        console.log(`  scores (no-stem): ${c1}`);
    }

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
