// Fetch DB samples and call prediction API
const http = require('http');
const { Client } = require('pg');

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:your_password_here@postgres:5432/news_db';
const client = new Client({ connectionString: dbUrl });

async function predict(title, contextText) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ title, contextText: contextText || title });
    const options = {
      hostname: 'localhost', port: 3000, path: '/api/ml/categorize', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = http.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({ rawError: d.substring(0,100) }); } });
    });
    req.on('error', (e) => resolve({ networkError: e.message }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ timeout: true }); });
    req.write(body); req.end();
  });
}

async function main() {
  await client.connect();
  const { rows } = await client.query(`
    WITH latest_per_news AS (
      SELECT DISTINCT ON (mv.haber_id)
        mv.haber_id, mv.yeni_kategori_id, mv.olusturulma_tarihi
      FROM manuel_validasyonlar mv ORDER BY mv.haber_id, mv.olusturulma_tarihi DESC
    )
    SELECT l.haber_id, k.ad AS label, h.baslik, SUBSTRING(h.icerik, 1, 300) AS icerik
    FROM latest_per_news l
    JOIN haberler h ON h.id = l.haber_id
    JOIN kategoriler k ON k.id = l.yeni_kategori_id
    ORDER BY l.olusturulma_tarihi DESC LIMIT 30
  `);
  await client.end();

  let mismatches = 0;
  const errorDirections = {};
  console.log('id|manual|pred|match');
  for (const s of rows) {
    const result = await predict(s.baslik, s.icerik);
    const pred = (result && result.kategori) ? result.kategori : 'ERR';
    const match = pred === s.label ? 'Y' : 'N';
    if (match === 'N') {
      mismatches++;
      const key = s.label + '->' + pred;
      errorDirections[key] = (errorDirections[key] || 0) + 1;
    }
    console.log(s.haber_id + '|' + s.label + '|' + pred + '|' + match);
  }
  const rmer = mismatches / rows.length;
  console.log('RMER=' + mismatches + '/' + rows.length + '=' + rmer.toFixed(3));
  console.log('ErrorDirs=' + JSON.stringify(errorDirections));
  const dirs = Object.keys(errorDirections);
  if (rmer < 0.20) { console.log('GATE=PASS'); }
  else if (rmer < 0.30) {
    const uniqueTargets = new Set(dirs.map(d => d.split('->')[1]));
    console.log('GATE=' + (uniqueTargets.size <= 2 ? 'CAUTION_PASS' : 'HOLD_MULTI_DIRECTION'));
  } else { console.log('GATE=HOLD_HIGH_RMER'); }
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
