import Parser from 'rss-parser';
import * as fs from 'fs';
import * as path from 'path';

const parser = new Parser({
    timeout: 10000,
    headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AI-News-Bot',
    }
});

// Genişletilmiş Test Listesi (Hedef > 40)
const POTENTIAL_SOURCES = [
    // --- Spor ---
    { id: 'trthaber-spor', name: 'TRT Haber Spor', url: 'https://www.trthaber.com/spor_articles.rss', category: 'Spor' },
    { id: 'ntv-spor', name: 'NTV Spor', url: 'https://www.ntvspor.net/son-dakika.rss', category: 'Spor' },
    { id: 'aa-spor', name: 'Anadolu Ajansı Spor', url: 'https://www.aa.com.tr/tr/rss/default?cat=spor', category: 'Spor' },
    { id: 'hurriyet-spor', name: 'Hürriyet Spor', url: 'https://www.hurriyet.com.tr/rss/spor', category: 'Spor' },
    { id: 'haberturk-spor', name: 'Habertürk Spor', url: 'https://www.haberturk.com/rss/spor.xml', category: 'Spor' },
    { id: 'fanatik', name: 'Fanatik', url: 'https://www.fanatik.com.tr/rss', category: 'Spor' },
    { id: 'fotomac', name: 'Fotomaç', url: 'https://www.fotomac.com.tr/rss/anasayfa.xml', category: 'Spor' },

    // --- Ekonomi ---
    { id: 'trthaber-ekonomi', name: 'TRT Haber Ekonomi', url: 'https://www.trthaber.com/ekonomi_articles.rss', category: 'Ekonomi' },
    { id: 'bloomberght', name: 'BloombergHT', url: 'https://www.bloomberght.com/rss', category: 'Ekonomi' },
    { id: 'aa-ekonomi', name: 'Anadolu Ajansı Ekonomi', url: 'https://www.aa.com.tr/tr/rss/default?cat=ekonomi', category: 'Ekonomi' },
    { id: 'hurriyet-ekonomi', name: 'Hürriyet Ekonomi', url: 'https://www.hurriyet.com.tr/rss/ekonomi', category: 'Ekonomi' },
    { id: 'haberturk-ekonomi', name: 'Habertürk Ekonomi', url: 'https://www.haberturk.com/rss/ekonomi.xml', category: 'Ekonomi' },
    { id: 'sozcu-ekonomi', name: 'Sözcü Ekonomi', url: 'https://www.sozcu.com.tr/rss-ekonomi.xml', category: 'Ekonomi' },

    // --- Teknoloji ---
    { id: 'trthaber-bilim', name: 'TRT Haber Bilim', url: 'https://www.trthaber.com/bilim_teknoloji_articles.rss', category: 'Teknoloji' },
    { id: 'webtekno', name: 'Webtekno', url: 'https://www.webtekno.com/rss.xml', category: 'Teknoloji' },
    { id: 'shiftdelete', name: 'ShiftDelete', url: 'https://shiftdelete.net/feed', category: 'Teknoloji' },
    { id: 'donanimhaber', name: 'DonanımHaber', url: 'https://www.donanimhaber.com/rss/tum/', category: 'Teknoloji' },
    { id: 'hurriyet-teknoloji', name: 'Hürriyet Teknoloji', url: 'https://www.hurriyet.com.tr/rss/teknoloji', category: 'Teknoloji' },

    // --- Siyaset / Gündem ---
    { id: 'trthaber-gundem', name: 'TRT Haber Gündem', url: 'https://www.trthaber.com/gundem_articles.rss', category: 'Siyaset' },
    { id: 'aa-gundem', name: 'Anadolu Ajansı Gündem', url: 'https://www.aa.com.tr/tr/rss/default?cat=gundem', category: 'Siyaset' },
    { id: 'hurriyet-siyaset', name: 'Hürriyet Siyaset', url: 'https://www.hurriyet.com.tr/rss/siyaset', category: 'Siyaset' },
    { id: 'cumhuriyet-siyaset', name: 'Cumhuriyet Siyaset', url: 'https://www.cumhuriyet.com.tr/rss/3', category: 'Siyaset' }, // 3 is usually politics
    { id: 'haberturk-gundem', name: 'Habertürk Gündem', url: 'https://www.haberturk.com/rss/manset.xml', category: 'Genel' },

    // --- Dünya ---
    { id: 'trthaber-dunya', name: 'TRT Haber Dünya', url: 'https://www.trthaber.com/dunya_articles.rss', category: 'Dünya' },
    { id: 'bbc-turkce', name: 'BBC Türkçe', url: 'https://feeds.bbci.co.uk/turkce/rss.xml', category: 'Dünya' },
    { id: 'aa-dunya', name: 'Anadolu Ajansı Dünya', url: 'https://www.aa.com.tr/tr/rss/default?cat=dunya', category: 'Dünya' },
    { id: 'dw-turkce', name: 'DW Türkçe', url: 'https://rss.dw.com/xml/rss-tur-all', category: 'Dünya' },
    { id: 'voa-turkce', name: 'VOA Dünya', url: 'https://www.voaturkce.com/api/z$_yqy-oqq', category: 'Dünya' },
    { id: 'hurriyet-dunya', name: 'Hürriyet Dünya', url: 'https://www.hurriyet.com.tr/rss/dunya', category: 'Dünya' },
    { id: 'sozcu-dunya', name: 'Sözcü Dünya', url: 'https://www.sozcu.com.tr/rss-dunya.xml', category: 'Dünya' },

    // --- Sağlık ---
    { id: 'trthaber-saglik', name: 'TRT Haber Sağlık', url: 'https://www.trthaber.com/saglik_articles.rss', category: 'Sağlık' },
    { id: 'aa-saglik', name: 'Anadolu Ajansı Sağlık', url: 'https://www.aa.com.tr/tr/rss/default?cat=saglik', category: 'Sağlık' },
    { id: 'haberturk-saglik', name: 'Habertürk Sağlık', url: 'https://www.haberturk.com/rss/saglik.xml', category: 'Sağlık' },

    // --- Genel / Karışık ---
    { id: 'hurriyet-anasayfa', name: 'Hürriyet Anasayfa', url: 'https://www.hurriyet.com.tr/rss/anahaber', category: 'Genel' },
    { id: 'cnnturk-anasayfa', name: 'CNN Türk', url: 'https://www.cnnturk.com/feed/rss/all/news', category: 'Genel' },
    { id: 'milliyet-anasayfa', name: 'Milliyet Sondakika', url: 'https://www.milliyet.com.tr/rss/rssnew/sondakikarss.xml', category: 'Genel' },
    { id: 'cumhuriyet-anasayfa', name: 'Cumhuriyet', url: 'https://www.cumhuriyet.com.tr/rss', category: 'Genel' },
    { id: 't24', name: 'T24', url: 'https://t24.com.tr/rss', category: 'Genel' },
    { id: 'yenisafak', name: 'Yeni Şafak', url: 'https://www.yenisafak.com/rss', category: 'Genel' },
    { id: 'bundle', name: 'Bundle Turkey', url: 'https://bundle.network/feed/', category: 'Genel' },
];

async function asyncPool(poolLimit: number, array: any[], iteratorFn: any) {
    const ret = [];
    const executing: any[] = [];
    for (const item of array) {
        const p = Promise.resolve().then(() => iteratorFn(item));
        ret.push(p);
        if (poolLimit <= array.length) {
            const e: any = p.then(() => executing.splice(executing.indexOf(e), 1));
            executing.push(e);
            if (executing.length >= poolLimit) {
                await Promise.race(executing);
            }
        }
    }
    return Promise.all(ret);
}

async function validateSources() {
    console.log(`📡 Önerilen toplam ${POTENTIAL_SOURCES.length} kaynak test ediliyor...`);
    
    const results = {
        healthy: [] as any[],
        broken: [] as any[],
        stale: [] as any[],
    };

    const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    await asyncPool(5, POTENTIAL_SOURCES, async (source: any) => {
        try {
            const feed = await parser.parseURL(source.url);
            
            if (!feed.items || feed.items.length === 0) {
                results.broken.push({ ...source, reason: "Boş feed (0 item)" });
                process.stdout.write('❌ ');
                return;
            }

            // En son haberi kontrol et
            const latestItem = feed.items[0];
            const pubDate = new Date(latestItem.pubDate || latestItem.isoDate || new Date());
            
            if (isNaN(pubDate.getTime()) || (now - pubDate.getTime() > EIGHT_DAYS_MS)) {
                results.stale.push({ ...source, reason: `Çok eski (Son haber: ${pubDate.toISOString().substring(0,10)})` });
                process.stdout.write('🟠 ');
                return;
            }

            results.healthy.push({
                ...source,
                itemCount: feed.items.length,
                latestDate: pubDate.toISOString()
            });
            process.stdout.write('✅ ');

        } catch (error: any) {
            results.broken.push({ ...source, reason: error.message || 'Bağlantı/Parse hatası' });
            process.stdout.write('❌ ');
        }
    });

    console.log('\n\n=== DOĞRULAMA (VALIDATION) SONUÇLARI ===');
    console.log(`✅ Sağlıklı: ${results.healthy.length}`);
    console.log(`🟠 Eski/Güncellenmeyen: ${results.stale.length}`);
    console.log(`❌ Hatalı (Bağlantı Yok/Bozuk): ${results.broken.length}`);

    // Sonuçları bir JSON'a yaz
    const outPath = path.resolve(__dirname, 'rss-validation-results.json');
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

    console.log(`\nRapor oluşturuldu: ${outPath}`);
    
    // Sadece sağlıklı olanları import/export objesi gibi formatla
    console.log('\n🌟 constants.ts için önerilen yeni Liste (Healthy Only):');
    
    const healthyCodeString = `export const RSS_SOURCES: IRssSource[] = [\n` + 
        results.healthy.map(s => `    { id: '${s.id}', name: '${s.name}', url: '${s.url}', category: '${s.category}' },`).join('\n') + 
        `\n];`;
    
    console.log(healthyCodeString);
    console.log('\nBu sağlıklı listeyi backend/src/config/constants.ts içine kopyalayabilirsiniz.');
}

validateSources().catch(console.error);
