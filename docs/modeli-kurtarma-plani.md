# Model Kurtarma Planı
**Tarih:** 2026-04-04  
**Durum:** Onaylandı ve Hazır Uygulanacak

---

## Sorun Özeti

- **Mevcut Model Accuracy:** v46 = 21.30% (kritik başarısızlık)
- **Sebep:** LR convergence problemi (1150 örnek × 500×rows iterasyon = saatler)
- **Root Cause Analizi:** 
  - Test seti %68 Siyaset domine (365 verified Siyaset vs 160 diğer kategori)
  - LR premature convergence (apparatus maxIt çok yüksek)
  - Supplement'in NB yerine LR ile uyumsuzluğu

---

## Hedefler

| # | Hedef | Başarı Kriteri |
|---|-------|-----------------|
| 1 | Dengelenmiş test seti | Siyaset ≤ %30 test set'te |
| 2 | Kaliteli veri tabanı | Sentetik/augmented kaydı minimize |
| 3 | Basit, stabil sınıflandırıcı | NB (iterasyon yok, deterministic) |
| 4 | Accuracy recovery | v46 (68.22%) veya üstü |
| 5 | Per-kategori F1 | Siyaset min 0.636, diğer >0.85 |

---

## Uygulama Planı

### Faz 1: Kod Değişiklikleri (3 bileşen, paralel yapılabilir)

**Workflow:** executing-plans (paralel adım yönetimi + dependency tracking)

#### 1.1 apparatus LogisticRegression maxIt'i Orijinal Değere Geri Al
```
Dosya: /app/node_modules/apparatus/lib/apparatus/classifier/logistic_regression_classifier.js
Değişiklik: maxIt = 50 * Examples.rows() → 500 * Examples.rows()
Neden: Container reboot'ta resetlenir; temiz kalması iyi. NB'yi etkilemez.
```

#### 1.2 Classifier'ı NB'ye Geçir (ml.service.ts)
```
Dosya: backend/src/modules/ml/ml.service.ts
Satır: ~58 (constructor default)
Değişiklik: classifierType: ClassifierType = 'logistic-regression' 
            → classifierType: ClassifierType = 'naive-bayes'
Neden: NB iterasyon kullanmaz, O(n×f) karmaşıklık, 30sn'de biter
Referans: v29 (NB + dataset.json) %88.64 accuracy elde etmişti
```

#### 1.3 Classifier Instantiation'ını NB'ye Geçir (ml.controller.ts)
```
Dosya: backend/src/modules/ml/ml.controller.ts
Değişiklik: new MlCategorizationService('logistic-regression', ...)
            → new MlCategorizationService('naive-bayes', ...)
Neden: Explicit override, mlService instantiation'ını NB ile başlat
```

---

### Faz 2: Veri Balanslaması — Siyaset Kırpması

**Workflows:** dataset-quality-guard (kırpma kuralları) + rollback.md (backup/restore)

#### 2.1 Siyaset Verified Kırpma Stratejisi
**Amaç:** 365 Siyaset verified → ~100 (3.6x azalış)  
**Kırpma Sırası (zorunlu) — dataset-quality-guard kuralları:**
1. **Guard 1 — Önce:** `augmented_at IS NOT NULL` olanlar (sentetik/backfill, sorunlu)
2. **Guard 2 — Sonra:** `ml_confidence < 0.80` olanlar (düşük güven, belirsiz)
3. **Guard 3 — Asla:** `augmented_at IS NULL + ml_confidence ≥ 0.80` olanlar (organik, güvenilir)
4. **Guard 4 — Doğrulama:** Kırpma sonrası Siyaset min 100+ record kalıp kalmadığını kontrol

**Beklenen Sonuç:**
- 265 kod kırpılacak, çoğunluğu augmented/sorunlu
- Veri kalitesi iyileşir
- Test seti dengelenir (Siyaset %68 → ~%20)

#### 2.2 Backup Tablosu — rollback.md Workflow
```
Aşamalar:
1. Pre-action: rollback_siyaset_trim_20260404 snapshot oluştur
2. Verify: Backup integrity kontrol (satır sayısı?)
3. Execute: Kırpma işlemini gerçekleştir
4. Rollback command hazırla:
   UPDATE haberler SET kategori_dogrulandi = b.kategori_dogrulandi 
   FROM rollback_siyaset_trim_20260404 b WHERE haberler.id = b.id;
```
**Amaç:** Rollback imkanı + standardize workflow

---

### Faz 3: Dataset.json Supplement Kapatma

**Workflow:** executing-plans (env state override)

#### 3.1 diskSupplementLimit = 0
```
Dosya: backend/scripts/retrain-model.ts
Değişiklik: ML_DISK_SUPPLEMENT_LIMIT=150 → 0
Neden: Siyaset kırpma sonrası supplement gereksiz; veri dengesi kendiliğinden kurulur
Dependency: Faz 2 tamamlanmış olması zorunlu (executing-plans env state)
```

Alternativ: Ilk retrain için 0, sonra ihtiyaca göre 80-100 (eligible kategoriler: Sağlık, Spor, Teknoloji, Dünya, Genel)

---

### Faz 4: Retrain

#### 4.1 Retrain Komutu
```bash
docker compose exec backend sh -c "cd /app && npx ts-node scripts/retrain-model.ts"
```

**Beklenen Çıktılar:**
- `[Training] diskSupplementLimit=0`
- `[ML] dataset.json takviye eklendi (0)` (supplement yok)
- `[ML][Step] classifier.train() bitti` (30sn - 2dk içinde, saatlerce değil)
- `[ML] NAIVE-BAYES (unigram-bigram) başarıyla eğitildi`
- `[ML][Diagnostics] Accuracy=%X.X Macro-F1=Y.YY`

---

### Faz 5: Doğrulama — health-check.md Workflow

**Workflow:** health-check.md (gates + automated validation)

#### 5.1 Health Check — Retrain Completeness
```sql
SELECT version, ROUND(accuracy::numeric,4) AS accuracy, sample_count, trained_at 
FROM model_state WHERE id=1;
```

**Başarı Kriterleri:**
- `accuracy >= 0.68` (v46 baseline)
- `sample_count` 400-600 arası (dengeli)
- Test seti per-kategori dağılımı:
  - Siyaset: 15-25 örnek (% 15-25)
  - Diğer kategoriler: eşit dağ. (~10-15 her biri)

#### 5.2 Per-Kategori F1 Hedefleri — Ara Hedef (Faz 5)
```
Hedef: İlk retrain sonrası baseline oluştur (v46'yı geç)

Siyaset: F1 ≥ 0.50 (LR'ın %12 recall'undan kurtul)
  → Beklenen: ~0.60-0.70 (NB + dengeli test seti)

Diğer kategoriler (Sağlık, Spor, Ekonomi, Teknoloji, Genel, Dünya):
  → F1 ≥ 0.30 (herhangi bir signal)
  → Beklenen: 0.40-0.60 arası (supplement'siz NB)
```

#### 5.3 Post-Retrain Diagnostics
```
Confusion Matrix Analizi:
  - Top 5 misclassification pairs
  - Siyaset → Teknoloji (expected high)
  - Genel → Siyaset (expected high)

Test Seti Dağılımı Doğrulama:
  - Siyaset: %68 → % kaç? (Hedef: ≤ %25)
  - Diğer kategoriler: Eşit dağılım?

Hard Negative Injection Etkisi:
  - Gen GrammarlyAdvance->Siyaset injection yardımcı oldu mu?
  - Ileride optimize edilmeli mi?
```

---

## Diff Listesi (Uygulanacak)

| # | Dosya | Değişiklik | Tür |
|---|-------|-----------|-----|
| 1 | apparatus/logistic_regression_classifier.js | maxIt: 50×rows → 500×rows | Container patch (revertible) |
| 2 | ml.service.ts | Constructor: LR → NB | Kod değişikliği |
| 3 | ml.controller.ts | Instantiation: LR → NB | Kod değişikliği |
| 4 | Veritabanı | Siyaset kırpması (augmented→düşük confidence) | SQL (backup tablolu) |
| 5 | retrain-model.ts | diskSupplementLimit: 150 → 0 | Kod değişikliği |

---

## Zaman Tahmini

| Faz | İşlem | Süre |
|-----|-------|------|
| 1 | Kod değişiklikleri (3 dosya, diff'i göster) | 5 dk (review) |
| 2 | SQL (Siyaset kırp + backup tablo oluştur) | 2 dk |
| 3 | Retrain | 30 sn - 2 dk |
| 4 | Doğrulama | 1 dk |
| **TOPLAM** | | **~10 dk** |

---

## Risk & Mitigation

| Risk | Etki | Mitigation |
|------|------|-----------|
| Retrain yine takılı kalır | 2+ saat kaybı | NB iterasyon yok, 30sn-2dk biter. Takılırsa apparatus rebuild zorunlu. |
| Siyaset kırpması boş bırakır | Model Siyaset'i öğrenemez | Kırpma stratejisine uyulacak, augmented'ler atılır. Min 100+ record kalır. |
| Accuracy düşer | v46'dan kötüleşir | NB v29'da %88 elde etti; bu seçim isteniyordu. Rollback var. |

**Rollback:** Tüm adımların backup'ları var (rollback tablosu + disk). 30 saniyede v46'ya dönüş yapılabilir.

---

---

## Pre-Execution Checklist (Faz 1 Öncesi)

**Amaç:** Kod state doğrulama, herhangi bir dangling değişiklik yok

- [ ] ml.service.ts line ~58: Constructor'ın mevcut durumunu kontrol (LR mi NB mi?)
- [ ] ml.controller.ts: MlCategorizationService instantiation'ının mevcut hali
- [ ] retrain-model.ts: diskSupplementLimit'in default değeri ne?
- [ ] Container apparatus: maxIt zaten değiştirilmiş mi (50 mi 500 mi)?
- [ ] Mevcut v46 model persist mi? (rollback için gerekli)

---

## Sprint 2: Backfill Gate (v29 Hedefleri için)

**Faz 5 sona erdikten sonra karar noktası**

### Ara Hedefler Sağlandı mı?
- Accuracy ≥ 0.68? → ✅ İleri git
- Siyaset F1 ≥ 0.50? → ✅ İleri git
- Diğer kategoriler F1 ≥ 0.30? → ✅ İleri git

### Sprint 2 Backfill Planı
```
Hedef: v29 F1 hedeflerine ulaş
  - Siyaset F1: 0.50 → 0.636 (+0.136)
  - Sağlık F1: current → 0.943 (sprint 2 hedef)
  - Diğer: current → v29 bazlı

Strateji:
  1. Kırpma sonrası hangi kategoriler <0.85?
  2. Bu kategoriler için verified mini-batches oluştur (manual veya LLM)
  3. Backfill: --gemini-limit=50 --ollama-limit=50
  4. Retrain v49+ (v48 ara checkpoint)
  5. v29 delta-guard kontrol: F1 >= v29 - 0.02
```

---

## Onay Durumu

- ✅ **Genel plan yapısı:** Onaylandı
- ✅ **Kırpma sırası:** Onaylandı (augmented→düşük conf)
- ✅ **NB'ye geçiş:** Onaylandı
- ✅ **diskSupplementLimit=0:** Onaylandı
- ✅ **Workflow'lar entegre:** executing-plans, dataset-quality-guard, rollback.md, health-check.md
- ✅ **Pre-execution checklist + Post-retrain diagnostics:** Onaylandı
- ⏳ **Diff gösterilmesi beklemekte:** Uygulamadan önce diff'ler sunulacak

---

## Sonraki Adım

1. Diff dosyaları oluştur (3 kod + 1 SQL)
2. Kullanıcı onay
3. Uygulamaya başla
4. Retrain + doğrulama
5. Sonuç raporla
