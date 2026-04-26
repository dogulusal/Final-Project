/**
 * Diagnose: Does natural.BayesClassifier.restore() produce valid predictions?
 * Checks NB predict distribution after DB load.
 */
const { PrismaClient } = require('@prisma/client');
const natural = require('natural');

const prisma = new PrismaClient({ log: ['error'] });

async function main() {
    const state = await prisma.$queryRaw`
        SELECT version, accuracy, sample_count,
               jsonb_object_keys(model_data::jsonb) as top_key
        FROM model_state WHERE id = 1
        LIMIT 20
    `;
    console.log('\n[DB] Top-level keys in model_data:', state.map(r => r.top_key));

    const row = await prisma.$queryRaw`
        SELECT model_data FROM model_state WHERE id = 1
    `;
    const modelData = row[0].model_data;

    // Check serialized structure
    const keys = Object.keys(modelData);
    console.log('\n[NB Serialized] Keys:', keys);
    if (modelData.docs) {
        console.log('[NB Serialized] docs.length:', modelData.docs.length);
        console.log('[NB Serialized] first doc sample:', JSON.stringify(modelData.docs[0]).slice(0, 120));
    }

    // Try restore
    const restore = natural.BayesClassifier.restore;
    const classifier = restore(modelData);
    console.log('\n[NB Restored] type:', typeof classifier, classifier.constructor?.name);

    // Test predictions on known sentences
    const tests = [
        { text: 'borsa düştü enflasyon merkez bankası faiz artışı', expected: 'Ekonomi' },
        { text: 'fenerbahçe galatasaray maç gol şampiyonluk', expected: 'Spor' },
        { text: 'meclis milletvekili cumhurbaşkanı hükümet karar', expected: 'Siyaset' },
        { text: 'yapay zeka iphone android uygulama yazılım', expected: 'Teknoloji' },
        { text: 'rusya ukrayna nato savaş çatışma uluslararası', expected: 'Dünya' },
        { text: 'sağlık bakanlığı hastane ameliyat tedavi', expected: 'Sağlık' },
    ];

    console.log('\n[NB Predictions]:');
    for (const t of tests) {
        try {
            // Test with bigrams (as trained)
            const tokens = t.text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
            const bigrams = [];
            for (let i = 0; i < tokens.length - 1; i++) {
                bigrams.push(`${tokens[i]}_${tokens[i+1]}`);
            }
            const processed = [...tokens, ...bigrams].join(' ');
            const pred = classifier.classify(processed);
            const classifications = classifier.getClassifications(processed) || [];
            const top3 = classifications.slice(0, 3).map(c => `${c.label}:${c.value.toFixed(4)}`).join(', ');
            console.log(`  expected=${t.expected}, got=${pred}  scores=[${top3}]`);
        } catch(e) {
            console.error(`  ERROR:`, e.message);
        }
    }

    // Test with unigram-only (wrong mode)
    console.log('\n[NB unigram-only Predictions] (sanity check):');
    for (const t of tests.slice(0, 3)) {
        const processed = t.text.toLowerCase();
        const pred = classifier.classify(processed);
        console.log(`  expected=${t.expected}, got=${pred}`);
    }

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
