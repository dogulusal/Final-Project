// Check pool sizes for hard negative injection
const http = require('http');
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

const siyasetSignals = [
  'meclis', 'bakan', 'milletvekili', 'parti', 'secim', 'iktidar', 'muhalefet',
  'cumhurbaskan', 'hukumet', 'anayasa', 'belediye', 'gozalti', 'tutuk', 'sorusturma',
  'yargi', 'mahkeme', 'protesto', 'oy', 'kanun', 'yasa',
  'hukumet karari', 'secim kampanyasi', 'parti kongresi', 'siyasi kriz', 'kabine',
  'cumhurbaskanligi', 'bakanlik', 'muhtarlik secimi', 'oy orani'
];

function countHits(text, keywords) {
  const norm = (text || '').toLowerCase();
  return keywords.reduce((acc, kw) => acc + (norm.includes(kw) ? 1 : 0), 0);
}

async function main() {
  await client.connect();
  const { rows } = await client.query(`
    SELECT h.id, k.ad as kategori, h.baslik, COALESCE(h.icerik,'') as icerik
    FROM haberler h JOIN kategoriler k ON k.id=h.kategori_id
    WHERE h.kategori_dogrulandi=true AND k.ad IN ('Spor','Genel','Siyaset')
  `);
  await client.end();
  
  const sporWithSiyaset = rows.filter(r => r.kategori === 'Spor' && countHits(r.baslik + ' ' + r.icerik, siyasetSignals) >= 1);
  const genelWithHigh = rows.filter(r => r.kategori === 'Genel' && countHits(r.baslik + ' ' + r.icerik, siyasetSignals) >= 2);
  
  console.log('sporPool (Spor with >=1 siyaset signal):', sporWithSiyaset.length);
  console.log('genelPool (Genel with >=2 siyaset signals):', genelWithHigh.length);
  
  if (sporWithSiyaset.length < 5) {
    console.log('sporPool items:');
    sporWithSiyaset.forEach(r => console.log('-', r.id, r.baslik.substring(0,70)));
  }
}
main().catch(e => { console.error(e.message); process.exit(1); });
