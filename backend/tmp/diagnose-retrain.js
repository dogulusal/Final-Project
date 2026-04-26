const natural = require('natural');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });

async function main() {
    const row = await prisma.$queryRaw`SELECT model_data FROM model_state WHERE id = 1`;
    const md = row[0].model_data;

    console.log('Total stored docs:', md.docs.length);

    // Test 1: standard restore
    const restored = natural.BayesClassifier.restore(md);

    // Test 2: fresh retrain from stored docs (avoids any restore issue)
    const fresh = new natural.BayesClassifier();
    for (const doc of md.docs) {
        // doc.text is array of already-preprocessed tokens; addDocument will stem again
        // PorterStemmer is idempotent: stem(stem(x)) == stem(x)
        fresh.addDocument(doc.text.join(' '), doc.label);
    }
    fresh.train();

    // Compare on some real-looking Turkish tokens (with proper unicode)
    const tests = [
        { text: 'borsa düştü enflasyon artış merkez bankası faiz kararı borsa_düştü', expected: 'Ekonomi' },
        { text: 'fenerbahçe galatasaray maç gol şampiyonluk fenerbahçe_galatasaray', expected: 'Spor' },
        { text: 'meclis milletvekili cumhurbaşkanı hükümet karar meclis_milletvekili', expected: 'Siyaset' },
        { text: 'rusya ukrayna nato savaş çatışma sınır rusya_ukrayna', expected: 'Dünya' },
        { text: 'yapay zeka iphone android uygulama yazılım yapay_zeka', expected: 'Teknoloji' },
        { text: 'hastane ameliyat tedavi doktor sağlık bakanlığı hastane_ameliyat', expected: 'Sağlık' },
    ];

    console.log('\n=== Prediction comparison: restore vs fresh retrain ===');
    let restoreCorrect = 0, freshCorrect = 0;
    for (const t of tests) {
        const p1 = restored.classify(t.text);
        const p2 = fresh.classify(t.text);
        const r1mark = p1 === t.expected ? '✓' : '✗';
        const r2mark = p2 === t.expected ? '✓' : '✗';
        if (p1 === t.expected) restoreCorrect++;
        if (p2 === t.expected) freshCorrect++;
        console.log(`expected=${t.expected}  restore=${p1}${r1mark}  fresh=${p2}${r2mark}`);
    }
    console.log(`\nScore: restore=${restoreCorrect}/${tests.length}  fresh=${freshCorrect}/${tests.length}`);

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
