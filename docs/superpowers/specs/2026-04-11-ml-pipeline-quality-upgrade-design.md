# ML Pipeline Kalitesi Yükseltme - Tasarım Spesifikasyonu

**Tarih:** 2026-04-11  
**Durum:** APPROVED  
**Hedef:** Üretim ML modeli doğruluğunu 58% → 71.56% ± 2.21% yükseltme  
**Strateji:** Manual-only eğitim + kontrollü spot-check büyütmesi

---

## Özet (Executive Summary)

Üretim ML modelinin admin panelde **58% doğruluk** göstermesinin kök sebebi **veri kalitesi** sorununun kaynaklandığı tespit edilmiştir. Model şu anda 1006 karışık kaliteli kayıt (AI-predicted, confidence<0.70, yanlış etiketlemeler) ile eğitilmektedir. Benchmark testleri 794 **manuel doğrulanmış** kaydla **71.56% ± 2.21%** doğruluk elde etmiştir.

**Bu tasarım, üretim auto-training pipeline'ını manuel-only veri seti ile eğitmeye ve kontrollü olarak 955 güven tabanlı kaydı eklemek için spot-check kapısı kurmaya odaklanır.**

---

## Bölüm 1: Manual-Only Üretim Eğitimi

### 1.1 Problem Tanımı

**Mevcut Durum:**
- Üretim modeli otomatik eğitimi her 20 yeni doğrulanmış haber tetiklendiğinde `loadAndTrainFromDB()` çağrıyor (varsayılan: `manualOnlyVerified=false`)
- Veri seti = 1006 kayıt (manuel + AI-predicted + düşük güven + karışık kalite)
- Sonuç: **58% test-set doğruluk**

**Benchmark Sonuç (Parallel Universe):**
- Manuel-only veri = 794 kayıt (100% insan doğrulanmış)
- Stratified-temporal split: MIN_TEST_SUPPORT=10, MIN_TRAIN_RATIO=0.60
- Sonuç: **71.56% ± 2.21% test-set doğruluk** (10 run benchmark)
- **Fark:** +13.56 pp (percentage point)

**Root Cause:** Veri kalitesi, veri miktarı değil

### 1.2 Çözüm Mimarisi

**Amaç:**
```
Aşama 1 (Hızlı):   Auto-training parametresini manuel-only'ye switç et
                    ↓
                   Model retrain → 71% beklenir
                    ↓
                   Panel ML Doğruluk kartı otomatik güncellenir

Aşama 2 (Kontrollü): 955 güven kaydını insan doğrulaması ile veri setine ekle
                    ↓
                   Kademeli büyütme (20 news threshold × N batchler)
                    ↓
                   71% doğruluğu maintain için spot-check kapısı
```

### 1.3 Kod Değişiklikleri

#### Change 1: Auto-Training Tetikleyici (ml.service.ts, L240)

**Dosya:** `backend/src/modules/ml/ml.service.ts`  
**Satır:** ~240 (initializeTrainingPipeline() metodu)

**Eski:**
```typescript
private async initializeTrainingPipeline(): Promise<void> {
  // ... setup code ...
  
  this.on('batch:trained', async () => {
    const newValidatedCount = await this.getValidatedNewsCount();
    if (newValidatedCount >= BATCH_TRAIN_THRESHOLD) {
      this.logger.log(`Training triggered: ${newValidatedCount} new validated news`);
      await this.loadAndTrainFromDB();  // DEFAULT: manualOnlyVerified=false
      await this.resetValidatedNewsCount();
    }
  });
}
```

**Yeni:**
```typescript
private async initializeTrainingPipeline(): Promise<void> {
  // ... setup code ...
  
  this.on('batch:trained', async () => {
    const newValidatedCount = await this.getValidatedNewsCount();
    if (newValidatedCount >= BATCH_TRAIN_THRESHOLD) {
      this.logger.log(`Training triggered: ${newValidatedCount} new validated news`);
      await this.loadAndTrainFromDB({ manualOnlyVerified: true });  // CHANGE: manual-only
      await this.resetValidatedNewsCount();
    }
  });
}
```

**Neden:** Her 20 yeni doğrulanmış haber sonrasında auto-trigger, temiz veri ile eğit.

---

#### Change 2: Startup IIFE & /train Endpoint (ml.controller.ts, L8-25 & L32-42)

**Dosya:** `backend/src/modules/ml/ml.controller.ts`

**Bölüm A: Startup IIFE (L8-25)**

Eski:
```typescript
// Startup initialization - IIFE
(async () => {
  try {
    this.logger.log('ML Service initializing...');
    const hasDbModels = await mlService.hasDbModels();
    
    if (hasDbModels) {
      this.logger.log('Loading model from DB...');
      await mlService.loadAndTrainFromDB();  // DEFAULT: manualOnlyVerified=false
    } else {
      this.logger.log('No DB models, using fallback dataset.json');
      await mlService.loadModelFromFile('dataset.json');
    }
  } catch (error) {
    this.logger.error('ML Service initialization error', error);
  }
})();
```

Yeni:
```typescript
// Startup initialization - IIFE
(async () => {
  try {
    this.logger.log('ML Service initializing...');
    const hasDbModels = await mlService.hasDbModels();
    
    if (hasDbModels) {
      this.logger.log('Loading model from DB with manual-only data...');
      await mlService.loadAndTrainFromDB({ manualOnlyVerified: true });  // CHANGE: manual-only
    } else {
      this.logger.log('No DB models, using fallback dataset.json');
      await mlService.loadModelFromFile('dataset.json');
    }
  } catch (error) {
    this.logger.error('ML Service initialization error', error);
  }
})();
```

**Bölüm B: /train Endpoint (L32-42)**

Eski:
```typescript
@Post('train')
async train(@Query('useDb') useDb?: string): Promise<{ message: string; accuracy?: number }> {
  try {
    if (useDb === 'true') {
      await this.mlService.loadAndTrainFromDB();  // DEFAULT: manualOnlyVerified=false
      return { message: 'Training from DB completed', accuracy: this.mlService.getAccuracy().accuracy };
    } else {
      await this.mlService.loadModelFromFile('dataset.json');
      return { message: 'Training from file completed', accuracy: this.mlService.getAccuracy().accuracy };
    }
  } catch (error) {
    throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
  }
}
```

Yeni:
```typescript
@Post('train')
async train(@Query('useDb') useDb?: string): Promise<{ message: string; accuracy?: number }> {
  try {
    if (useDb === 'true') {
      await this.mlService.loadAndTrainFromDB({ manualOnlyVerified: true });  // CHANGE: manual-only
      return { message: 'Training from DB completed', accuracy: this.mlService.getAccuracy().accuracy };
    } else {
      await this.mlService.loadModelFromFile('dataset.json');
      return { message: 'Training from file completed', accuracy: this.mlService.getAccuracy().accuracy };
    }
  } catch (error) {
    throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
  }
}
```

**Neden:** Manual trigger ve fallback paths de manual-only ile tutarlı olmalı.

---

#### Change 3: Panel Metriği Doğrulama (admin.controller.ts, L121)

**Dosya:** `backend/src/modules/admin/admin.controller.ts`  
**Satır:** ~121

**Kontrol (değişim YOK, doğru mu diye kontrol et):**
```typescript
@Get('stats')
async getStats(): Promise<AdminStatsDto> {
  const mlPerformance = this.mlService.getAccuracy();
  return {
    mlAccuracy: (mlPerformance.accuracy * 100).toFixed(1),  // ← Panel displays this
    trainSize: mlPerformance.trainSize,
    testSize: mlPerformance.testSize,
    // ... other stats
  };
}
```

**Status:** ✅ Doğru kalıyor. Panel zaten `mlPerformance.accuracy` (lastAccuracy) gösteriyor. Model retrain sonrası otomatik 71%'ye yükselir.

---

### 1.4 Doğrulama Kontrol Listesi (Aşama 1)

**Sonrası hedefler:**
- ✅ `npm run build` → 0 TS compile errors
- ✅ Parameter değişimi git diff'de görünüyor (L240, L8-25, L32-42)
- ✅ `npm test` passes (if ml.service tests exist)
- ✅ Model retrained: `POST /api/ml/train?useDb=true` returns accuracy ~71.0% ± 2%
- ✅ Admin panel API: `GET /api/stats` → `mlAccuracy: "71.0"` (±2% tolerance)
- ✅ Guard1 pass: no accuracy drop >5pp
- ✅ Guard4 pass: no calibration confidence error
- ✅ Health-check: `curl http://localhost:3000/api/ml/Health` → 200 OK

---

## Bölüm 2: Spot-Check Kapısı Workflow (Kontrollü Veri Büyütme)

### 2.1 Problem: 955 Güven Kaydı Dilemmasi

**Soru:** "955 kayıt varsa neden tümünü hemen veri setine eklemiyoruz?"

**Cevaplar:**
1. **Kalite Riski:** 955 kaydın tamamı insan doğrulanmamış; confidence-based extraction, hale yanlış etiket var olabilir
2. **Data Drift:** Ani 955 kayıt eklemesi model performansını düşürebilir (Guard1 tetiklenebilir)
3. **Best Practice:** Kontrollü büyütme + human-in-the-loop gate

### 2.2 Spot-Check Kapısı Tasarımı

**Hedef:** 955 kayıdı kademeli olarak veri setine ekle; her batch'de human review gate

**Workflow:**

```
[955 Güven Kaydı]
        ↓
    [GATE 1: Pre-Check]
    - Class imbalance ≤ 2.5x? (50% hard stop)
    - Noise detection: mislabel pattern?
    - QA 3-sample review: 3/3 pass?
    ↓ IF FAIL → STOP (systematic-debugging Phase 1)
    ↓ IF PASS → GO
        ↓
    [Spot-Check Batch Execution]
    → Script: backend/scripts/spot-check-validation.ts
    → Export: 10-kayıtlık batchler
    → QA workflow:
      ├─ Review 3 random sample (1/10)
      ├─ If 3/3 pass → batch ACCEPTED → INSERT manuel_validasyonlar
      └─ If 1+ fail → batch REJECTED → investigate reason → adjust sampling
        ↓
    [Auto-Training Trigger] (every 20 news)
    → Model retrained with updated manual-only dataset
    → Accuracy monitored: maintain ≥70% (Guard4 threshold)
        ↓
    [Kademeli Büyütme]
    → 955 kayıt → X batch (X_pass / X_total ≥ 80% beklenir)
    → Manuel-only: 794 → 794 + (X_pass × 10) records
    → Repeat until all 955 processed or accuracy drops >5pp
```

### 2.3 Spot-Check Script Entegrasyon

**Existing Script:** `backend/scripts/spot-check-validation.ts` (Batch-21 Task 3)

**Kullanım:**
```bash
cd backend
npx ts-node scripts/spot-check-validation.ts \
  --confidence-min=0.70 \
  --batch-size=10 \
  --output-dir=./spot-check-batches \
  --export-format=json
```

**Çıktı:** 10-kayıtlık JSON batchler:
```json
{
  "batchId": "batch-001",
  "createdAt": "2026-04-11T10:00:00Z",
  "records": [
    {
      "id": 12345,
      "title": "...",
      "category": "Siyaset",
      "confidence": 0.85,
      "predictedLabel": "POSITIVE",
      "samples": [
        { "index": 0, "text": "..." },
        { "index": 5, "text": "..." },
        { "index": 9, "text": "..." }
      ]
    },
    ...
  ],
  "qa_required": true
}
```

**QA Decision:**
- **PASS:** All 10 approve OR 3-sample 3/3 pass
- **FAIL:** Any sample 1+ fail
- **Outcome:** If PASS → execute:
  ```sql
  INSERT INTO manuel_validasyonlar (news_id, true_label, validated_by, validated_at, ...)
  SELECT id, qa_decision->true_label, 'qa-system', NOW(), ...
  FROM temp_batch_001
  WHERE batch_id = 'batch-001' AND qa_decision = 'PASS';
  ```

### 2.4 Doğrulama Kontrol Listesi (Aşama 2)

**Görev 4 Sonrası (Pre-Check):**
- ✅ Class imbalance kontrol: max ratio ≤ 2.5x
- ✅ Noise detection: mislabel count ≤ threshold
- ✅ Split consistency check passed
- ✅ QA 3-sample review: 3/3 pass → GO
- ❌ Any fail → STOP (systematic-debugging)

**Görev 5 Sonrası (Batch Execution):**
- ✅ Toplam batch işlendi: X batch
- ✅ Pass rate: (X_pass / X_total) ≥ 80%
- ✅ Manuel-only dataset büyüdü: 794 → 794 + newRecords
- ✅ Auto-trigger retrains: every 20 news, accuracy ≥70% maintained
- ❌ Pass rate <80% OR accuracy ↓ >5pp → PAUSE (systematic-debugging)

---

## Bölüm 3: Thesis Alignment (Tez Hizalaması)

### 3.1 Kategori Stratifikasyonu

**Mevcut Batch-21c Iyileştirmesi:**
- Stratified-temporal split (per-category)
- MIN_TEST_SUPPORT=10: her kategori en az 10 test örneği
- MIN_TRAIN_RATIO=0.60: train set ≥60% (overfitting risk minimize)

**Manuel-Only + Spot-Check:**
- Spot-check batch'leri category-aware sampling ile filter et
- Siyaset kategorisi özel dikkat (tarihsel imbalance)
- Stratifikasyon maintained: batch sonrası da per-category split uygulan

### 3.2 F1 Stability (Batch-21c Sonuçları)

**Benchmark (10x run):**
```
Category        F1-Mean     F1-Std Dev    Support
─────────────────────────────────────────────
Siyaset         0.714       0.039         ✅ <0.05 (gate pass)
Spor            0.695       0.031         ✅ <0.05
Dünya           0.718       0.027         ✅ <0.05
Teknoloji       0.708       0.032         ✅ <0.05
Yaşam           0.721       0.028         ✅ <0.05
─────────────────────────────────────────────
OVERALL         0.7156      0.0221        ✅ STABLE
```

**Manual-Only + Spot-Check (Beklenti):**
- F1-std dev ≤ 0.05 maintain (kontrol edilen büyütme ile)
- 955 batch end sonrası re-benchmark: σ ≤ 0.06 tolerance

---

## Bölüm 4: Future Work — Out-of-Scope

### 4.1 Transformer Models (BERTurk)

**Neden Sonrası?**
- Current manual-only baseline: 71.56% stabil, Guard pass
- Transformer integration: 2-3 hafta araştırma + NAPI Canvas vs Huggingface perf test
- Priority: Aşama 1-2 completion + baseline monitoring (Batch-22+)

**Roadmap:**
```
2026-04-11: Manual-only + spot-check (THIS PLAN)
         ↓
2026-04-25: Spot-check completion + documentation
         ↓
2026-05-02: Transformer research spike (Batch-22)
         ↓
2026-05-15: BERTurk pilot + benchmark
         ↓
2026-06-01: Category-specific fine-tuning (Batch-23)
```

### 4.2 Other Exclusions

- **Real-Time Model Update:** Inference-time hızlı retraining (Batch-23+ infrastructure needed)
- **Category-Specific Tuning:** F1-weight optimization per category (Batch-22 task)

---

## Özet Tablo: Bölüm Justifications

| Bölüm | Amaç | Metrik | Gate |
|:---|:---|:---:|:---|
| **1** | Manual-only production switch | Accuracy 71% ± 2% | Guard1/4 pass, panel ~71% |
| **2** | Kontrollü veri büyütme | 80%+ batch pass rate | Pre-check pass + accuracy ≥70% |
| **3** | Tez continuity | F1-std dev ≤0.05 | Benchmark 10x run ok |
| **4** | Future scope sınır | Out-of-scope clear | Roadmap defined |

---

## Kararlar & Riskler

### Alınan Kararlar
- ✅ **Manual-only yolu:** 71.56% benchmark, stabil (σ=2.21)
- ✅ **Spot-check kapısı:** Kontrollü büyütme, 80%+ pass target
- ✅ **Panel display:** Değişim YOK (metric zaten doğru)
- ✅ **Future work:** Transformer out-of-scope, Batch-22+ roadmap

### Kalkulasyonlar & Riskler

| Risk | Probability | Impact | Mitigation |
|:---|:---:|:---:|:---|
| Guard1 tetiklendi (acc↓>5pp) | ~5% | HIGH | Rollback + Phase 1 root cause |
| Batch pass <80% | ~10% | MEDIUM | systematic-debugging + adjust |
| Siyaset imbalance >2.5x | ~15% | MEDIUM | Pre-check FAIL, category-aware resample |
| Infrastructure fail (DB/API) | ~2% | MEDIUM | Health-check restart + retry |

---

## Status & Next Steps

**Status:** ✅ DESIGN APPROVED

**Next Steps:**
1. → **Implementation Plan** (`2026-04-11-ml-pipeline-quality-upgrade-plan.md`)
2. → 6 görev detaylı adım-adım, doğrulama komutları, timing
3. → Execution scheduled

