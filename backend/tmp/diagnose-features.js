const natural = require('natural');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });

async function main() {
    const row = await prisma.$queryRaw`SELECT model_data FROM model_state WHERE id = 1`;
    const md = row[0].model_data;

    // Inner 'classifier' sub-object
    console.log('Inner classifier keys:', md.classifier ? Object.keys(md.classifier) : 'none');
    if (md.classifier) {
        console.log('Inner classifier sub-keys:', JSON.stringify(md.classifier).slice(0, 400));
    }

    // features structure
    if (md.features) {
        const cats = Object.keys(md.features);
        console.log('\nfeatures categories:', cats);
        // Sample first category's word count
        const firstCat = cats[0];
        const words = Object.entries(md.features[firstCat] || {}).slice(0, 5);
        console.log(`features[${firstCat}] sample:`, words);
    }

    // Try: restore and immediately re-train (calling train() again from docs)
    const restored = natural.BayesClassifier.restore(md);
    const test1 = 'fenerbahce mac sampiyonluk gol fenerbahce_mac mac_sampiyonluk';
    const test2 = 'borsa enflasyon faiz merkez bankasi borsa_enflasyon enflasyon_faiz';
    
    console.log('\n--- Before re-train ---');
    console.log('Spor test:', restored.classify(test1));
    console.log('Ekonomi test:', restored.classify(test2));

    // Re-train from stored docs (does NOT double-count if we reset features first)
    const features = {};
    const classCounts = {};
    let totalDocs = restored.docs.length;
    
    for (const doc of restored.docs) {
        const label = doc.label;
        if (!classCounts[label]) classCounts[label] = 0;
        classCounts[label]++;
        if (!features[label]) features[label] = {};
        for (const token of doc.text) {
            const word = restored.stemmer.stem(token);
            features[label][word] = (features[label][word] || 0) + 1;
        }
    }
    console.log('\nClass counts from docs:', classCounts);
    console.log('Total docs:', totalDocs);

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
