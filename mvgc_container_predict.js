const http = require('http');
// Labels: Siyaset, Saglik=Sağlık, Ekonomi, Genel, Dunya=Dünya, Spor, Teknoloji
const samples = [
  { id: 1553, label: 'Siyaset', title: 'meclis sorusu milletvekili isci ihrac TBMM bakanligi' },
  { id: 793,  label: 'Saglik', title: 'COVID hastalık saglik salgin olu bitti tehdit' },
  { id: 217,  label: 'Ekonomi', title: 'Kapasite kullanim orani imalat sanayii ekonomi' },
  { id: 814,  label: 'Genel', title: 'ALO 171 sigara birakma danisma hatti' },
  { id: 774,  label: 'Saglik', title: 'hamilelik losemi dogum tedavi saglik' },
  { id: 708,  label: 'Dunya', title: 'Israil Tahran saldiri ABD ortak operasyon' },
  { id: 202,  label: 'Dunya', title: 'Putin Rusya kulce altin ihracat yasak' },
  { id: 733,  label: 'Dunya', title: 'ABD Korfez Adalari Hurmuz gerilim' },
  { id: 139,  label: 'Spor', title: 'NBA All-Star LeBron basketbol' },
  { id: 818,  label: 'Saglik', title: 'Sigara olum riski saglik haberi' },
  { id: 816,  label: 'Saglik', title: 'giyilebilir teknoloji bebek kalp sagligi' },
  { id: 711,  label: 'Dunya', title: 'Iran Busehr nukleer santral fuzye saldiri' },
  { id: 776,  label: 'Saglik', title: 'yanlis nefes yorgunluk kaygi saglik' },
  { id: 718,  label: 'Dunya', title: 'Iran ABD Israil tehdit askeri' },
  { id: 778,  label: 'Genel', title: 'Turkiye yasli tek basina yasiyor' },
  { id: 817,  label: 'Saglik', title: 'kapali baypas kalp ameliyati hasta saglik' },
  { id: 194,  label: 'Dunya', title: 'Ortadogu Almanya elektrik fiyat artis' },
  { id: 729,  label: 'Dunya', title: 'Irak petrol uretim savas durdu' },
  { id: 783,  label: 'Genel', title: '1915 tibbiyeli Canakkale tarih' },
  { id: 795,  label: 'Saglik', title: 'Turk hastanesi Avrupa uroloji egitim' },
  { id: 721,  label: 'Dunya', title: 'Beyaz Saray Iran anlasma oneri yanit' },
  { id: 790,  label: 'Saglik', title: 'glokom erken teshis gorme saglik' },
  { id: 779,  label: 'Saglik', title: 'ilac SGK geri odeme saglik' },
  { id: 698,  label: 'Dunya', title: 'Israil Lubnan saldiri olu' },
  { id: 146,  label: 'Spor', title: 'Super Lig futbol sosyal medya' },
  { id: 728,  label: 'Dunya', title: 'ABD Iran askeri operasyon' },
  { id: 132,  label: 'Spor', title: 'Super Lig futbol yeni sezon' },
  { id: 781,  label: 'Saglik', title: 'hickirik tedavi hastane saglik' },
  { id: 809,  label: 'Saglik', title: 'kalp nakli yapay kalp saglik' },
  { id: 713,  label: 'Dunya', title: 'Iran Netanyahu ABD gerilim' },
];

const LABEL_MAP = { 'Saglik': 'Sağlık', 'Dunya': 'Dünya' };

function predict(title) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ title: title, contextText: title });
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
  let mismatches = 0;
  const errorDirections = {};
  console.log('id|manual|pred|match');
  for (const s of samples) {
    const result = await predict(s.title);
    const pred = (result && result.kategori) ? result.kategori : 'ERR';
    const labelExpected = LABEL_MAP[s.label] || s.label;
    const match = pred === labelExpected ? 'Y' : 'N';
    if (match === 'N') {
      mismatches++;
      const key = labelExpected + '->' + pred;
      errorDirections[key] = (errorDirections[key] || 0) + 1;
    }
    console.log(s.id + '|' + labelExpected + '|' + pred + '|' + match);
  }
  const rmer = mismatches / 30;
  console.log('RMER=' + mismatches + '/30=' + rmer.toFixed(3));
  const dirs = Object.keys(errorDirections);
  console.log('ErrorDirs=' + JSON.stringify(errorDirections));
  if (rmer < 0.20) { console.log('GATE=PASS'); }
  else if (rmer < 0.30) {
    const uniqueTargets = new Set(dirs.map(d => d.split('->')[1]));
    console.log('GATE=' + (uniqueTargets.size <= 2 ? 'CAUTION_PASS' : 'HOLD_MULTI_DIRECTION'));
  } else { console.log('GATE=HOLD_HIGH_RMER'); }
}
main();