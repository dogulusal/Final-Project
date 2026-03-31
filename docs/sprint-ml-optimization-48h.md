# 48 Saat ML Optimizasyon Sprint Planı

> **Başlangıç:** 29 Mart 2026 (gece)  
> **Hedef:** ML accuracy %74 → %90+ | RSS stabilite %100 | Veri hacmi 1,265 → 2,500+  
> **Strateji:** Veri kalitesi önce → Altyapı düzelt → Model geliştir → Doğrula

---

## Mevcut Durum Snapshot (29 Mart 2026, 23:00)

| Metrik | Değer | Hedef |
|--------|-------|-------|
| Toplam haber | 1,265 | 2,500+ |
| Doğrulanmış | 1,249 (%99) | %100 |
| ML Accuracy | %74.04 | %90+ |
| ML Sample Count | 1,890 | 3,000+ |
| Sentiment Dağılımı | Nötr %60, Pozitif %23, Negatif %17 | Nötr <%50, Pozitif/Negatif dengeli |

### Kategori Dağılımı (Dengesizlik Sorunu)

| Kategori | Adet | Doğrulanmış | Avg Confidence | Durum |
|----------|------|-------------|----------------|-------|
| Genel | 245 | 242 | 0.89 | ✅ Yeterli |
| Teknoloji | 222 | 219 | 0.89 | ✅ Yeterli |
| Dünya | 218 | 214 | 0.92 | ✅ Yeterli |
| Spor | 198 | 198 | 0.87 | ✅ Yeterli |
| Ekonomi | 158 | 156 | 0.82 | ⚠️ Orta |
| Sağlık | 116 | 114 | 0.81 | ❌ Zayıf |
| Siyaset | 108 | 106 | 0.86 | ❌ Zayıf |

**Kök Neden Analizi:**
- Sağlık ve Siyaset kategorileri, Genel'in yarısından az veri barındırıyor (2.3x dengesizlik)
- %74 accuracy'nin en büyük sebebi: az temsil edilen kategorilerde model "emin olamaMAK" yerine yanlış sınıfa yönleniyor
- RSS kaynakları shiftdelete ve cnnturk-anasayfa hâlâ `text.replace` hatası veriyor → potansiyel veri kaybı
- Sentiment dağılımı Nötr ağırlıklı (%60) — sentiment sözlüğü iyileştirmesi gerekebilir

---

## Faz 0: Altyapı Stabilizasyonu (Saat 0-3)

**Amaç:** RSS hatalarını tamamen ortadan kaldır, veri akışını kesintisiz yap  
**Öncelik:** 🔴 Kritik — bozuk veri hattı üzerinde model iyileştirmesi yapılamaz  
**Skills Applied:** `systematic-debugging` (root cause analysis), `rss-health-monitor` (source health audit)

### 0.1 — `text.replace` Hatası Root Cause Fix + Structured Error Logging
**Methodology:** `systematic-debugging` skill uygulanacak (4-faz: investigate → reproduce → check changes → gather evidence)
- **Sorun:** `shiftdelete` ve `cnnturk-anasayfa` kaynakları hâlâ hata veriyor
- **Mevcut Fix:** `rss-scheduler.ts` ve `rss.service.ts`'de `normalizeText()` eklendi — yeterli değil
- **Root Cause:** `news.service.ts` L218-227'deki slug oluşturma kodu: `.trim().replace(...)` zinciri doğrudan non-string değer alıyor
- **Çözüm:**
  - `news.service.ts` → slug oluşurken `String(baslik || '')` ile wrap et
  - `content-quality-filter.ts` L62 → aynı normalizeText() guard'ı ekle
  - Tüm `.replace()` çağrılarını grep ile tara, her birinin input'unu güvenceye al
- **Structured Error Logging (YENİ):**
  - `rss-scheduler.ts` catch bloğunda her parse hatasını structured log olarak kaydet:
    ```typescript
    console.error(`[Parser Error] source: ${source} | field: ${fieldName} | actual_type: ${typeof value} | value_sample: ${String(value).substring(0, 50)}`);
    ```
  - Böylece hangi kaynaktan ne tip hata geliyor görlünür → telemetri verisi
- **Doğrulama:** 15 dakika bekleme → `docker compose logs` → 0 text.replace hatası + tüm parse hataları structured log'da

### 0.2 — RSS Kaynak Sağlık Kontrolü
**Workflow:** `rss-health-monitor` workflow'u çalıştır (31 kaynağı ping et, stale sources tespiti, kategorilendirme)
- 31 kaynağın durumunu logla: hangisi aktif, hangisi hata veriyor
- Sürekli hata veren kaynakları devre dışı bırakma değil, düzeltme yaklaşımı
- `milliyet-anasayfa` duplicate hatası normal davranış (dedup çalışıyor) — sorun değil

### Doğrulama Kriteri (Verification-Before-Completion)
```
✅ 2 scheduler döngüsü art arda 0 hata ile tamamlansın
✅ Tüm 31 kaynak en az 1 kez başarılı çekilsin
✅ rss-health-monitor raporu: Down/Broken/Idle kategorileri görlünsün
```
→ **Faz 0 çıkışında `verification-before-completion` skill ile kontrol et**

---

## Faz 1: Veri Hacmi & Kategori Dengesi (Saat 3-16)

**Amaç:** Zayıf kategorileri (Sağlık, Siyaset, Ekonomi) güçlendir, toplam veriyi 2,500+'ya çıkar  
**Öncelik:** 🔴 Yüksek — ML modeli ancak dengeli ve yeterli veri ile iyi eğitilir  
**Faz Başı:** `health-check` workflow'u çalıştır (API + DB + Gemini quota kontrol)  
**Skills Applied:** `dataset-quality-guard` (imbalance audit), `verification-before-completion` (faz çıkışı gate)

### 1.1 — LLM Backfill ile Zayıf Kategori Takviyesi + Quota Pre-Check
- **Hedef Dağılım:** Her kategori minimum 250 doğrulanmış haber
- **Eksik:**
  - Sağlık: 114 → 250 arası (136+ haber gerek)
  - Siyaset: 106 → 250 arası (144+ haber gerek)  
  - Ekonomi: 156 → 250 arası (94+ haber gerek)
- **Quota Pre-Check (YENİ - Faz 1 başlangıcında):**
  ```sql
  SELECT saglayici, COUNT(*) AS req_24h, 
         SUM(giris_token_sayisi) + SUM(cikis_token_sayisi) AS tokens_24h
  FROM llm_kullanm 
  WHERE tarih > NOW() - INTERVAL '24 hours'
  GROUP BY saglayici;
  ```
  - Gemini'nin son 24 saatte hata oranı %40+ ise backfill başlamadan hemen Ollama-primary'ye geç
  - Başarılı olma: Backfill batch boyutunu dinamik ayarla (80% hata → batch boyutu yarıya düşür)
- **Strateji:**
  1. Quota pre-check çalıştır
  2. RSS scheduler'ın doğal akışını 6-8 saat çalıştır (her 10 dk döngü)
  3. Paralel olarak `llm-backfill.ts` ile mevcut ham/düşük-confidence haberleri zenginleştir
  4. LLM-verified kategorileri `kategori_dogrulandi = true` olarak işaretle
- **Gemini Quota Yönetimi:**
  - 6 API key round-robin aktif
  - Günlük limit: ~1,500 request/key × 6 = ~9,000 request
  - Backfill batch: `--gemini-limit=400 --ollama-limit=100` (her batch)
  - Quota aşılırsa Ollama-primary'ye geç: `--gemini-limit=10 --ollama-limit=300`

### 1.2 — Gold-Label Protokolü + Sentiment × Kategori Diagnostik
**Dataset Quality Audit:** `dataset-quality-guard` skill uygulanacak (class imbalance detection, noise/mislabel check)
- **Amaç:** Eğitim verisinin kalitesini garanti altına al
- **Kural:** Modele sadece `kategori_dogrulandi = true` olan haberler beslenir
- **Süreç:**
  1. LLM (Gemini) her haberin kategorisini atar → `ml_confidence` ile kaydeder
  2. `ml_confidence >= 0.75` → otomatik doğrulama (`kategori_dogrulandi = true`)
  3. `ml_confidence < 0.75` → review kuyruğuna at (admin panelde manual review)
  4. Manual review edilen haberler gold-label olarak train set'e girer
- **Sentiment × Kategori Diagnostik (YENİ):**
  - Faz 1 saat 8'de bu sorguyu çalıştır ve sonuçları kaydet:
    ```sql
    SELECT k.ad, h.sentiment, COUNT(*) as cnt, 
           ROUND(COUNT(*)*100.0/SUM(COUNT(*)) OVER (PARTITION BY k.ad)) as pct
    FROM haberler h JOIN kategoriler k ON h.kategori_id=k.id
    WHERE kategori_dogrulandi=true
    GROUP BY k.ad, h.sentiment ORDER BY k.ad, cnt DESC;
    ```
  - **Analiz:** Siyaset'in %70+ Nötr olması sözlük eksikliğine işaret ediyor. Kategori-ML accuracy'de gizli etki var.
  - **Aksiyon:** Eğer Siyaset Nötr >= %65 ise, Faz 2'ye "sentiment sözlüğü Siyaset-termleri ekleme" adımı ekle.
- **Dosyalar:**
  - `backend/scripts/review-low-confidence.ts` — mevcut script'i kullan
  - Admin panelde low-confidence listesi zaten var

### 1.3 — RSS Kaynak Çeşitlendirme (Opsiyonel)
- Sağlık ve Siyaset için ek RSS kaynakları değerlendir
- Mevcut: Sağlık 3 feed, Siyaset 7 feed
- Potansiyel eklemeler: medimagazin (sağlık), bbc türkçe (siyaset/dünya)
- **Not:** Sadece veri yetersiz kalırsa yapılacak, zorunlu değil

---

### ⏰ SAAT 10 ARA KONTROL NOKTASI (Faz 1 → Faz 2 Geçişi)
**Amaç:** Veri toplanması yolunda ise devam et, geri kalmışsa backfill yoğunlaştır

**Kontrol Kriteri (Faz 1'in saat 10'unda çalıştır):**
```sql
SELECT k.ad, COUNT(*) as cnt FROM haberler h 
JOIN kategoriler k ON h.kategori_id=k.id 
WHERE kategori_dogrulandi=true 
GROUP BY k.ad ORDER BY cnt;
```

**Karar Ağacı:**
- ✅ HER kategoride ≥180 ve TOPLAM ≥1,600 → Faz 2'ye normal akışla geç
- ⚠️ Birkaç kategori <180 ama TOPLAM ≥1,400 → Backfill batch'i 2x yoğunlaştır (--gemini-limit=600), Faz 1'ü 2 saat daha çalıştır
- ❌ TOPLAM <1,400 → RSS kaynakları check et (kapalı olanlar var mı?), kaynaklar ekle, backfill'i aggressive mode'a al (--gemini-limit=800)

### Doğrulama Kriteri (Verification-Before-Completion)
```
✅ Her kategori >= 200 doğrulanmış haber
✅ Toplam doğrulanmış >= 2,000
✅ Dengesizlik oranı max 1.5x (en kalabalık/en az) idealde 1.3x
✅ dataset-quality-guard audit passed: no CJK/HTML/encoding noise
✅ Saat 10 checkpoint tamamlandı (karar ağacı takip edildi)
```
→ **Faz 1 çıkışında fresh SQL query'ler çalıştırarak doğrula**

---

## Faz 2: Model Eğitim Pipeline Geliştirme (Saat 16-28)

**Amaç:** Eğitim sürecini yeniden yapılandır, accuracy'yi %90+ çıkart  
**Öncelik:** 🟡 Yüksek — veri hazır olduktan sonra başla  
**Faz Başı:** `health-check` workflow'u çalıştır  
**Skills Applied:** `verification-before-completion` (interim accuracy checks), `systematic-debugging` (confusion matrix analysis)

### 2.0 — Türkçe Stemmer Düzeltmesi (ROOT CAUSE FIX) ⭐
**Kritik Bulgu:** `ml.service.ts` L153'de `natural.PorterStemmer` (İNGİLİZCE stemmer) kullanılıyor!  
"ekonomik", "ekonominin", "ekonomide" → kök aynı değil.  
Bu %74 accuracy'nin en büyük gizli sebebi. Model dengesizliğini değil, feature quality'sini etkiliyoyor.

**Çözüm Yaklaşımları (en etkili önce):**
1. **Stemmer-free mod (EN BASIT)**: `ml.service.ts` L153 değiştir:
   ```typescript
   // BEFORE: this.classifier = new natural.BayesClassifier(natural.PorterStemmer);
   // AFTER:  this.classifier = new natural.BayesClassifier();
   ```
   Açıklama: Stemming olmadan kelimeler olduğu gibi alınır. Türkçe morphology'i `natural` kütüphanesi desteklemediği için, stemming'in zararı faydası aştıktan sonra devre dışı bırakmak en uygun çözüm.
   
2. **Türkçe Stopwords (BONUS)**: `ml.service.ts` eğitim döngüsüne ekle:
   ```typescript
   const turkishStopwords = ['ve', 'veya', 'yok', 'var', 'bir', 'her', 'bu', 'şu', 'ki', 'mi', 'mi'];
   // addDocument öncesi text'ten stopwords'ü sil
   ```
   
3. **Minimum Kelime Uzunluğu**: text preprocessing'de min 3 char filter ekle (noise azalır)

**Eğitim Süreci Güncelleme:**
- Script: `backend/scripts/balance-training-data.ts`
- Stemmer-free classifier yeniden eğit
- Accuracy'yi önceki %74 baseline ile karşılaştır (muhtemelen +2-3% sıçrama)

**Doğrulama:** Eğitim sonrası test accuracy logla

### 2.1 — Data Leakage Guard + Temporal Train/Test Split
- **Sorun:** Mevcut balanced split rastgele — gerçek dünyada model geçmiş veriyle eğitilip gelecek veriyi tahmin eder. Ayrıca sprint sırasında backfill ile eklenen haberler test setine sızabilir.
- **Yeni Yaklaşım:**
  - Haberleri `yayinlanma_tarihi`'ne göre sırala
  - Son %20'yi test set olarak ayır (en yeni haberler)
  - İlk %80'i train set olarak kullan
  - Bu, modelin "görmediği" haberleri tahmin etme yeteneğini gerçekçi ölçer
- **Data Leakage Guard (YENİ):**
  - Backfill script'ine `augmented_at` timestamp'i ekle (LLM zenginleştirme zamanını kaydet)
  - `balance-training-data.ts`'de temporal split hesaplarken:
    ```typescript
    // Test set: yayinlanma_tarihi'nin son %20'si VEYA augmented_at > backfill_start_time
    // Böylece backfill-generated haberler test setine girmez
    ```
- **Dosya:** `backend/scripts/balance-training-data.ts` — split stratejisini güncelle
- **Etki:** Accuracy rakamı daha gerçekçi olacak (belki başta düşük ama güvenilir, data leakage yok)

### 2.2 — Kategoriye Özgü Sentiment Sözlüğü (Şartlı)
- **Koşul:** Faz 1 saat 10 diagnostiğinde Siyaset Nötr >= %65 bulunmuşsa
- **Amaç:** Siyaset haberlerinde sentiment detection kalitesini artır
- **Yaklaşım:**
  - `backend/src/modules/ml/tr-sentiment-dict.json` konusuna göre kategorileri kaydet
  - Siyaset icin ek negative keywords: "kriz", "tartışma", "çatışma", "suçlama", "fesat"
  - Siyaset için ek positive keywords: "başarı", "kazanım", "anlaşma", "barış", "reform"
  - Sentiment detection'de kategori context'i kullan (hardcoded değil, dict'e flag ekle)
- **Dosya:** `backend/src/modules/ml/tr-sentiment-dict.json` ve `sentiment.analyzer.ts`
- **Not:** Eğer Siyaset Nötr < %65 ise bu adım skip edilebilir

### 2.3 — Per-Class Confidence Calibration
- **Sorun:** Sağlık (avg 0.81) ve Ekonomi (avg 0.82) düşük confidence — model bu kategorilerde kararsız
- **Çözüm:**
  - Her kategori için ayrı F1-score hesapla (precision × recall harmonic mean)
  - Confusion matrix çıkart: hangi kategoriler birbiriyle karışıyor?
  - Örnek beklenti: Ekonomi ↔ Siyaset, Sağlık ↔ Genel karışımları muhtemel
- **Dosya:** `backend/src/modules/ml/ml.service.ts` → `trainWithSplit()` sonuna confusion matrix log ekle
- **Çıktı:**
  ```
  === Confusion Matrix ===
  Actual\Predicted  Genel  Teknoloji  Dünya  Spor  Ekonomi  Sağlık  Siyaset
  Genel               45     2        1      0     3        1       0
  Teknoloji            1     42       0      0     0        0       0
  ...
  === Per-Class F1 ===
  Genel: 0.91 | Teknoloji: 0.94 | Dünya: 0.96 | Spor: 0.95 | Ekonomi: 0.85 | Sağlık: 0.83 | Siyaset: 0.88
  ```

### 2.4 — Hard-Negative Active Learning
- **Konsept:** Modelin en çok zorlandığı örnekleri bulup eğitim setine ekle
- **Süreç:**
  1. Mevcut modelle tüm haberleri tahmin et
  2. Yanlış tahmin edilenleri + `ml_confidence < 0.65` olanları çıkart
  3. Bunları LLM ile doğrulat (gold-label)
  4. Dataset'e "hard example" olarak ekle
  5. Yeniden eğit → accuracy zıplaması beklenir
- **Script:** `backend/src/scripts/active-learning-loop.ts` (yeni)
- **Beklenen Etki:** +3-5% accuracy artışı (hard negative mining en etkili tekniklerden)

### 2.5 — Dataset Augmentation & Temizlik
- **Augmentation:**
  - Her kategoriden en az 50 örnek LLM ile paraphrase et (başlık + özet yeniden ifade)
  - Augmented örnekleri ayrı flag ile dataset'e ekle (`augmented: true`)
- **Temizlik:**
  - Duplicate başlık/içerik tara ve çıkart
  - Çok kısa (<20 karakter) veya çok uzun (>2000 karakter) başlıkları filtrele
  - Yanlış encode karakterler temizle

### Doğrulama Kriteri (Verification-Before-Completion)
```
✅ Temporal split ile accuracy >= %88 (fresh tsc + npm test çalıştır)
✅ Per-class F1 minimum >= 0.80 (hiçbir kategori 0.80 altında değil)
✅ Confusion matrix'te off-diagonal max %10
✅ Training pipeline tek komutla çalışır: npm run ml:train
✅ Türkçe stemmer devre dışı bırakıldı (PorterStemmer kaldırıldı)
```
→ **Faz 2 çıkışında `verification-before-completion` skill ile accuracy regression test et**

---

## Faz 3: Model Karşılaştırma, Seçim & Doğrulama (Saat 28-42)

**Amaç:** Naive Bayes dışında alternatif modelleri dene, en iyisini seç, production'a taşı  
**Öncelik:** 🟡 Orta — Faz 2'nin accuracy hedefine ulaşıp ulaşmadığına bağlı  
**Faz Başı:** `health-check` workflow'u çalıştır  
**Skills Applied:** `systematic-debugging` (model comparison analysis), `verification-before-completion` (production readiness gate)

### 3.0 — N-Gram Preprocessing Karşılaştırması (Feature Engineering)
**Deneme-Yanılma Metodolojisi:** Mevcut NB modelinde 3 preprocessing variant'ı test et

| Config | Açıklama | ROI |
|--------|----------|-----|
| Config A: Unigram only (baseline NB) | Mevcut: stemmer-free, tek kelime | Baseline |
| Config B: Unigram + Bigram | `['sağlık', 'bakanlığı', 'sağlık_bakanlığı']` — category-specific signals | +1-2% |  
| Config C: Unigram + Bigram + min 3 char | Kısa noise temizlenmiş | +0.5-1% |

**Test Süreci:**
1. Eğitim script'ini 3 config için çalıştır: `balance-training-data.ts --config=A|B|C`
2. Aynı test set üzerinde accuracy, F1, confusion matrix karşılaştır
3. En iyi config'i seç (genelde Config B bigram ekiyle +1-2% kazanç)
4. Seçili config'i model_state'e `preprocessing_mode` flag'i olarak kaydet

**Doğrulama:** Bigram vs unigram accuracy farkı ≥%0.5 ise Config B production'a taşı

### 3.1 — Docker Restart Testi (Production Readiness)
**Amaç:** Model persistence ve startup flow'u doğrula  
**Adımlar:**
1. `docker compose down`, `docker compose up -d` — serve restart
2. Startup log: "Model DB'den yüklendi" geçiyor mu? (yeniden eğitim degil)
3. `/api/health` ve `/api/ready` endpoint'leri 200 dönüyor mu?
4. RSS scheduler otomatik başlıyor mu (hata yok)?
5. Eski model persistence verileri var mı DB'de?

**Doğrulama Kriteri:**
```
✅ Restart <5 saniye
✅ Model DB'den yükleniyor (log'da görünüyor)
✅ 0 hata, REST API ready
✅ RSS scheduler aktif
```

### 3.2 — Alternatif Model Implementasyonu
- **Mevcut:** `natural.BayesClassifier` (Naive Bayes)
- **Alternatifler:**
  1. **LogisticRegressionClassifier** (`natural` kütüphanesinde zaten var)
     - `natural.LogisticRegressionClassifier()` — drop-in replacement
     - Genelde Naive Bayes'den %2-5 daha iyi metin sınıflandırmada
  2. **SVM (basit)** — `libsvm-js` veya `ml-svm` npm paketi
     - TF-IDF → SVM pipeline
     - En iyi accuracy potansiyeli ama setup daha karmaşık
- **Yaklaşım:**
  - Her modeli aynı temporal split ile eğit
  - Aynı test set üzerinde accuracy, F1-macro, ve confusion matrix karşılaştır
  - En iyi performansı gösteren model "production model" olarak seçilir

### 3.3 — Model Benchmark Tablosu
```
| Model | Accuracy | F1-Macro | En Zayıf Kategori | Eğitim Süresi | Tahmin Süresi |
|-------|----------|----------|--------------------|---------------|---------------|
| Naive Bayes | %74 | ? | Sağlık | ~2s | <1ms |
| Logistic Regression | ? | ? | ? | ~5s | <1ms |
| SVM (RBF) | ? | ? | ? | ~15s | <5ms |
```
- **Karar Kriteri:** Accuracy >= %90 VE F1-macro >= 0.88 olan modeli seç
- **Eşit performansta:** Daha basit olan (NB > LR > SVM) tercih edilir

### 3.4 — Kazanan Modelin Production'a Alınması
- `ml.service.ts`'de model factory pattern: `getClassifier(type)` fonksiyonu
- `model_state` tablosuna `model_type` kolonu ekle
- Startup'ta hangi model yükleneceğini `model_state.model_type` belirler
- Fallback: model_type boşsa Naive Bayes kullan (geriye uyumluluk)

### Doğrulama Kriteri (Verification-Before-Completion)
```
✅ N-gram preprocessing comparison completed (Config A/B/C test edilmiş)
✅ En az 2 model karşılaştırması yapılmış (NB vs LR minimum)
✅ Benchmark tablosu doldurulmuş
✅ Kazanan model production-active ve model_state'de kayıtlı
✅ Docker restart test passed (Model DB'den yükleniyor)
```
→ **Faz 3 çıkışında `verification-before-completion` skill ile production readiness doğrula**

---

## Faz 4: Doğrulama & Raporlama (Saat 38-48)

**Amaç:** Tüm iyileştirmeleri end-to-end doğrula, rapor oluştur  
**Öncelik:** 🟢 Kapanış — her şey çalıştıktan sonra  
**Faz Başı:** `health-check` + `rss-health-monitor` workflow'lar çalıştır (son durum snapshot)  
**Workflow Applied:** `comprehensive-review` (security + health + performance + test + lint gates + final sprint report)

### 4.1 — End-to-End ML Pipeline Testi
**Workflow:** `comprehensive-review` orchestrate'i (bileşen ve entegrasyon testleri)
1. RSS scheduler 2 döngü çalıştır (0 hata)
2. Yeni gelen haberler otomatik kategorilendiriliyor mu?
3. Confidence < 0.75 olanlar review kuyruğuna düşüyor mu?
4. `/api/ml/train` API'si eğitim + persist + accuracy döndürüyor mu?
5. Model consistency: Aynı text iki kez tahmin ettiğinde aynı sonuç veriyor mu?
6. Tüm kategorilerin PR curve ve ROC AUC metrikleri hesaplanıyor mu?

### 4.2 — Final Metrics Snapshot
```sql
-- Bu sorguları çalıştır ve sonuçları kaydet:
SELECT accuracy, sample_count, trained_at FROM model_state ORDER BY trained_at DESC LIMIT 1;
SELECT k.ad, COUNT(*) AS total FROM haberler h JOIN kategoriler k ON h.kategori_id=k.id WHERE kategori_dogrulandi=true GROUP BY k.ad ORDER BY total;
SELECT sentiment, COUNT(*) FROM haberler GROUP BY sentiment;
```

### 4.3 — Sprint Raporu (Tez-Ready Metrikleri ile)
- **Başlangıç vs bitiş metrikleri tablosu:**
  | Metrik | Start | End | Gelişim |
  |--------|-------|-----|----------|
  | Accuracy | %74.04 | ? | +X% |
  | Per-Category F1 Min | 0.70 | ? | ≥0.80 |
  | ROC-AUC | ? | ? | ≥0.92 |
  | PR-AUC | ? | ? | ≥0.85 |
  
- **Per-Category Performance (Tez için kritik):**
  ```
  Category | Precision | Recall | F1-Score | Sample Count
  Genel    | ?         | ?      | ?        | ?
  ...
  ```
  
- **Visualizations (Tez'de kullanılacak):**
  - Confusion Matrix heatmap
  - ROC curve (all classes)
  - Precision-Recall curve (all classes)
  - Per-category F1 bar chart
  
- **Yapılan değişikliklerin commit listesi**
- **Kalan sorunlar ve sonraki adımlar**

### 4.4 — Dokümantasyon Güncellemesi
- `docs/ml-improvement-plan.md` güncelle (mevcut durumu yansıtsın)
- `PERFORMANCE_AUDIT.md` ML bölümü ekle
- `README.md` ML accuracy metriğini güncelle

### Doğrulama Kriteri (Final Verification-Before-Completion)
```
✅ comprehensive-review workflow passed (security + health + perf audit)
✅ Sprint raporu hazır (başlangıç vs bitiş metrikleri, tez-ready visualizations)
✅ Final accuracy >= %90 (veya en iyi elde edilebilir sonuç belgelenmiş)
✅ Tüm per-category PR-AUC >= 0.85, ROC-AUC >= 0.92
✅ Tüm değişiklikler commit + push edilmiş (git log check)
✅ Bilinen sorunlar belgelenmiş
```

---

## Özet: Faz Geçiş Şartları

```
Faz 0 (3h)  ──[0 RSS hatası]──►  Faz 1 (13h)  ──[her kategori >=200]──►  Faz 2 (12h)  ──[accuracy >=88%]──►  Faz 3 (10h)  ──[model seçildi]──►  Faz 4 (10h)
```

| Faz | Süre | Giriş Koşulu | Çıkış Koşulu |
|-----|------|-------------|--------------|
| 0 | ~3h | Başlangıç | RSS 0 hata, structured error logs aktif |
| 1 | ~13h (+ saat 10 checkpoint) | RSS stabil | Her kategori ≥200, toplam ≥2,000, quota check OK |
| 2 | ~12h | Veri hazır, Türkçe stemmer fixed | Temporal accuracy ≥%88, F1 ≥0.80, data leakage-free |
| 3 | ~14h | Baseline güçlü | Model seçildi, Docker restart OK, production-active |
| 4 | ~10h | Model hazır | ROC/PR curves + rapor + commit + tez-ready metrikleri |

---

## Risk & Fallback

| Risk | Olasılık | Etki | Fallback |
|------|----------|------|----------|
| Gemini quota tükenir | Yüksek | Backfill yavaşlar | Ollama-primary batch'e geç |
| RSS kaynağı kapanır | Düşük | ~5% veri kaybı | Diğer kaynaklar kompanse eder |
| Accuracy %90'ı bulamaz | Orta | Hedef kaçar | %85+ kabul edilebilir, raporda belirt |
| SVM/LR fark yaratmaz | Orta | Ekstra iş boşa gider | NB ile kal, Faz 3'ü kısa tut |
| Docker restart veri kaybı | Düşük | Model eğitimi sıfırlanır | model_state persist zaten var |

---

## Hızlı Referans: Komutlar

```bash
# RSS stabilite kontrolü
docker compose logs --since 10m backend | grep -E "text\.replace|Scheduler Error"

# Kategori dağılımı
docker compose exec -T postgres psql -U postgres -d news_db -c "SELECT k.ad, COUNT(*) FROM haberler h JOIN kategoriler k ON h.kategori_id=k.id WHERE kategori_dogrulandi=true GROUP BY k.ad ORDER BY COUNT(*);"

# Backfill (Gemini primary)
docker compose exec -T backend npx ts-node src/scripts/llm-backfill.ts --gemini-limit=400 --ollama-limit=100

# Backfill (Ollama primary - quota aşımında)
docker compose exec -T backend npx ts-node src/scripts/llm-backfill.ts --gemini-limit=10 --ollama-limit=300

# ML eğitim
curl -X POST http://localhost:3002/api/ml/train -H "Authorization: Bearer <token>"

# Model durumu
docker compose exec -T postgres psql -U postgres -d news_db -c "SELECT accuracy, sample_count, trained_at FROM model_state ORDER BY trained_at DESC LIMIT 1;"

# Full pipeline testi
docker compose exec -T backend npm test -- --runInBand

# Health check workflow
# Faz başladığında:
cat .agent/workflows/health-check.md # API + DB + LLM kontrol

# RSS health monitor workflow
# Faz 0-1 sırasında:
cat .agent/workflows/rss-health-monitor.md # 31 kaynak audit

# Comprehensive review workflow
# Faz 4 kapanışında:
cat .agent/workflows/comprehensive-review.md # Full-stack audit + report
```

---

## Skills & Workflow Integration

**Sprint sırasında aktif olacak skill/workflow'lar:**

| Faz | Skill/Workflow | Amaç | Trigger |
|-----|---|---|---|
| **Faz 0** | `systematic-debugging` | Text.replace root cause analizi (4-faz debug) | Reusable RSS error analysis metodolojisi |
| **Faz 0** | `rss-health-monitor` | Tüm RSS kaynakları audit (ping, error categorization) | Faz 0 başında + Faz 1 checkpoint'te |
| **Faz 0-4** | `health-check` | API/DB/LLM connectivity gate | Her faz başlangıcında |
| **Faz 1** | `dataset-quality-guard` | Class imbalance audit, noise/mislabel tespiti | Dataset backfill sonrası |
| **Faz 1-4** | `verification-before-completion` | Fresh SQL/test çalıştırarak faz çıkış doğrulaması | Her faz kapanırken |
| **Faz 3** | (N-gram karşılaştırması) | Feature preprocessing variant test (A/B/C) | Model seçimi öncesi |
| **Faz 4** | `comprehensive-review` | Full-stack audit orchestrator (security+health+perf+test) | Sprint final checkpoint |

**Yararları:**
- ✅ Doğrulama adımları otomatize (insan hatası azalır)
- ✅ Root cause debug metodolojiler reusable (sonraki sprint'lerde de kullanılabilir)
- ✅ Data quality gatekeeping (model training'den önce garbage filtering)
- ✅ Production readiness certification (docker restart, health checks)
- ✅ Final report orchestration (tez'e dönem özeti hazırlığı)

| Türkçe stopwords yetersiz | Orta | Noise filtering başarısız | Train sonrası frequency logs analizi: top 50 tokenları tespit et, <3 frekans olanları stopwords'e ekle |
