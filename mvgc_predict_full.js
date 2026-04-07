// MV-CG Gate: Fetch actual DB titles and run predictions
const http = require('http');
const { execSync } = require('child_process');

function predict(title, contextText) {
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

// Samples with actual DB titles
const samples = JSON.parse(process.env.SAMPLES_JSON || '[]');

async function main() {
  if (!samples.length) { console.error('No samples provided'); process.exit(1); }
  let mismatches = 0;
  const errorDirections = {};
  console.log('id|manual|pred|match');
  for (const s of samples) {
    const result = await predict(s.baslik, s.icerik);
    const pred = (result && result.kategori) ? result.kategori : 'ERR';
    const match = pred === s.label ? 'Y' : 'N';
    if (match === 'N') {
      mismatches++;
      const key = s.label + '->' + pred;
      errorDirections[key] = (errorDirections[key] || 0) + 1;
    }
    console.log(s.id + '|' + s.label + '|' + pred + '|' + match);
  }
  const rmer = mismatches / samples.length;
  console.log('RMER=' + mismatches + '/' + samples.length + '=' + rmer.toFixed(3));
  console.log('ErrorDirs=' + JSON.stringify(errorDirections));
  const dirs = Object.keys(errorDirections);
  if (rmer < 0.20) { console.log('GATE=PASS'); }
  else if (rmer < 0.30) {
    const uniqueTargets = new Set(dirs.map(d => d.split('->')[1]));
    console.log('GATE=' + (uniqueTargets.size <= 2 ? 'CAUTION_PASS' : 'HOLD_MULTI_DIRECTION'));
  } else { console.log('GATE=HOLD_HIGH_RMER'); }
}
main();
