// MV-CG Gate: Get model predictions for all 30 manual validation samples
const http = require('http');

const samples = [
  { id: 1553, label: 'Siyaset',  title: "Afşin'de bine yakın işçinin işten çıkarıldığı iddiası TBMM gündeminde" },
  { id: 793,  label: 'Sağlık',   title: "COVID-19: Salgın Bitti, Tehdit Kalıcı" },
  { id: 217,  label: 'Ekonomi',  title: "Kapasite kullanım oranı martta yüzde 73,3 oldu" },
  { id: 814,  label: 'Genel',    title: "ALO 171'den sigara ile mücadalede etkin takip" },
  { id: 774,  label: 'Sağlık',   title: "Doktorlar zamanla yarıştı: Hem bebeğini doğurdu hem lösemiyi yendi" },
  { id: 708,  label: 'Dünya',    title: "İsrail Tahran'a Yeni Saldırı Dalgaları Başlattı: ABD Ortak" },
  { id: 202,  label: 'Dünya',    title: "Putin, Rusyadan külçe altın ihracatını yasakladı" },
  { id: 733,  label: 'Dünya',    title: "ABD'nin Körfez Adaları Planı: Hürmüz Gerilimi Tırmanıyor" },
  { id: 139,  label: 'Spor',     title: "NBA All-Star İlk Beşleri Açıklandı: LeBron'un Serisi Bitti" },
  { id: 818,  label: 'Sağlık',   title: "Sigara Ölüm Tuzağı: Her İki Kullanıcıdan Biri Hayatını Kaybediyor" },
  { id: 816,  label: 'Sağlık',   title: "Giyilebilir teknolojilerle bebeklerin kalp sağlığı anbean takip ediliyor" },
  { id: 711,  label: 'Dünya',    title: "İran Atom Enerjisi Kurumu: Buşehr Nükleer Enerji Santrali sahasına füze isabet etti" },
  { id: 776,  label: 'Sağlık',   title: "Yanlış Nefes Alışı: Yorgunluktan Kaygıya Gizli Sağlık Düşmanı" },
  { id: 718,  label: 'Dünya',    title: "İran'dan ABD ve İsrail'e 'Gözden Fazlası' Tehdidi" },
  { id: 778,  label: 'Genel',    title: "Türkiye'de yaklaşık 1,8 milyon yaşlı tek başına yaşıyor" },
  { id: 817,  label: 'Sağlık',   title: "Kapalı Baypas Devrimi: Hasta Bir Günde Sağlığına Kavuştu" },
  { id: 194,  label: 'Dünya',    title: "Ortadoğu Gerilimi Almanya'da Elektrik Fiyatlarını Yükseltti" },
  { id: 729,  label: 'Dünya',    title: "Irak Petrol Bakanlığı: Savaş nedeniyle petrol faaliyetleri büyük ölçüde sekteye uğradı" },
  { id: 783,  label: 'Genel',    title: "1915 Tıbbiyeliler: Çanakkale'nin Unutulmaz Fedakarlığı" },
  { id: 795,  label: 'Sağlık',   title: "Türk Hastanesi, Avrupa'nın Üroloji Eğitim Üssü Oldu" },
  { id: 721,  label: 'Dünya',    title: "CBS News: Beyaz Saray, İran'ın 15 maddelik öneriye bugün yanıt vermesini bekliyor" },
  { id: 790,  label: 'Sağlık',   title: "Glokomda erken teşhis görmeyi kurtarıyor" },
  { id: 779,  label: 'Sağlık',   title: "36 yeni ilaç SGK geri ödeme listesine alındı" },
  { id: 698,  label: 'Dünya',    title: "İşgalci İsrail ordusunun Lübnan'a geceden beri düzenlediği saldırılarda 22 kişi öldü" },
  { id: 146,  label: 'Spor',     title: "Süper Lig Devlerinin Sosyal Medya Takipçileri 82 Milyona Ulaştı" },
  { id: 728,  label: 'Dünya',    title: "Kalibaf: Askerlerini otellerde saklayan ABD, topraklarımızda onları nasıl koruyacak" },
  { id: 132,  label: 'Spor',     title: "Süper Lig'de yeni sezon 14 Ağustos'ta başlayacak" },
  { id: 781,  label: 'Sağlık',   title: "4 Yıllık Hıçkırık Kabusu, Bilkent'te 1 Haftada Bitti" },
  { id: 809,  label: 'Sağlık',   title: "Kalp nakli bekleyen hasta yapay kalple hayata tutundu" },
  { id: 713,  label: 'Dünya',    title: "İran'dan Netanyahu'ya Sert Çıkış: 'Amerikalı Hayatlarıyla Kumar Oynadı'" },
];

function predict(title) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ title, contextText: title });
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: '/api/ml/categorize',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ error: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  let mismatches = 0;
  const errorDirections = {};
  console.log('haber_id | manual_label | model_prediction | match | error_direction');
  console.log('---------|--------------|-----------------|-------|----------------');
  for (const s of samples) {
    try {
      const result = await predict(s.title);
      const pred = result.data?.category || result.category || 'ERROR';
      const match = pred === s.label ? 'Y' : 'N';
      if (match === 'N') {
        mismatches++;
        const key = `${s.label}->${pred}`;
        errorDirections[key] = (errorDirections[key] || 0) + 1;
      }
      console.log(`${s.id} | ${s.label} | ${pred} | ${match}`);
    } catch (e) {
      console.log(`${s.id} | ${s.label} | ERROR | N`);
      mismatches++;
    }
  }
  const RMER = mismatches / 30;
  console.log('');
  console.log(`RMER: ${mismatches}/30 = ${RMER.toFixed(3)}`);
  console.log('Error directions:', JSON.stringify(errorDirections, null, 2));
  
  if (RMER < 0.20) {
    console.log('GATE: PASS - Proceed to Faz 0');
  } else if (RMER < 0.30) {
    const dirs = Object.keys(errorDirections);
    const singleDir = dirs.length <= 2;
    if (singleDir) {
      console.log('GATE: CAUTION - PASS with double validation (single-direction errors, model issue likely)');
    } else {
      console.log('GATE: HOLD - Multi-direction errors, label inconsistency likely');
    }
  } else {
    console.log('GATE: HOLD - RMER >= 0.30, fix label standard before proceeding');
  }
}

main();
