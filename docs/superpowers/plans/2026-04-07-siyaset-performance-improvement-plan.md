# Siyaset Kategorisi ML Performans Iyilestirmesi - Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Siyaset F1 skorunu 0.552'den 0.65+ seviyesine cikarmak; genel accuracy >=72% korumak.

**Architecture:** Manual Validation Consistency Gate (MV-CG) -> enhanced confusion matrix logging -> veri kalite auditi -> hard negative mantik duzeltmesi -> kosullu keyword boost -> upsampling ince ayar.

**Tech Stack:** TypeScript, natural.BayesClassifier, Prisma, PostgreSQL, Docker

**Agency-rules Check:**
- Section 2 (Dataset & ML Training): `dataset-quality-guard` skill MUST be invoked before Faz 1 data changes
- No llm.service.ts changes -> Section 1 not needed
- No RSS changes -> RSS health monitor not needed

---

## Chunk 0: Manual Validation Consistency Gate (MV-CG)

> **ZORUNLU ON KOSUL:** Bu gate Faz 0'dan once calistirilmalidir. Gate gecilmeden hicbir veri degisikligi yapilmaz.

### Task 0.0: Etiketleme Surec Tutarliligini Olc

**Files:**
- Query: `manuel_validasyonlar`, `haberler`, `kategoriler`
- Public inference endpoint: `/api/ml/categorize`

#### Step 1: Son 30 manuel validasyonu cek (haber basina son karar)

- [ ] PostgreSQL'de su sorguyu calistir:

```sql
WITH latest_per_news AS (
  SELECT DISTINCT ON (mv.haber_id)
    mv.haber_id,
    mv.yeni_kategori_id,
    mv.olusturulma_tarihi
  FROM manuel_validasyonlar mv
  ORDER BY mv.haber_id, mv.olusturulma_tarihi DESC
)
SELECT
  l.haber_id,
  l.olusturulma_tarihi,
  k.ad AS manual_label,
  h.baslik,
  SUBSTRING(h.icerik, 1, 300) AS preview
FROM latest_per_news l
JOIN haberler h ON h.id = l.haber_id
JOIN kategoriler k ON k.id = l.yeni_kategori_id
ORDER BY l.olusturulma_tarihi DESC
LIMIT 30;
```

#### Step 2: Her ornek icin model tahmini al

> **Onkosul:** Invoke `.agent/workflows/health-check.md` — backend servisi ayakta mi dogrula (`/api/ml/status` veya `/api/ml/categorize`) endpoint'e istek atmadan once.

- [ ] `manual-validate.ts --predict-only` bayragi su an yok; endpoint ile tahmin al:

```bash
curl -X POST http://localhost:3000/api/ml/categorize \
  -H "Content-Type: application/json" \
  -d '{"title":"<BASLIK>","contextText":"<PREVIEW_OR_CONTENT>"}'
```

- [ ] Her ornek icin su tabloyu doldur:

```text
haber_id | manual_label | model_prediction | match(Y/N) | error_direction
```

#### Step 3: Hata yonunu analiz et (kritik)

- [ ] Yanlis tahmin edilen orneklerde dagilimi cikar:
  - Tek yon hata (cogu ayni kategoriye, or. Genel): model sorunu olasi
  - Cok yon hata (birden cok kategoriye dagilmis): etiket/surec tutarsizligi olasi

#### Step 4: RMER + hata yonu ile gate karari ver

- [ ] RMER hesapla:

```text
RMER = yanlis_tahmin_sayisi / 30
```

- [ ] Karar tablosu:

| RMER | Hata Yonu | Karar |
|---|---|---|
| < 0.20 | - | PASS: Faz 0'a gec |
| 0.20-0.30 | Tek yon (hep Genel) | CAUTION: Model sorunu olasi -> Faz 0'a gec, cift validasyon uygula |
| 0.20-0.30 | Cok yon (dagilmis) | HOLD: Etiket sorunu olasi -> Label policy kalibrasyonu yap |
| >= 0.30 | Herhangi | HOLD: Faz 1 durdur -> Once etiket standardini sabitle |

#### Step 5: Etiket sorunu tespit edilirse Label Policy yaz

> **HOLD durumunda:** Invoke `.agent/skills/systematic-debugging` — RMER >= 0.30 veya cok yonlu hata tespit edildiginde, duzeltme onerileri surmeden once kok neden analizi yap. Symptom fix yapma.

- [ ] Faz 1'e gecmeden once su kararlar netlestirilmeli:
  - "Vali aciklamasi" -> Siyaset mi, Genel mi?
  - "Bakan katildi" (belediye etkinligi) -> Siyaset mi, Genel mi?
  - "Meclis sorusu" (yerel konuda) -> Siyaset mi, Genel mi?

#### Step 6: Commit

- [ ]
```bash
git add -A
git commit -m "chore(ml): add MV-CG gate findings (RMER + error-direction analysis)"
```

---

## Chunk 1: Faz 0 - Enhanced Confusion Matrix Logging

### Task 0.1: Siyaset-odakli kacis raporu

**Files:**
- Modify: `backend/src/modules/ml/ml.service.ts` -> `logDiagnostics()`

- [ ] `SiyasetLeakage`, `TowardsSiyaset`, `NetConfusion` loglarini ekle.
- [ ] Benchmark calistir:

```bash
docker compose exec -e FORCE_DISK_FALLBACK=0 -e ML_DISK_SUPPLEMENT_LIMIT=0 -T backend sh -c "cd /app; npx ts-node scripts/benchmark-faz5a.ts --disk-supplement=0 --mode=unigram-bigram --manual-only"
```

- [ ] Commit:

```bash
git add backend/src/modules/ml/ml.service.ts
git commit -m "feat(ml): enhance confusion matrix logging with Siyaset-specific leak analysis"
```

> **Chunk 1 tamamlanmadan once:** Invoke `.agent/skills/verification-before-completion` — benchmark ciktisinda `[SiyasetLeakage]`, `[TowardsSiyaset]`, `[NetConfusion]` satirlarinin gercekten gozuktugunu teyit et. Goruntulenmiyorsa commit yapma.

---

## Chunk 1.5: Faz 0.5 - Label Consistency Audit (Apr 4 backfill)

- [ ] Apr 4 civari dusuk-confidence Siyaset kayitlarini cek ve manuel kontrol et.
- [ ] Supheli kayitlarda `kategori_dogrulandi=false` veya dogru kategoriye duzeltme uygula.
- [ ] Correct oranina gore PASS/HOLD karari ver.

---

## Chunk 2: Faz 1 - Veri kalite ve hacim

> **CRITICAL:** Before proceeding, invoke `dataset-quality-guard` skill.

- [ ] Siyaset confidence dagilimini olc.
- [ ] DB backup al.

> **DB degisikligi oncesi:** Invoke `.agent/workflows/rollback.md` — backup komutunu calistirmadan once rollback prosedurunu oku. Veri degisikligi sonrasi model istikrarsizlasirsa bu workflow ile geri don.
- [ ] `manual-validate.ts` ile manuel dogrulama yap.
- [ ] Dagilim ve benchmark ile etkisini dogrula.

---

## Chunk 3: Faz 2 - Hard negative duzeltmeleri

> **Kod degisikligi oncesi:** Invoke `.agent/skills/test-driven-development` — ml.service.ts'i degistirmeden once benchmark scriptini "Siyaset F1 >= 0.60 olmali" assertion'i ile calistir ve su an failed oldugunu dogrula. Sonra kodu yaz.

- [ ] `genelSignals` listesini genislet.
- [ ] `genelPool` filtresini yumusat (`genelHit === 0` -> `genelHit < 2`).
- [ ] `dunyaSignals` icinde dogru ifade kullan: `birlesmis milletler`.
- [ ] `siyasetToDunya = injectFromPool(siyasetDunyaPool, X)` ve `siyasetToEkonomi = injectFromPool(siyasetEkonomiPool, Y)` satirlarini acik ve ayni blokta tanimla.

---

## Chunk 3.5: Faz 2.5 - Decision Gate

- [ ] Faz 2 benchmark sonrasi Siyaset F1'i olc.

> **Tamamlanmadan once:** Invoke `.agent/skills/verification-before-completion` — F1 degerini fresh benchmark ile dogrula, log ciktisini oku, sonra asagidaki karari ver.

- [ ] F1 >= 0.62 ise Faz 3 SKIP.
- [ ] 0.58-0.62 arasi ise Faz 3 kosullu (conservative).
- [ ] F1 < 0.58 ise HOLD.

> **HOLD durumunda:** Invoke `.agent/skills/systematic-debugging` — F1 < 0.58 ise Faz 0-2'nin hangi adiminda beklenen etkiyi saglamadigi sistematik olarak bulunmali. Duzeltme olmadan Faz 3'e atlanmaz.

---

## Chunk 4: Faz 3 (Conditional) + Faz 4

### Task 3.1: Keyword boost (yalnizca gerekirse)

- [ ] Siyaset boost cap: +0.20 (asla +0.24 degil).
- [ ] Genel F1 dusus guard: -2.5pt.

### Task 4.1: Upsampling safe median

- [ ] In-place sort yerine kopya sort kullan:

```typescript
const categorySizes = Object.values(verifiedByCategory);
const sortedSizes = [...categorySizes].sort((a, b) => a - b);
```

---

## Validation Checklist

| # | Kontrol | Beklenen |
|---|---|---|
| V-0 | MV-CG gate sonucu | PASS/HOLD karari net |
| V0 | Faz 0 loglari | SiyasetLeakage, TowardsSiyaset, NetConfusion |
| V1 | Test support | >= 20 |
| V2 | Siyaset F1 | > 0.65 |
| V3 | Accuracy | >= 72% |
| V4 | Macro-F1 | >= 0.72 |

---

## Chunk 5: Branch Kapanisi

> **Invoke:** `.agent/skills/finishing-a-development-branch` — V-0'dan V4'e kadar tum kontroller gectiginde bu skill'i calistir.

- [ ] Tum validation checklist satirlarini gozden gecir (V-0 PASS, V0-V4 beklenen degerlerde).
- [ ] `git log --oneline -10` ile commit gecmisini dogrula.
- [ ] Branch merge veya PR sececegini belirle.
- [ ] Temizlik: gecici benchmark loglarini ve backuplari arsivle.

---

## Dependencies & Ordering

```text
Chunk 0 (MV-CG) -> Chunk 1 (Faz 0) -> Chunk 1.5 (Faz 0.5) -> Chunk 2 (Faz 1) -> Chunk 3 (Faz 2) -> Chunk 3.5 (Decision Gate) -> Chunk 4 (Conditional Faz 3 + Faz 4)
```

**Beklenen sonuc:** Siyaset F1 >= 0.65, Genel Accuracy >= 72%, Macro-F1 >= 0.72
