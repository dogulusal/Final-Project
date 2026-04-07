# Siyaset Kategorisi ML Performans İyileştirmesi — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Siyaset F1 skorunu 0.552'den 0.65+ seviyesine çıkarmak; genel accuracy ≥72% korumak.

**Architecture:** Enhanced confusion matrix logging → veri kalite auditi → hard negative mantık düzeltmesi → keyword boost ayarı → upsampling ince ayar. Her faz bağımsız olarak doğrulanabilir.

**Tech Stack:** TypeScript, natural.BayesClassifier, Prisma, PostgreSQL, Docker

**Agency-rules Check:** 
- §2 (Dataset & ML Training): `dataset-quality-guard` skill **MUST** be invoked before Faz 1 data changes
- No llm.service.ts changes → §1 ihtiyaç yok
- No RSS changes → RSS health monitor ihtiyaç yok

---

## Chunk 1: Faz 0 — Enhanced Confusion Matrix Logging

### Task 0.1: Siyaset-Odaklı Kaçış Raporu Ekleme

**Files:**
- Modify: `backend/src/modules/ml/ml.service.ts` — `logDiagnostics()` (L367-L435)

#### Step 1: Siyaset→* kaçış yüzdeleri ekle

- [ ] Read `logDiagnostics()` mevcut kodunu anlayarak, aşağıdaki logu Siyaset-spesifik hale getir

Mevcut kod (L367-L368):
```typescript
private logDiagnostics(diag: TrainDiagnostics): void {
    console.log(`[ML][Diagnostics] Accuracy=%${(diag.accuracy * 100).toFixed(2)} Macro-F1=${diag.macroF1} Train=${diag.trainSize} Test=${diag.testSize}`);
```

Yeni loglanacak (L405-L425 sonrasına, `logDiagnostics` sonunda eklenecek):
```typescript
// === SIYASET-SPECIFIC LEAK ANALYSIS (Faz 0) ===
const siyasetIndex = categories.indexOf('Siyaset');
if (siyasetIndex !== -1) {
    const siyasetRow = matrix?.[siyasetIndex] || [];
    const totalErrors = siyasetRow.reduce((sum, val, idx) => idx !== siyasetIndex ? sum + val : sum, 0);
    
    if (totalErrors > 0) {
        const leakages = categories
            .map((cat, idx) => ({ 
                category: cat, 
                count: idx !== siyasetIndex ? (siyasetRow[idx] || 0) : 0,
                pct: idx !== siyasetIndex ? (((siyasetRow[idx] || 0) / totalErrors) * 100).toFixed(1) : '0' 
            }))
            .filter(item => item.count > 0)
            .sort((a, b) => b.count - a.count);
        
        const leakStr = leakages.map(l => `${l.category}: ${l.count} (${l.pct}%)`).join(' | ');
        console.log(`[ML][Diagnostics][SiyasetLeakage] ${leakStr} | Total FN=${totalErrors}`);
        
        const siyasetTP = matrix?.[siyasetIndex]?.[siyasetIndex] || 0;
        const siyasetRecall = totalErrors + siyasetTP > 0 ? (siyasetTP / (totalErrors + siyasetTP) * 100).toFixed(1) : '0';
        console.log(`[ML][Diagnostics][SiyasetRecall] TP=${siyasetTP} FN=${totalErrors} Recall=${siyasetRecall}%`);
    }
}
```

#### Step 2: Ters yönü ekle — kimler Siyaset'e yanlış geliyor

- [ ] `logDiagnostics()` sonunda TowardsSiyaset logu ekle (Siyaset sütunundaki off-diagonal values)

```typescript
// === INCOMING TO SIYASET (False Positives) ===
if (siyasetIndex !== -1) {
    const incomingErrors = categories
        .map((actualCat, actualIdx) => ({
            from: actualCat,
            count: actualIdx !== siyasetIndex ? (matrix?.[actualIdx]?.[siyasetIndex] || 0) : 0
        }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count);
    
    if (incomingErrors.length > 0) {
        const incomingStr = incomingErrors.map(e => `${e.from} -> Siyaset: ${e.count}`).join(' | ');
        console.log(`[ML][Diagnostics][TowardsSiyaset] ${incomingStr}`);
    }
}
```

#### Step 3: Net confusion raporu (count >= 2 olan çiftler)

- [ ] `logDiagnostics()` sonunda NetConfusion logu ekle (bidirectional net analysis)

```typescript
// === NET CONFUSION (Bidirectional) ===
if (siyasetIndex !== -1) {
    const genelIndex = categories.indexOf('Genel');
    if (genelIndex !== -1) {
        const genelToSiyaset = matrix?.[genelIndex]?.[siyasetIndex] || 0;
        const siyasetToGenel = matrix?.[siyasetIndex]?.[genelIndex] || 0;
        const netBalance = siyasetToGenel - genelToSiyaset; // Negative = Siyaset losing more
        const winner = netBalance > 0 ? 'Siyaset' : 'Genel';
        
        if (genelToSiyaset + siyasetToGenel >= 2) {
            console.log(`[ML][Diagnostics][NetConfusion] Genel↔Siyaset | Genel->Siyaset=${genelToSiyaset} Siyaset->Genel=${siyasetToGenel} | Net=${Math.abs(netBalance)} (${winner} kazanıyor)`);
        }
    }
}
```

#### Step 4: Benchmark çalıştır ve yeni log formatını doğrula

- [ ] Terminal açıver ve şu komutu çalıştır (backend container'ında):
```bash
docker compose exec -e FORCE_DISK_FALLBACK=0 -e ML_DISK_SUPPLEMENT_LIMIT=0 -T backend sh -c "cd /app; npx ts-node scripts/benchmark-faz5a.ts --disk-supplement=0 --mode=unigram-bigram --manual-only"
```

- [ ] **Expected output:** Yeni şu logları gözle:
  - `[ML][Diagnostics][SiyasetLeakage] Genel: 3 (43%) | Dünya: 1 (14%) | ... | Total FN=7`
  - `[ML][Diagnostics][SiyasetRecall] TP=8 FN=7 Recall=53.3%`
  - `[ML][Diagnostics][TowardsSiyaset] Genel -> Siyaset: 5 | ...`
  - `[ML][Diagnostics][NetConfusion] Genel↔Siyaset | Genel->Siyaset=5 Siyaset->Genel=3 | Net=2 (Siyaset kazanıyor)`

#### Step 5: Commit

- [ ] Stage and commit:
```bash
git add backend/src/modules/ml/ml.service.ts
git commit -m "feat(ml): enhance confusion matrix logging with Siyaset-specific leak analysis"
```

---

#### Step 6: Faz 0 Log Formatı Doğrulama (KRITIK — Faz 2 karar matrisinin temelini oluşturur)

- [ ] **CRITICALLY IMPORTANT:** Faz 0 benchmark çıktısında şu logları doğrula:
  - `[ML][Diagnostics][SiyasetLeakage]` log mü var? (Varsa, Faz 2 için veri alındı)
  - `[ML][Diagnostics][TowardsSiyaset]` log mü var? (Varsa, ters yön kaçışları biliniyor)
  - `[ML][Diagnostics][NetConfusion]` log mü var? (Varsa, net balance belirleniyor)
  
- [ ] **Eğer hiç biri görünmüyorsa:** ml.service.ts'deki logDiagnostics() fonksiyonunda hata var. Debug et ve Step 1-3 kodunu tekrar kontrol et.

- [ ] **Log formatı doğru gözüküyorsa:** Şu değerleri **not al:**
  - Siyaset→Genel kaçış sayısı (örn: "3" veya "5")
  - Siyaset→Dünya kaçış sayısı (örn: "1" veya "2")
  - Siyaset→Ekonomi kaçış sayısı (örn: "0" veya "1")
  
  Bu değerler Task 2.2 Step 1'de karar matrisi ikamesini belirleyecektir.

- [ ] Commit:
```bash

---

## Chunk 2: Faz 1 — Veri Kalite ve Hacim

> **CRITICAL:** Before proceeding, invoke `dataset-quality-guard` skill to validate approach.

### Task 1.1: Mevcut Siyaset Verisi Audit

**Files:**
- Query: PostgreSQL (via docker compose)
- Reference: `backend/scripts/measure-db-distribution.ts`

#### Step 1: Siyaset ml_confidence dağılımını kontrol et

- [ ] Şu SQL sorgusunu PostgreSQL'de çalıştır (docker compose exec -T postgres psql ...):

```sql
SELECT 
  ROUND(ml_confidence::numeric, 2) as confidence_level,
  COUNT(*) as count
FROM haberler h
JOIN kategoriler k ON h.kategori_id = k.id
WHERE k.ad = 'Siyaset' 
  AND durum IN ('hazir', 'yayinda') 
  AND kategori_dogrulandi = true
GROUP BY ROUND(ml_confidence::numeric, 2)
ORDER BY confidence_level ASC;
```

- [ ] **Expected:** Confidence dağılımını inceleyerek:
  - 0.45-0.55 arası çok sayıda kayıt varsa → Apr 4 backfill artığı
  - 0.70+ arası sağlıklı oran varsa → kalitelisi filtrede kalmalı

#### Step 2: Apr 4 backfill dönemine ait şüpheli Siyaset haberlerini listele

- [ ] Şu sorguyu çalıştır:

```sql
SELECT 
  h.id,
  h.baslik,
  h.ml_confidence,
  h.augmented_at,
  k.ad as kategori
FROM haberler h
JOIN kategoriler k ON h.kategori_id = k.id
WHERE k.ad = 'Siyaset' 
  AND augmented_at >= '2026-04-04'::timestamp
  AND kategori_dogrulandi = true
  AND ml_confidence < 0.70
ORDER BY ml_confidence ASC
LIMIT 20;
```

- [ ] **Amaç:** Tabloda düşük confidence Siyaset haberleri görürsen:
  - Başlıkları oku ve kategoriyi doğrula (siyasi haber mi?)
  - Eğer yanlış kategoride ise aşağıdaki adıma geç

#### Step 3: Şüpheli kayıtları düzelt

- [ ] Her şüpheli kayıt için:
  - Doğru kategori mi: evet → skip
  - Yanlış kategori (örn. Genel, Ekonomi olması gerekirdi): UPDATE yap:

```sql
UPDATE haberler 
SET kategori_dogrulandi = false
WHERE id = <HABER_ID>;
-- veya doğru kategoriyi belirliersen:
UPDATE haberler 
SET kategori_id = <CORRECT_CATEGORY_ID>, kategori_dogrulandi = true
WHERE id = <HABER_ID>;
```

- [ ] Commit (tanımlayıcı mesaj ile):
```bash
git add docs/  # eğer notlar aldıysan
git commit -m "fix(data): audit Apr 4 backfill Siyaset records, remove low-confidence mislabels"
```

---

### Task 1.2: Manuel Doğrulama ile Siyaset Hacmini Artır

**Files:**
- Run: `backend/scripts/manual-validate.ts`

#### Step 0: Database yedek al

- [ ] Manuel validasyon öncesi database backup:
```bash
docker compose exec -T postgres sh -c "pg_dump -U postgres news_db" > "c:/Users/dogul/Final-Project/backups/pre-manual-validation-$(date +%s).dump"
```
- **Amaç:** `manuel_validasyonlar` tablo yazıları geri alınabilir olmalı

#### Step 1: Manuel doğrulama CLI'ını çalıştır

- [ ] Terminal'i açarak:
```bash
cd c:/Users/dogul/Final-Project
docker compose exec -T backend sh -c "cd /app && npx ts-node scripts/manual-validate.ts"
```

- [ ] **Process:**
  - CLI bir sonraki unvalidated haber sunacak
  - Haberi oku (baslik + ilk 200 char icerik)
  - Kategoriyi doğrula: (1) Siyaset, (2) Genel, vb. tuşla seç veya düzelt
  - Script otomatik `manuel_validasyonlar` tablosuna yazacak
  - Hedef: Minimum **15+ yeni Siyaset** doğrulaması (75 → 90+)
  - **Fallback:** Eğer unvalidated Siyaset sayısı < 15 ise, mevcut tüm Siyaset haberleri doğrula ve Step 2'ye geç (saydı not et)
  
- [ ] **Expected flow:**
  ```
  [ML] Next unvalidated article (ID=1234):
  Baslik: "Meclis'te yeni tasarı..."
  Preview: "Mecliste yeni bir yasa tasarısı tartışılmaya..."
  
  Correct category? [S]iyaset / [G]enel / [E]konomi / [O]ther / [S]kip
  > S
  [OK] Recorded manual validation for haberId=1234 → Siyaset
  ```

#### Step 2: Doğrulama sonrası dağılım kontrolü

- [ ] CLI bittikten sonra, şu komutla dağılım raporu al:
```bash
docker compose exec -T backend sh -c "cd /app && npx ts-node scripts/measure-db-distribution.ts"
```

- [ ] **Expected output:**
  ```sql
  kategori          | haber_sayisi
  ----------------+--------------
  Genel            | 164
  Siyaset          | 95 (← artmış!)
  Dünya            | 127
  ...
  ```
  
  - Hedef: **Siyaset ≥ 95 (preferably 120+)**
  - Hedef: **Genel/Siyaset oranı ≤ 1.8x** (şu an 164/75 = 2.19x)

#### Step 3: Faz 0 benchmark'ını tekrar çalıştır

- [ ] Veri hacminin etkisini ölç:
```bash
docker compose exec -e FORCE_DISK_FALLBACK=0 -e ML_DISK_SUPPLEMENT_LIMIT=0 -T backend sh -c "cd /app; npx ts-node scripts/benchmark-faz5a.ts --disk-supplement=0 --mode=unigram-bigram --manual-only"
```

- [ ] **Check kritik sayılar:**
  - `[ML][Diagnostics][Siyaset] ... Support=?` — **≥ 20 olmalı**
  - `[ML][Diagnostics][SiyasetLeakage] ... Recall=?%` — Baseline (Faz 0'dan sonra artar mı?)
  - `[ML][Diagnostics] Accuracy=%?` — ≥ 72% korunuyor mu?

#### Step 4: Commit

- [ ] Manuel validasyon notları ve sonuçları commit:
```bash
git add -A
git commit -m "feat(data): manual validation of Siyaset articles — increased volume 75 → 95+"
```

---

## Chunk 3: Faz 2 — Hard Negative Mantığını Düzelt

> **Input:** Faz 0 loglarından kaçış oranlarını oku. Bunlara göre injection miktarlarını ayarla.

### Task 2.1: genelSignals Listesini Genişlet ve genelPool Filtresini Yumuşat

**Files:**
- Modify: `backend/src/modules/ml/ml.service.ts` — `injectHardNegativeBatch()` (L113-L180)

#### Step 1: genelSignals dizisini genişlet (6 → 20+ terim)

- [ ] `injectHardNegativeBatch()` içinde `genelSignals` dizisini bul (L117-L122):

Mevcut:
```typescript
const genelSignals = [
    'vatandas basvurusu', 'sosyal yardim', 'belediye hizmeti',
    'kamu duyurusu', 'resmi aciklama', 'kurum haberi'
];
```

Yeni (genişletilmiş):
```typescript
const genelSignals = [
    // Mevcut:
    'vatandas basvurusu', 'sosyal yardim', 'belediye hizmeti',
    'kamu duyurusu', 'resmi aciklama', 'kurum haberi',
    // Yeni eklenecek:
    'ihale', 'acilis', 'acilis toreni', 'tesis', 'yol yapimi', 'altyapi',
    'festival', 'kultur etkinligi', 'hava durumu', 'trafik', 
    'okul kayit', 'sinav sonucu', 'deprem', 'sel', 'yangin', 'kaza'
];
```

#### Step 2: genelPool filtresini yumuşat

- [ ] `genelPool` tanımlandığı satırı bul (L131-L135):

Mevcut:
```typescript
const genelPool = trainSet.filter(item => {
    if (item.category !== 'Genel') return false;
    const siyasetHit = this.countKeywordHits(item.text, siyasetSignals);
    const genelHit = this.countKeywordHits(item.text, genelSignals);
    return siyasetHit >= 2 && genelHit === 0;
});
```

Yeni:
```typescript
const genelPool = trainSet.filter(item => {
    if (item.category !== 'Genel') return false;
    const siyasetHit = this.countKeywordHits(item.text, siyasetSignals);
    const genelHit = this.countKeywordHits(item.text, genelSignals);
    return siyasetHit >= 2 && genelHit < 2;  // Changed from === 0 to < 2
});
```

#### Step 3: Commit

- [ ] Stage:
```bash
git add backend/src/modules/ml/ml.service.ts
git commit -m "feat(ml): expand genelSignals list and soften genelPool filter"
```

---

### Task 2.2: Injection Ayarlarını Faz 0 Verilerine Göre Ayarla

**Files:**
- Modify: `backend/src/modules/ml/ml.service.ts` — `injectHardNegativeBatch()` injection amounts ve yeni pair'ler

#### Step 1: Faz 0 benchmark loglarından kaçış oranlarını oku ve karar matrisi uygula

- [ ] **ÖNCESI:** Task 0.1 Step 6'da not ettiğin Faz 0 değerlerini bul:
  - Siyaset→Genel: ? (örn: 3, 5, 7)
  - Siyaset→Dünya: ? (örn: 0, 1, 2)
  - Siyaset→Ekonomi: ? (örn: 0, 1)

- [ ] **Karar Tablosu (veri-güdümlü):**
  
  | Siyaset→Genel | genelToSiyaset | Gerekçe |
  |---|---|---|
  | ≥ 4 | 18 (arttır) | Çok fazla kaçış → agresif injection |
  | 3-2 | 10 (düşür) | Orta kaçış → dengeli injection |
  | ≤ 1 | 6 (agresif düşür) | Az kaçış → overfitting riski, azalt |
  
  | Siyaset→Dünya | Aksiyon | Hedef |
  |---|---|---|
  | ≥ 2 | `siyasetDunyaPool` ekle | 6 injection |
  | 0-1 | `siyasetDunyaPool` ekle ama **conservative injection=3** | Veri az da önemli çift |
  
  | Siyaset→Ekonomi | Aksiyon | Hedef |
  |---|---|---|
  | ≥ 2 | `siyasetEkonomiPool` ekle | 4 injection |
  | 0-1 | `siyasetEkonomiPool` ekle ama **conservative injection=2** | Veri az da önemli çift |

- [ ] **Kural:** Herhangi bir confusion pair kaçıp kaçmadığında şüphe varsa, **her zaman pool'u ekle fakat conservative injection hedefini kullan.** Fazla tarafından daha az kayıp olur.

- [ ] **Misal senaryo:**
  - Faz 0 logunda: `[SiyasetLeakage] Genel: 3 (43%) | Dünya: 1 (14%) | Teknoloji: 1 (14%) | ...`
  - Karar: `genelToSiyaset=10`, `siyasetToDunya=3` (conservative), `siyasetToEkonomi=2` (conservative)

#### Step 2: Mevcut genelToSiyaset injection satırını bul ve güncelle

- [ ] L171-L175 satırlarını bul:

Mevcut:
```typescript
const genelToSiyaset = injectFromPool(genelPool, 14);
const siyasetToGenel = injectFromPool(siyasetPool, 10);
const siyasetToTeknoloji = injectFromPool(siyasetTechPool, 8);
```

**Karar:** Faz 0 loglarına bak. Eğer Siyaset→Genel ≤ 3 ise 10'a düşür, ≥ 4 ise tuttur/arttır:

```typescript
// Decision: based on Faz 0 leak analysis
// If Siyaset->Genel is 3 or less: reduce injection to prevent overfitting
// If Siyaset->Genel is 4+: keep or increase
const genelToSiyaset = injectFromPool(genelPool, 10);  // Adjusted from 14 if needed
const siyasetToGenel = injectFromPool(siyasetPool, 10);
const siyasetToTeknoloji = injectFromPool(siyasetTechPool, 8);
```

#### Step 3: Yeni confusion pair ekle — Siyaset↔Dünya

- [ ] `siyasetTechPool` tanımlandıktan sonra (L147-L152), yeni pools ekle:

```typescript
const dunyaSignals = [
    'buyukelci', 'disisleri', 'nato', 'ab', 'birlesmes milletler', 'diplomatik',
    'dis politika', 'uluslararasi', 'antlas', 'misyon', 'konsolos'
];

const siyasetDunyaPool = trainSet.filter(item => {
    if (item.category !== 'Siyaset') return false;
    const siyasetHit = this.countKeywordHits(item.text, siyasetSignals);
    const dunyaHit = this.countKeywordHits(item.text, dunyaSignals);
    return siyasetHit >= 1 && dunyaHit >= 1;
});
```

#### Step 4: Yeni confusion pair ekle — Siyaset↔Ekonomi

- [ ] Aynı şekilde ekonomiPool ekle:

```typescript
const ekonomiSignals = [
    'butce', 'maliye', 'vergi', 'faiz', 'enflasyon', 'ithalat', 'ihracat',
    'borsa', 'doviz', 'merkez bankasi', 'para politikasi', 'ticaret'
];

const siyasetEkonomiPool = trainSet.filter(item => {
    if (item.category !== 'Siyaset') return false;
    const siyasetHit = this.countKeywordHits(item.text, siyasetSignals);
    const ekonomiHit = this.countKeywordHits(item.text, ekonomiSignals);
    return siyasetHit >= 1 && ekonomiHit >= 1;
});
```

#### Step 5: Injection satırlarını güncelle (yeni pair'ler le birlikte)

- [ ] L171-L175'i şu şekilde değiştir:

```typescript
const genelToSiyaset = injectFromPool(genelPool, 10);  // Adjusted
const siyasetToGenel = injectFromPool(siyasetPool, 10);
const siyasetToTeknoloji = injectFromPool(siyasetTechPool, 8);
const siyasetToDunya = injectFromPool(siyasetDunyaPool, 6);  // NEW
const siyasetToEkonomi = injectFromPool(siyasetEkonomiPool, 4);  // NEW
```

#### Step 6: HardNegativeBatchSummary interface'ini güncelle

- [ ] L32-45 satırlarında interface tanımını bul:

Mevcut:
```typescript
interface HardNegativeBatchSummary {
    genelToSiyaset: number;
    siyasetToGenel: number;
    siyasetToTeknoloji: number;
    totalInjected: number;
}
```

Yeni:
```typescript
interface HardNegativeBatchSummary {
    genelToSiyaset: number;
    siyasetToGenel: number;
    siyasetToTeknoloji: number;
    siyasetToDunya: number;    // NEW
    siyasetToEkonomi: number;  // NEW
    totalInjected: number;
}
```

#### Step 7: Return statement'ini güncelle

- [ ] L176-182'de return satırını bul ve yeni pair'leri ekle:

Mevcut:
```typescript
return {
    genelToSiyaset,
    siyasetToGenel,
    siyasetToTeknoloji,
    totalInjected: genelToSiyaset + siyasetToGenel + siyasetToTeknoloji
};
```

Yeni:
```typescript
return {
    genelToSiyaset,
    siyasetToGenel,
    siyasetToTeknoloji,
    siyasetToDunya,
    siyasetToEkonomi,
    totalInjected: genelToSiyaset + siyasetToGenel + siyasetToTeknoloji + siyasetToDunya + siyasetToEkonomi
};
```

#### Step 8: Benchmark çalıştır — Siyaset F1 iyileşmesini kontrol et

- [ ] Terminal:
```bash
docker compose exec -e FORCE_DISK_FALLBACK=0 -e ML_DISK_SUPPLEMENT_LIMIT=0 -T backend sh -c "cd /app; npx ts-node scripts/benchmark-faz5a.ts --disk-supplement=0 --mode=unigram-bigram --manual-only"
```

- [ ] **Expected:**
  - `[ML][Diagnostics][Siyaset] P=? R=? F1=? Support=?` — **F1 > 0.60** (hedef)
  - `[ML][Diagnostics] Accuracy=%?` — **≥ 72%** korunuyor
  - `[ML][HardNegative]` log — yeni pair'lerin injection sayıları

#### Step 9: Commit

- [ ] Stage:
```bash
git add backend/src/modules/ml/ml.service.ts
git commit -m "feat(ml): expand hard negative injection with Dünya and Ekonomi pairs"
```

---

## Chunk 4: Faz 3 & 4 — Keyword Boost ve Upsampling

### Task 3.1: Keyword Hint Boost Ayarı

**Files:**
- Modify: `backend/src/modules/ml/ml.service.ts` — `categorize()` (L960-L1040)

#### Step 1: Siyaset keyword hints listesini genişlet

- [ ] `categorize()` içinde keyword hints tanımlandığı yeri bul (şu anda ~L995):

Mevcut (approx):
```typescript
const siyasetHints = {
    'meclis': 0.06,
    'bakan': 0.06,
    'cumhurbaskan': 0.06,
    'parti': 0.06,
    'seçim': 0.06,
    // ... 8 adet toplam
};
```

Yeni (15+):
```typescript
const siyasetHints = {
    'meclis': 0.08,         // Boost cap artacağı için
    'bakan': 0.08,
    'cumhurbaskani': 0.08,
    'parti': 0.08,
    'secim': 0.08,
    'milletvekili': 0.08,
    'kanun': 0.08,
    'yasa tasarisi': 0.08,
    'muhalefet': 0.08,
    'iktidar': 0.08,
    'oy': 0.08,
    'anayasa': 0.08,
    'hukumet': 0.08,
    'siyasi': 0.08,
    'kabine': 0.08,
};
```

#### Step 2: Per-category boost cap'ini Siyaset için artır

- [ ] Keyword hints uygulandığı satırı bul (L ~1001-L ~1010). Şu anda tüm kategoriler aynı cap'e sahip (~+0.18):

```typescript
// MEVCUT (tüm kategoriler eşit):
Object.entries(keywordBoosts).forEach(([category, hints]) => {
    // ...
    scores[category] = Math.min(scores[category] + boost, currentScore + 0.18);  // cap +0.18
});

// YENİ (Siyaset için +0.24):
Object.entries(keywordBoosts).forEach(([category, hints]) => {
    const boostCap = category === 'Siyaset' ? 0.24 : 0.18;  // Siyaset gets higher cap
    scores[category] = Math.min(scores[category] + boost, currentScore + boostCap);
});
```

#### Step 3: Benchmark çalıştır — Recall ve F1 artışını doğrula

- [ ] Terminal:
```bash
docker compose exec -e FORCE_DISK_FALLBACK=0 -e ML_DISK_SUPPLEMENT_LIMIT=0 -T backend sh -c "cd /app; npx ts-node scripts/benchmark-faz5a.ts --disk-supplement=0 --mode=unigram-bigram --manual-only"
```

- [ ] **Expected:**
  - `[ML][Diagnostics][Siyaset] P=? R=? F1=?` — **R artmış, F1 > 0.62** (hedef)
  - `[ML][Diagnostics][Genel] F1=?` — **max -3pt düşmüş** (acceptance threshold)

#### Step 4: Commit

- [ ] Stage:
```bash
git add backend/src/modules/ml/ml.service.ts
git commit -m "feat(ml): boost Siyaset keyword hints in categorize()"
```

---

### Task 4.1: Per-Category Upsampling Bonus

**Files:**
- Modify: `backend/src/modules/ml/ml.service.ts` — upsampling bölümü (L819-L874)

#### Step 1: Küçük kategorileri belirle ve upsampling bonusu ekle

- [ ] `loadAndTrainFromDB()` içinde upsampling bölümünü bul (~L850-L875):

Mevcut (tüm kategoriler eşit multiplier):
```typescript
const upsampleMultiplier = options.upsampleMultiplier ?? 3;
const manualUpsampleMultiplier = options.manualUpsampleMultiplier ?? 5;

catTrain.forEach((sample) => {
    const repeat = sample.isManualValidated ? manualUpsampleMultiplier : upsampleMultiplier;
    for (let r = 0; r < repeat; r++) {
        weightedTrain.push({...sample});
    }
});
```

Yeni (per-category bonus):
```typescript
const upsampleMultiplier = options.upsampleMultiplier ?? 3;
const manualUpsampleMultiplier = options.manualUpsampleMultiplier ?? 5;

// Dinamik medyan hesapla
const categorySizes = Object.values(verifiedByCategory);
const median = categorySizes.length > 0 
    ? categorySizes.sort((a, b) => a - b)[Math.floor(categorySizes.length / 2)]
    : 100;
const smallCategoryThreshold = median * 0.6;
const SMALL_CATEGORIES_BONUS = 2; // +2x ek multiplier

catTrain.forEach((sample) => {
    let repeat = sample.isManualValidated ? manualUpsampleMultiplier : upsampleMultiplier;
    
    // Bonus for small categories
    if (verifiedByCategory[sample.category] < smallCategoryThreshold) {
        repeat += SMALL_CATEGORIES_BONUS;
    }
    
    for (let r = 0; r < repeat; r++) {
        weightedTrain.push({...sample});
    }
});
```

#### Step 2: Benchmark çalıştır — Final tüm fazların birleşik etkisi

- [ ] Terminal (full non-persist benchmark):
```bash
docker compose exec -e FORCE_DISK_FALLBACK=0 -e ML_DISK_SUPPLEMENT_LIMIT=0 -T backend sh -c "cd /app; npx ts-node scripts/benchmark-faz5a.ts --disk-supplement=0 --mode=unigram-bigram"
```

- [ ] **Final Target Kontrol:**
  - `[ML][Diagnostics][Siyaset] F1=?` — **≥ 0.65** ✓
  - `[ML][Diagnostics] Accuracy=%?` — **≥ 72%** ✓
  - `[ML][Diagnostics] Macro-F1=?` — **≥ 0.72** ✓
  - Tüm kategorilerin F1 artması beklenir

#### Step 3: Commit

- [ ] Stage:
```bash
git add backend/src/modules/ml/ml.service.ts
git commit -m "feat(ml): per-category upsampling bonus for small categories"
```

---

## Validation Checklist

| # | Kontrol | Komut/Lokasyon | Beklenen | Status |
|---|---------|--------|----------|--------|
| V0 | Faz 0 logları | Benchmark → [SiyasetLeakage] | Görülüyor | [ ] |
| V1 | Test support yeterli | Benchmark → Support | ≥ 20 | [ ] |
| V2 | Siyaset F1 | Benchmark → Siyaset F1 | > 0.65 | [ ] |
| V3 | Genel accuracy | Benchmark → Accuracy | ≥ 72% | [ ] |
| V4 | Macro-F1 | Benchmark → Macro-F1 | ≥ 0.72 | [ ] |
| V5 | Hard negative pool | Benchmark → [HardNegative] | Sizes > 3 | [ ] |
| V6 | Guard2 geçiyor | Benchmark → [Guard2] | No HARD STOP | [ ] |
| V7 | Guard4 kalibrasyon | Benchmark → [Guard4] | BAŞARILI | [ ] |

---

## Dependencies & Ordering

```
┌─ Faz 0: Enhanced Logging (ön koşul — veri güdümlü karar)
│   └─ Faz 1: Data Volume (Manuel veri Audit + Doğrulama)
│      └─ Faz 2: Hard Negatives (Faz 0 loglarına göre ayarlanır)
│         └─ Faz 3: Keyword Boost (Faz 2'den bağımsız, paralel olabilir)
│            └─ Faz 4: Upsampling (Faz 1 sonrası, optimal Faz 3'den önce)
```

**Sequential:** Faz 0 → Faz 1 → Faz 2 → Faz 3 (ve Faz 4 paralel)

**Why:** 
- Faz 0 bilgisiz karar almamıza engel olur
- Faz 1 veri hacmi arttırmazsa metrikler güvenilmez
- Faz 2 injection miktarları Faz 0 loglarına bağlı (veri güdümlü)
- Faz 3 Faz 2'den bağımsız (paralel yapılabilir ama sonra)
- Faz 4 Faz 1'in artmış veri hacmine dayanır

---

## Summary

**Bu plan aşağıdakileri çözer:**

1. ✅ Siyaset→Genel kaçışını net ve yüzdesel olarak görüyoruz (Faz 0)
2. ✅ Test set boyutu 15 → 20+ olacak (Faz 1, veri artışı)
3. ✅ Hard negative pool boş değil çünkü `genelSignals` 20+ terimi (Faz 2)
4. ✅ Injection miktarları kaçış verilerine göre ayarlanıyor (Faz 2)
5. ✅ Siyaset keyword bonus Bayesian prior'ı dengeliyor (Faz 3)
6. ✅ Küçük kategoriler ekstra upsampling alıyor (Faz 4)

**Beklenen sonuç:** Siyaset F1 ≥ 0.65, Genel Accuracy ≥ 72%, Macro-F1 ≥ 0.72

---

**Next Step:** Plan review loop başlatılmalı (spec-document-reviewer subagent dispatch).
