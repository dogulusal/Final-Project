# Guard-First Anti-Drift Tasarımı

**Tarih**: 2026-04-12  
**Durum**: DRAFT  
**Hedef**: `categorize()` çıktısındaki absürt kategori hatalarını kural tabanlı 3 katmanla engellemek  
**Dosya**: `backend/src/modules/ml/ml.service.ts` — `categorize()` metodu  
**Dispute Hedefi**: %4.9 oranını koruyarak absürt mismatch'leri (Basketbol→Sağlık vb.) ortadan kaldırmak

---

## Problem Özeti

| Metrik | Değer |
|--------|-------|
| Toplam dispute oranı | %4.9 (42/849) |
| En kötü çift | Genel ↔ Siyaset (16) |
| 2. kötü çift | Genel ↔ Sağlık (7) |
| 3. kötü çift | Dünya ↔ Genel (6) |
| Absürt örnek | "Basketbol Süper Lig: Tofaş - Beşiktaş" → ML: Sağlık (0.908), LLM: Spor (1.000) |

### Kök Nedenler
1. **Sağlık minority class** (%6.5, 202 kayıt) — NB belirsiz kaldığında Sağlık prior'ına düşüyor
2. **Genel/Siyaset/Dünya ontolojik örtüşme** — "Cumhurbaşkanı açıklama yaptı" hem Genel hem Siyaset olabilir
3. **Confidence kalibrasyonsuz** — ML 0.908 diyerek yanlış kategori seçiyor, güven skoru doğruluk olasılığını yansıtmıyor

### Neden Retrain Değil?
Eğitim verisi %90+ manuel doğrulanmış. Model accuracy %85. Problem modelin kendisinde değil, **sınır vakalarda NB'nin drift etmesinde**. Guard katmanları bu drift'i yakalayacak.

---

## Mimari

```
NB+LR soft voting
    → keyword bonus (mevcut)
    → [YENİ] Katman 1: Sağlık Negatif Sinyal
    → [YENİ] Katman 2: Boundary Guard (Genel/Siyaset/Dünya)
    → [YENİ] Katman 3: Confidence Band
    → final çıktı (kategori + confidence + band)
```

Tüm katmanlar `categorize()` metodu içinde, mevcut keyword bonus bloğundan sonra ve `return` ifadesinden önce eklenir. Yeni dosya/servis gerekmez.

### Ön Koşul: originalBestCategory Snapshot

Katman 1 başlamadan **hemen önce** orijinal kategori kaydedilmelidir. Katman 3'teki `wasGuardOverridden` kontrolü bu değişkene bağlıdır.

```typescript
// ── Guard katmanları başlamadan önce orijinal sonucu kaydet ──
const originalBestCategory = bestCategory;
```

Bu satır keyword bonus bloğunun bitip bestCategory/highestConfidence'ın ilk kez belirlendiği noktadan hemen sonra, Katman 1'den önce yer almalıdır.

---

## Katman 1: Sağlık Negatif Sinyal Seti

### Amaç
Sağlık kategorisi kazandığında, metinde güçlü anti-Sağlık terimleri varsa Sağlık skorunu penalize et.

### Mekanizma

```typescript
// ── Katman 1: Sağlık Negatif Sinyal ──
const antiSaglikSignals: Record<string, string[]> = {
  Spor: ['maç', 'lig', 'gol', 'futbol', 'basketbol', 'voleybol', 
         'şampiyon', 'kupa', 'derbi', 'forvet', 'hakem', 'teknik direktör',
         'süper lig', 'tff', 'uefa', 'şampiyonlar ligi'],
  Siyaset: ['meclis', 'milletvekili', 'cumhurbaşkanı', 'seçim', 'parti',
            'muhalefet', 'iktidar', 'tbmm', 'kanun', 'anayasa'],
  Ekonomi: ['borsa', 'faiz', 'enflasyon', 'dolar', 'ihracat', 'piyasa',
            'banka', 'kredi', 'bütçe', 'vergi', 'yatırım'],
  Teknoloji: ['yapay zeka', 'yazılım', 'siber', 'çip', 'nasa', 'uydu',
              'akıllı telefon', 'robot'],
  Dünya: ['nato', 'bm', 'ukrayna', 'israil', 'iran', 'abd',
          'avrupa birliği', 'uluslararası', 'savaş', 'diplomasi'],
};

if (bestCategory === 'Sağlık') {
  const saglikKeywordHits = (keywordHints['Sağlık'] as string[])
    .reduce((acc, h) => acc + (normalized.includes(h) ? 1 : 0), 0);

  let maxAntiCategory = '';
  let maxAntiHits = 0;
  for (const [cat, terms] of Object.entries(antiSaglikSignals)) {
    const hits = terms.reduce((acc, t) => acc + (normalized.includes(t) ? 1 : 0), 0);
    if (hits > maxAntiHits) {
      maxAntiHits = hits;
      maxAntiCategory = cat;
    }
  }

  // Anti-hit ≥ 2 VE Sağlık keyword == 0 → Sağlık'tan çık
  // GÜVENLİK: maxAntiCategory'nin scores objesinde mevcut olduğunu doğrula.
  // Olmayan bir kategoriye penalty aktarmak, kategori ID mapping'ini bozabilir.
  if (maxAntiHits >= 2 && saglikKeywordHits === 0 && maxAntiCategory
      && scores.hasOwnProperty(maxAntiCategory)) {
    console.log(`[ML Guard] Sağlık negatif sinyal: "${title}" → ${maxAntiCategory} (anti-hit=${maxAntiHits})`);
    
    // Sağlık skorunu %40 düşür, anti-kategori skorunu yükselt
    const saglikPenalty = scores['Sağlık'] * 0.40;
    scores['Sağlık'] -= saglikPenalty;
    scores[maxAntiCategory] += saglikPenalty;
    
    // bestCategory'yi yeniden hesapla
    let newBest = bestCategory;
    let newHighest = 0;
    for (const [cat, score] of Object.entries(scores)) {
      if ((score as number) > newHighest) {
        newHighest = score as number;
        newBest = cat;
      }
    }
    bestCategory = newBest;
    highestConfidence = newHighest;
  }
}
```

### Tetiklenme Koşulları
- `bestCategory === 'Sağlık'` (sadece Sağlık kazandığında devreye girer)
- Anti-kategori hit ≥ 2 (tek kelimelik rastgele eşleşme önlenir)
- Sağlık keyword hit == 0 (gerçek sağlık haberleri korunur)
- **`scores.hasOwnProperty(maxAntiCategory)`** — hedef kategori scores objesinde yoksa penalty aktarılmaz (phantom key koruması)

### Beklenen Etki
- "Basketbol Süper Lig" → Spor'a düşer (anti-Spor hit: basketbol + lig + süper lig = 3)
- "Salgın ve aşı kampanyası" → Sağlık kalır (saglikKeywordHits: salgın + aşı = 2, guard tetiklenmez)

---

## Katman 2: Genel ↔ Siyaset ↔ Dünya Boundary Guard

### Amaç
Bu üç kategori arasında kazanan belirlendikten sonra, güçlü bağlamsal sinyallere göre override et.

### Mekanizma

```typescript
// ── Katman 2: Boundary Guard ──
const boundaryTriangle = ['Genel', 'Siyaset', 'Dünya'];

if (boundaryTriangle.includes(bestCategory)) {
  const siyasetSignals = [
    'meclis oturumu', 'tbmm', 'milletvekili', 'cumhurbaşkanı',
    'kanun teklifi', 'yasa tasarısı', 'seçim kampanyası',
    'parti kongresi', 'parti genel başkan', 'muhalefet partisi',
    'bakanlar kurulu', 'kabine toplantısı', 'siyasi kriz',
    'iktidar partisi', 'anayasa değişikliği',
  ];
  
  const dunyaSignals = [
    'nato', 'bm', 'birleşmiş milletler', 'avrupa birliği', 'ab komisyonu',
    'ukrayna', 'rusya', 'israil', 'filistin', 'iran', 'abd', 'çin',
    'uluslararası', 'diplomatik', 'büyükelçi', 'dışişleri bakanlığı',
    'bölgesel kriz', 'sınır ötesi', 'barış görüşmesi',
  ];
  
  const siyasetHits = siyasetSignals.reduce((acc, s) => acc + (normalized.includes(s) ? 1 : 0), 0);
  const dunyaHits = dunyaSignals.reduce((acc, s) => acc + (normalized.includes(s) ? 1 : 0), 0);
  
  // Kural 1: Genel kazanmış ama güçlü siyaset bağlamı var → Siyaset'e çevir
  if (bestCategory === 'Genel' && siyasetHits >= 2 && dunyaHits === 0) {
    console.log(`[ML Guard] Boundary: Genel→Siyaset (siyaset-hit=${siyasetHits})`);
    bestCategory = 'Siyaset';
    // Confidence'ı %10 düşür (override yapıldığını işaretle)
    highestConfidence *= 0.90;
  }
  
  // Kural 2: Genel veya Siyaset kazanmış ama güçlü dünya bağlamı var → Dünya'ya çevir
  if ((bestCategory === 'Genel' || bestCategory === 'Siyaset') && dunyaHits >= 2) {
    console.log(`[ML Guard] Boundary: ${bestCategory}→Dünya (dunya-hit=${dunyaHits})`);
    bestCategory = 'Dünya';
    highestConfidence *= 0.90;
  }
  
  // Kural 3: Siyaset/Dünya kazanmış ama hiçbir güçlü sinyal yok → Genel'e geri al
  // ⚠️ Bu kural en riskli override'dır. Margin < 0.10 eşiği keyfi olduğundan
  //    doğru Siyaset/Dünya haberlerini Genel'e itebilir.
  //    Ayrı env flag ile kontrol edilir: GUARD_BOUNDARY_KURAL3_ENABLED
  const kural3Enabled = process.env.GUARD_BOUNDARY_KURAL3_ENABLED !== 'false'; // default: true
  if (kural3Enabled
      && (bestCategory === 'Siyaset' || bestCategory === 'Dünya') 
      && siyasetHits === 0 && dunyaHits === 0) {
    // Sadece keyword bonus ile Siyaset/Dünya'ya itilmiş olabilir
    // Eğer confidence margin dar ise → Genel'e geri çek
    const genelScore = scores['Genel'] || 0;
    const bestScore = scores[bestCategory] || 0;
    if (bestScore - genelScore < 0.10) {
      console.log(`[ML Guard] Boundary: ${bestCategory}→Genel (sinyal yok, margin dar)`);
      bestCategory = 'Genel';
      highestConfidence = genelScore;
    }
  }
}
```

### Override Kuralları Tablosu

| # | Mevcut Kazanan | Koşul | Yeni Kazanan | Confidence |
|---|----------------|-------|-------------|------------|
| 1 | Genel | siyasetHits ≥ 2, dunyaHits == 0 | Siyaset | ×0.90 |
| 2 | Genel / Siyaset | dunyaHits ≥ 2 | Dünya | ×0.90 |
| 3 | Siyaset / Dünya | siyasetHits == 0, dunyaHits == 0, margin < 0.10 | Genel | = genelScore |

### Beklenen Etki
- "Cumhurbaşkanı Erdoğan açıklama yaptı" → Genel yerine Siyaset (kural 1)
- "NATO zirvesinde Ukrayna gündemi" → Dünya (kural 2)
- "Vatandaşlardan şikayet yağdı" → hiçbir sinyal yok → Genel kalır (kural 3 tetiklenmez: zaten Genel)

---

## Katman 3: Confidence Band Sistemi

### Amaç
Confidence değerini doğruluk olasılığıyla daha uyumlu hale getirmek. Retrain yapmadan post-hoc band atama.

### Mekanizma

```typescript
// ── Katman 3: Confidence Band ──
type ConfidenceBand = 'HIGH' | 'MEDIUM' | 'LOW';

let confidenceBand: ConfidenceBand;
const wasGuardOverridden = bestCategory !== originalBestCategory; // override oldu mu
const totalKeywordHits = Object.values(hintBonusByCategory).reduce((a, b) => a + b, 0);

if (highestConfidence >= 0.85 && totalKeywordHits >= 1 && !wasGuardOverridden) {
  confidenceBand = 'HIGH';
} else if (highestConfidence >= 0.60 || wasGuardOverridden) {
  confidenceBand = 'MEDIUM';
} else {
  confidenceBand = 'LOW';
}

// Guard override yapıldıysa confidence'ı zaten %10 düşürdük (Katman 2'de)
// LOW band'daki kayıtlar dispute'a düşme olasılığı daha yüksek
```

### Band Tablosu

| Band | Koşul | Anlam |
|------|-------|-------|
| HIGH | conf ≥ 0.85 AND keyword ≥ 1 AND no override | Model güvenilir + keyword destekli |
| MEDIUM | conf ≥ 0.60 OR guard override yapıldı | Normal / düzeltilmiş |
| LOW | conf < 0.60 AND keyword == 0 | Düşük güven, dispute öncelikli |

### Return Objesi Değişikliği

```typescript
// Mevcut:
return {
  kategori: bestCategory,
  confidence: highestConfidence,
  allScores: scores
};

// Yeni:
return {
  kategori: bestCategory,
  confidence: highestConfidence,
  confidenceBand,          // YENİ
  guardOverride: wasGuardOverridden ? originalBestCategory : null, // YENİ (debug amaçlı)
  allScores: scores
};
```

### Tüketici Etkisi
- `confidenceBand` ve `guardOverride` opsiyonel field'lar — mevcut tüketiciler (RSS scheduler, news controller, LLM worker) etkilenmez
- İleride admin panel'de "LOW band" kayıtlarını öncelikli göstermek için kullanılabilir

---

## Uygulama Planı

### Sıra

| Adım | Katman | Dosya | Etki |
|------|--------|-------|------|
| 1 | Sağlık Negatif Sinyal | `ml.service.ts` | Absürt Sağlık hataları durur |
| 2 | Boundary Guard | `ml.service.ts` | Genel↔Siyaset mismatch azalır |
| 3 | Confidence Band | `ml.service.ts` | Debug/audit bilgisi eklenir |

### Test Stratejisi
1. Mevcut bekliyor dispute'lardan **tüm 42 kaydı** al (bilinen yanlış tahminler)
2. Her birini yeni `categorize()` ile çalıştır, guard log'larını kaydet
3. Guard tetiklenen kayıtlarda **LLM ile uyum analizi**: guard sonrası NB kategori == LLM kategori mi?
   - Eğer guard NB'yi LLM ile aynı hizaya getiriyorsa → dispute azalır ✓
   - Eğer guard NB'yi LLM'den farklı bir yere itiyorsa → yeni dispute üretiyor ✗
4. **Guard-LLM uyum oranı** metriği: `(guard sonrası NB==LLM) / (guard tetiklenen toplam)` ≥ %70 hedef
5. Genel benchmark (mevcut doğrulanmış veriyle) accuracy düşmediğini kontrol et
6. Kural 3 için ayrı test: Kural 3 açık/kapalıyken dispute sayısı karşılaştırması

### Geri Alma
- Her katman bağımsız if-bloğu — tek tek kapatılabilir
- Env flag ile disable edilebilir:
  - `GUARD_SAGLIK_ENABLED=true` — Katman 1 (Sağlık negatif sinyal)
  - `GUARD_BOUNDARY_ENABLED=true` — Katman 2 kuralları 1+2
  - `GUARD_BOUNDARY_KURAL3_ENABLED=true` — Katman 2 kural 3 (Siyaset/Dünya→Genel geri çekme, ayrı flag çünkü en riskli override)

---

## Riskler ve Azaltma

| Risk | Olasılık | Azaltma |
|------|----------|---------|
| Guard gerçek Sağlık haberini yanlışlıkla penalize eder | Düşük | saglikKeywordHits == 0 koşulu korur |
| Boundary guard Genel haberi yanlışlıkla Siyaset yapar | Orta | Hit eşiği ≥ 2 + dunyaHits == 0 koşulu |
| Kural 3 doğru Siyaset/Dünya haberini Genel'e iter | Orta | Ayrı env flag (`GUARD_BOUNDARY_KURAL3_ENABLED`), margin eşiği 0.10 tutucu seçildi, test sonrası ayarlanabilir |
| Score redistribution phantom key oluşturur | Düşük | `scores.hasOwnProperty(maxAntiCategory)` guard'ı; mevcut olmayan kategoriye penalty aktarılmaz |
| Confidence band mevcut auto-resolve mantığını bozar | Yok | Band sadece bilgi amaçlı, NB==LLM mantığına dokunmaz |
| Keyword listesi yetersiz kalır | Orta | Log'larla izlenip iteratif genişletilir |

---

## Başarı Kriterleri
- [ ] "Basketbol Süper Lig" gibi absürt Sağlık tahminleri ortadan kalkar
- [ ] Genel↔Siyaset dispute sayısı ≤ 8'e düşer (mevcut: 16)
- [ ] Mevcut accuracy (%85) düşmez
- [ ] Yeni false positive dispute üretilmez (guard yanlışlıkla doğru tahminleri bozmaz)
- [ ] Guard-LLM uyum oranı ≥ %70 (guard tetiklenen kayıtlarda NB sonrası == LLM)
- [ ] Kural 3 false positive oranı ≤ %20 (doğru Siyaset/Dünya haberini Genel'e itme)
