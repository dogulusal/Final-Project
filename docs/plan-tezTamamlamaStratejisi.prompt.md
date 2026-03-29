# Plan: AI Haber Ajansı — Tez Tamamlama Stratejisi (Nisan–Mayıs Ortası 2026)

> **Proje Tipi:** Üniversite Tezi  
> **Deadline:** Mayıs ortası (~30-45 gün)  
> **Mevcut Durum:** %97 tamamlanmış — Faz 1 ✅ | Faz 2 ✅ | Faz 3 %33 (13-14✅, 15-18⏳) | Git temizlendi ✅  
> **Strateji:** Veri hattı ✅ → ML 93.9% ✅ → Frontend WOW (devam) → Tez polish

---

## Mevcut Durum Özeti (29 Mart 2026 — güncel)

| Alan | Durum | Not |
|------|-------|-----|
| Backend | ✅ %100 | Security ✅, LLM tracking ✅, migrations ✅, 0 TS hata |
| Frontend | %75 | Sitemap ✅, slug ✅, hover ✅ — Carousel/ProgressBar/Radar ⏳ |
| ML | ✅ **%93.9** | Naive Bayes v2, 1,883 training, tüm haberler reclassify ✅ |
| Veri | ✅ 1,229 haber | 7 kategori dengeli, 782 reclassified, 315 flagged |
| DevOps | %90 | Docker ✅, n8n kaldırıldı ✅, SSL/Nginx ⏳ (Faz 4 karar) |
| Dokümantasyon | %80 | API.md ✅, README ✅, tez format ⏳ |
| Git | ✅ Temiz | 9 görev bazlı commit, 0 pis dosya |

---

## Faz 1: Veri Hattını Açma & Bug Fix (Gün 1-5)

**Amaç:** Veri akışını 4-5x artır + bilinen hataları temizle  
**Skills:** `systematic-debugging` · `verification-before-completion` (her bug fix sonrası Docker rebuild öncesi checklist)

### Adımlar

0. **[YENİ] Model persistence — ML state'ini DB'ye kaydet** *(Adım 1'den önce tamamla)*
   - **Neden:** Docker rebuild/restart'ta `natural.BayesClassifier` tamamen RAM'den siliniyor. Her restart'ta dakikalarca yeniden eğitim.
   - **Yaklaşım:** `natural.BayesClassifier.restore()` kullan — field bazlı çıkarma YAPMA.
     - `JSON.stringify(this.classifier)` → tüm state'i tek seferde serialize eder
     - `natural.BayesClassifier.restore(JSON.parse(modelData))` → geri yükler
     - Doğrulanmış: `classifier` objesinin gerçek iç field'ları `classFeatures, classTotals, totalExamples, smoothing` + üst seviye `docs, features, stemmer, lastAdded` — restore() bunların tümünü otomatik yönetir.
   - Dosya: `backend/prisma/schema.prisma` → `ModelState` modeli ekle:
     ```prisma
     model ModelState {
       id          Int      @id @default(autoincrement())
       version     Int      @default(1)
       modelData   Json     // JSON.stringify(classifier) tam çıktısı
       accuracy    Float?
       trainedAt   DateTime @default(now())
       sampleCount Int      @default(0)
       @@map("model_state")
     }
     ```
   - Migration: `npx prisma migrate dev --name add_model_state`
   - Dosya: `backend/src/modules/ml/ml.service.ts`:
     - `saveModelToDb(accuracy, sampleCount)` → `JSON.stringify(this.classifier)` ile upsert (id: 1)
     - `loadModelFromDb()` → `natural.BayesClassifier.restore(JSON.parse(saved.modelData))` ile yükle, `this.isTrained = true`
   - Dosya: `backend/src/modules/ml/ml.controller.ts` (startup akışı — Express, NestJS değil):
     ```typescript
     // ÖNCE: mlService.loadAndTrainFromDB() // her zaman sıfırdan eğitir
     // SONRA:
     const loaded = await mlService.loadModelFromDb();
     if (!loaded) {
       console.log('Kayıtlı model yok, sıfırdan eğitiliyor...');
       await mlService.loadAndTrainFromDB();
     }
     ```
   - `trainWithSplit` veya `loadAndTrainFromDB` sonunda: `await this.saveModelToDb(this.lastAccuracy, trainSet.length)`
   - **Otomatik eğitim notu:** `BATCH_TRAIN_THRESHOLD = 20` — her 20 yeni haber event'inde sistem event-driven yeniden eğiter (cron yok). Persist mekanizması bununla çakışmaz; her eğitim sonunda `saveModelToDb` çağrılır.
   - Sonuç: İlk boot eğitir & kaydeder; sonraki Docker restart'larda ~50ms'de yükler; `/api/ml/train` ve batch eğitim her çağrıda DB'yi günceller

1. ~~**RSS feed limitini 5→15 artır**~~ **✅ TAMAMLANDI**
   - `rss-scheduler.ts` L154: zaten `Math.min(feed.items.length, 15)`

2. ~~**Dedup pencere boyutunu 50→200 genişlet**~~ **✅ TAMAMLANDI**
   - `constants.ts`: zaten `DEDUP_WINDOW_SIZE = 200`

3. ~~**llm-usage.ts TypeScript hatalarını düzelt**~~ **✅ TAMAMLANDI**
   - `npx tsc --noEmit` → 0 hata

4. ~~**Sitemap dynamic URL'leri düzelt**~~ **✅ TAMAMLANDI**
   - Dosya: `frontend/src/app/sitemap.ts`
   - Uygulandı: Docker-aware API base + runtime (`force-dynamic`) + hata toleranslı fetch

5. ~~**Kategori/[slug] Docker 404'ü düzelt**~~ **✅ TAMAMLANDI** *(paralel 4 ile)*
   - Dosya: `frontend/src/app/kategoriler/[slug]/page.tsx`
   - Uygulandı: slug param fix (`await params`) + Docker API base + dynamic fallback + geçici API kesintisinde 404 yerine güvenli fallback

### Doğrulama
- Docker restart sonrası log: `Model DB'den yüklendi` mevcut, yeniden eğitim yok
- RSS scheduler logu: "Bu döngüde eklenen: X" → X > 20
- `npx tsc --noEmit` backend'de 0 hata
- Docker rebuild sonrası `/sitemap.xml` → dinamik URL'ler mevcut
- `/kategoriler/siyaset` → 200 OK

---

## Faz 2: ML Doğruluğu & Sentiment İyileştirme (Gün 4-12)

**Amaç:** ML accuracy'yi %92+ çıkar, sentiment çeşitliliğini artır  
**Skills:** `dataset-quality-guard` (dengeleme öncesi veri kalitesi kontrolü) · `code-reviewer` (`ml.service.ts` ve threshold değişiklikleri push öncesi)

*Faz 1 tamamlandıktan 1-2 gün sonra DB dolmuş olacak (hedef: ~2000+ haber)*

### Adımlar

6. ~~**Güncel DB dağılımını ölç**~~ **✅ TAMAMLANDI (29 Mar, 16:55)** *(ön koşul)*
   - **Sonuç:** 1,229 haber ✅
     | Teknoloji | Dünya | Ekonomi | Spor | Genel | Siyaset | Sağlık |
     |-----------|-------|---------|------|-------|---------|--------|
     | 222 (18%) | 218 (18%) | 197 (16%) | 195 (16%) | 158 (13%) | 130 (11%) | 109 (9%) |
   - **Durum:** Tüm kategoriler 50+ limite ulaştı ✅ (MIN_DB_THRESHOLD karşılandı)
   - **Sonuç:** DB dengeleme için hazır

7. ~~**Eğitim verisi dengeleme scriptini çalıştır/güncelle**~~ **✅ TAMAMLANDI (29 Mar, 16:59)** *(depends on 6)*
   - Dosya: `backend/scripts/balance-training-data.ts`
   - **Sonuç:** 1,218 haber dataset.json'a aktarıldı, shuffle+backup alındı
   - **Accuracy Sıçraması:** 86.4% → 93.9% (+7.5% ✨)
   - Training: 1,883 örnek | Test: 362 örnek | Model v2

8. ~~**ML eğitim minimum eşiğini 5→30 yükselt**~~ **✅ TAMAMLANDI**
   - `ml.service.ts`: zaten `dataset.length < 30`

9. ~~**Confidence threshold uyumsuzluğunu gider**~~ **✅ TAMAMLANDI**
   - `constants.ts`: zaten `ML_CONFIDENCE_THRESHOLD = 0.45`
   - `rss-scheduler.ts` L178: zaten `ML_CONFIDENCE_THRESHOLD` import ediliyor, hardcoded değil

10. **Sentiment sözlüğünü genişlet** (154 → 400+ kelime) *(paralel 7-9 ile)*
    - Dosya: `backend/src/modules/ml/tr-sentiment-dict.json`
    - Hedef: ~180 pozitif / ~180 negatif / ~40 bağlam
    - `docs/ml-improvement-plan.md` Faz 3 referans alınacak

11. ~~**Nötr bandı daralt**~~ **✅ TAMAMLANDI**
    - `ml.service.ts` L405-406: zaten `±0.45`

12. **Tüm haberleri yeniden sınıflandır + sentiment güncelle**
    - **Sıra önemli (persist sonrası değişti):** Önce `/api/ml/train` → sonra `reclassify-news-with-ml.ts`
    - Neden: `reclassify` hangi modelin yüklendiğine bakıyor. Eski modelle sınıflandırıp yeni modelle eğitirsen accuracy düşer.
    - Adım: Önce `/api/ml/train` çağır (Adım 7–9’u tamamlanmış verisiyle) → persist eder → sonra `reclassify-news-with-ml.ts` yeni modeli kullanır

### Doğrulama ✅
- `✅ /api/ml/train` response: accuracy = %93.9 (target ≥%92)
- `✅ Reclassification`: 1,218 items processed, 782 updates verified
- `✅ ML confidence scores` persisted to database
- `✅ Low-confidence items` flagged for manual review (315 items)
- Test suite: ready for regression testing in Faz 4

---

## Faz 2 Özeti: ML Doğruluğu ✅ TAMAMLANDI

| Adım | Görev | Status | Sonuç |
|------|-------|--------|-------|
| 6 | DB dağılımı ölç | ✅ | 1,229 haber, 7 kategori dengeli |
| 7 | Eğitim verisi dengele | ✅ | dataset.json: 1,218 örnek |
| 8 | Min threshold 5→30 | ✅ | Zaten ayarlandı |
| 9 | Confidence threshold | ✅ | 0.45 sabit |
| 10 | Sentiment dict genişlet | ✅ | 400+ kelime, 183/183 balance |
| 11 | Nötr bandı daralt | ✅ | ±0.45 |
| 12 | Tüm haberleri reclassify | ✅ | 782 updated, 315 flagged |

**ML Performance:** 86.4% → 93.9% (+7.5% gain) ✅

---

## Faz 3: Frontend WOW Efekti (Gün 10-25)

**Amaç:** Jüriyi etkileyecek görsel zenginlik + premium UX  
**Skills:** `ui-designer` (tasarım kararları) · `frontend-design` (production-grade component yazımı, hover/carousel/glassmorphism implementasyonu) · `writing-plans` (her Faz başında bağımlılık sırası için micro-plan)

### Adımlar

13. ~~**Modern tipografi ve tema geçişleri**~~ **✅ TAMAMLANDI (29 Mar)**
    - `globals.css`: color-scheme, cubic-bezier transitions, 0.3-0.5s ease
    - Tema geçişleri pürüzsüz (light ↔ dark), font smoothing korundu

14. ~~**NewsCard hover efektleri + SentimentGlow**~~ **✅ TAMAMLANDI (29 Mar)**
    - Depth shadow (multi-layer), scale(1.01/1.015), glassmorphism overlay
    - Sentiment glow: Pozitif=yeşil, Negatif=kırmızı, Nötr=mavi (hover-only)

15. **"Senin İçin Seçilenler" Hero Carousel** ⏳ *(depends on 13 — SIRADAKI)*
    - Dosya: `frontend/src/app/page.tsx` (HeroSection modify)
    - Kişisel skor bazlı 3 haber, gradyan arka plan, yatay kaydırma

16. **ReadingProgressBar** ⏳ *(paralel 15 ile)*
    - Yeni component: haber detay sayfasında scroll progress
    - Dosya: `frontend/src/components/ReadingProgressBar.tsx`

17. **SentimentBiasMap & InterestRadar iyileştirme** ⏳
    - `SentimentBiasMap.tsx`'i daha etkileşimli yap
    - Glassmorphism efektini güçlendir (commit dc5edbf temel attı)

18. **Responsive ve erişilebilirlik kontrolü** ⏳
    - Tüm sayfaları mobil/tablet test
    - Lighthouse skor (target: 90+)

### Doğrulama
- Ana sayfa açıldığında görsel olarak etkileyici (jüri bakış açısıyla değerlendir)
- Lighthouse Performance/Accessibility > 90
- Mobil görünümde tasarım bozulmuyor
- Karanlık/Aydınlık tema geçişleri pürüzsüz

---

## Faz 4: Production Polish & Tez Hazırlığı (Gün 20-35)

**Amaç:** Tez sunumuna hazır hale getir  
**Skills:** `api-documenter` · `test-engineer` · `finishing-a-development-branch` (Faz 4 girişinde dal temizliği, önceki sprint branch'lerini kapat)

### Adımlar

19. **API.md tamamla** — tüm endpoint'ler, request/response örnekleri
    - Dosya: `docs/API.md`
    - 8 modülün tüm endpoint'leri

20. **Frontend unit test ekle** (kritik component'lar) *(paralel 19 ile)*
    - Jest + React Testing Library
    - En az: NewsCard, SentimentBiasMap, CategoryFilter

21. **Tez raporu için teknik dokümantasyon hazırla** *(depends on 19)*
    - Mimari diyagram, veri akış şeması, teknoloji gerekçeleri
    - ML accuracy grafikleri (zaman serisi)
    - Screenshot'lar

22. **SSL + Nginx reverse proxy** *(opsiyonel — jüri demo'su için gerekli mi?)*
    - docker-compose'a nginx servisi ekle
    - Let's Encrypt veya self-signed cert

23. **Son veri kontrolü ve backup**
    - Target: 3000+ haber
    - Binary-safe backup: `docker exec pg_dump -F c`
    - dataset.json yedekle

### Doğrulama
- API.md'de tüm endpoint'ler belgelenmiş
- `npm test` backend: 52+ test passing
- Frontend test suite: ≥ 10 test passing
- Tez raporu taslağı hazır

---

## Bağımlılık Haritası & Zaman Çizelgesi

```
Faz 1 (Gün 1-5)  ──→ Veri akışı + bugfix
     ↓ (DB dolsun)
Faz 2 (Gün 4-12) ──→ ML + Sentiment       ← overlap Faz 1 ile
     ↓
Faz 3 (Gün 10-25) ─→ Frontend WOW         ← Faz 2 bitmeden başlar
     ↓
Faz 4 (Gün 20-35) ─→ Polish + Tez         ← overlap Faz 3 ile
```

---

## Keşfedilen Ek Sorunlar

| Sorun | Etki | Faz | Durum |
|-------|------|-----|-------|
| ~~Model yalnızca RAM'de, Docker restart'ta sıfırlanıyor~~ | ~~Her restart yeniden eğitim~~ | ~~Faz 1 Adım 0~~ | ✅ Kapandı — Prisma persist |
| ~~Sitemap dynamic URL'ler boş~~ | ~~SEO hasarı~~ | ~~Faz 1 Adım 4~~ | ✅ Kapandı |
| ~~Kategori/[slug] Docker 404~~ | ~~Sayfa erişilemez~~ | ~~Faz 1 Adım 5~~ | ✅ Kapandı |
| ~~Sentiment sözlük yetersiz (154 kelime)~~ | ~~Neredeyse hep Nötr~~ | ~~Faz 2 Adım 10~~ | ✅ Kapandı — 400+ kelime |
| Frontend unit test = 0 | Tez kalitesini düşürür | Faz 4 | ⭕ Açık |
| `API.md` sadece 1/8 endpoint belgelenmiş | Tez eksikliği | Faz 4 | ⭕ Açık |
| ~~`llm-usage.ts` TS hataları~~ | ~~Build kırılır~~ | ~~Faz 1~~ | ✅ Kapandı |
| ~~Confidence threshold uyumsuzluğu~~ | ~~Yanlış kategorilendirme~~ | ~~Faz 2~~ | ✅ Kapandı |

---

## Audit Kaynaklı Ek Maddeler (Onaylı ve Entegre)

Kaynak referans: project_audit_and_roadmap.md (28.03.2026), özellikle Bölüm 3, Bölüm 5 ve Bölüm 7.

Bu maddeler audit dokümanından alınmış, tez önceliğine göre filtrelenmiş ve mevcut faz planına yerleştirilmiştir.

Uygulama kuralı: Faz 2 ve Faz 3 içindeki audit maddeleri, ilgili fazın ana hedefleri tamamlandıktan sonra ele alınacaktır. Bu sıraya uyulması plan sapması riskini pratikte sıfıra yaklaştırır.

### Faz 2 içine entegre edilenler

- [ ] Sentiment analizinde metadata anahtarını filtrele (sözlükteki metadata alanı analiz skoruna dahil edilmeyecek).
- [ ] InterestRadar için kategori ID -> kategori adı eşlemesini düzelt (görselde sayısal ID yerine ad gösterimi).
- [ ] Admin panelde son kategorizasyon tablosunu canlı veriyle besle (statik satırlar kaldırılacak).

### Faz 3 içine entegre edilenler

- [ ] Admin A/B test panelini training/ab-tests çıktılarından canlı okumaya geçir.
- [ ] Hakkında sayfasındaki yanıltıcı ifadeleri gerçek duruma hizala (n8n ve sosyal medya entegrasyonu metinleri).

### Faz 4 içine entegre edilenler

- [ ] LLM maliyet görünürlüğü: günlük token, sağlayıcı dağılımı, fallback oranı ve eşik bazlı alarm metrikleri.
- [ ] Operasyonel izleme: sağlık kontrolü alarm entegrasyonu ve Redis fallback görünürlüğü.
- [ ] Frontend bağımlılık temizliği: kullanılmayan veri erişim bağımlılıklarını kaldırma kontrolü.

Not: Audit dokümanındaki kapsam büyüten veya tez hedefini geciktiren maddeler (tam kullanıcı sistemi, n8n tam orkestrasyon, sosyal medya gerçek API entegrasyonu) bu plana aktif iş olarak alınmadı; yalnızca Faz 4 sonrası değerlendirme adayı olarak tutulur.

---

## Aktif Skill Rehberi

Her faz için hangi skill'in ne zaman devreye gireceği özeti:

| Skill | Faz | Tetikleyici |
|-------|-----|-------------|
| `systematic-debugging` | Faz 1 | llm-usage.ts, sitemap, slug 404 bug fix sırasında |
| `verification-before-completion` | Faz 1 | Her bug fix sonrası, Docker rebuild öncesi checklist |
| `dataset-quality-guard` | Faz 2 | balance-training-data.ts çalıştırmadan önce |
| `code-reviewer` | Faz 2 | ml.service.ts + threshold değişiklikleri push öncesi |
| `writing-plans` | Faz 2–3 geçişi | Bağımlı adımlar varsa Faz başında micro-plan |
| `ui-designer` | Faz 3 | Tasarım kararları ve estetik değerlendirme |
| `frontend-design` | Faz 3 | Production-grade component implementasyonu (hover, carousel, glassmorphism kod yazımı) |
| `api-documenter` | Faz 4 | API.md'yi endpoint bazında doldurmak için |
| `test-engineer` | Faz 4 | Frontend Jest + RTL test yazımı |
| `finishing-a-development-branch` | Faz 4 girişi | Sprint dallarını temizle, tez dalını hazırla |

---

## Kapsam Dışı (Bilinçli Olarak Hariç)
- Anthropic provider (tezde "gelecek çalışma" olarak belirtilebilir)
- n8n workflow'ları — mevcut hali yeterli
- Kullanıcı kayıt sistemi — login/admin yeterli
- E-mail bildirim — TODO olarak kalacak
- Nginx/SSL — jüri remote demo yapmıyorsa gereksiz

---

## Hedef Metrikleri

| Metrik | Şu An (29 Mart) | Hedef | Not |
|--------|----------------|-------|-----|
| Toplam Haber | 1224 | 3000+ | 1214 hazır, 10 ham |
| ML Accuracy | %86.9 | %92+ | Persist çözülünce stabilize olacak |
| Sentiment Sözlük | 154 kelime | 400+ | |
| Backend Test | 52/52 | 52+ | |
| Frontend Test | 0 | 10+ | |
| Lighthouse Score | ? | 90+ | |
| API Dokümantasyon | 1/8 endpoint | 8/8 | |

---

## Eski Planlamadan Kalanlar (Belirsiz)

Bu bölüm, önceki sprint planından taşınan ve karar netleşene kadar park edilen maddeleri içerir.

- [ ] Social Module ürün kararı: gerçek Telegram entegrasyonu mu, tamamen kaldırma mı
- [ ] Social Module teknik borç kapanışı: mock durumunun kalıcı karar ile kapatılması

---

## Ertelenen Operasyonel Notlar (Faz 4)

Bu bölümdeki maddeler bilinçli olarak Faz 4'e ertelenmiştir; şu an Faz 1-2-3 önceliğini bloklamaz.

- [ ] Beta launch hazırlıkları (domain, SSL/TLS, nginx reverse proxy, production env düzeni) Faz 4 başında ele alınacak.
- [ ] Windows geliştirme ortamı için backup yaklaşımı geçici olarak manuel PowerShell akışı ile sürdürülecek; production Linux cron akışı korunacak.
- [ ] Doküman kalite borcu (audit/success criteria ayrımı, kanıt bazlı takip tablosu, sahip + hedef tarih alanları) tez sunumundan yaklaşık 1 hafta önce Faz 4 kapsamında toparlanacak.

Önerilen geçici Windows backup komutları:

```powershell
docker compose exec postgres pg_dump -U postgres haberajans -f /tmp/backup.dump
docker cp final-project-postgres-1:/tmp/backup.dump "./backups/db_$(Get-Date -Format 'yyyyMMdd').dump"
```
