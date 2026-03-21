# ML & Haber Kalitesi İyileştirme Planı

> **Kapsam:** RSS haber akışı limitlerini açmak, ML kategorilendirme doğruluğunu artırmak ve sentiment sözlüğünü genişletmek.
> **Tarih:** 2026-03-21
> **Bağımlılık:** P1–P10 roadmap tamamlandı, sistem gerçek veriyle çalışıyor.

---

## Özet: 3 Sorunun Kök Nedeni

| # | Sorun | Kök Neden |
|---|-------|-----------|
| 1 | Sayfada çok az haber görünüyor | `Math.min(feed.items.length, **5**)` — kaynak başına yalnızca 5 haber işleniyor |
| 2 | Yanlış kategorilendirme | ~205 eğitim örneği, Siyaset+Ekonomi = %64 sınıf dengesizliği, `ML_CONFIDENCE_THRESHOLD` uyumsuzluğu |
| 3 | Haber sentimenti hep "Nötr" | 154 kelimelik sözlük, %65 negatif bias, ±0.65 nötr bandı çok geniş |

---

## Faz 1 — Haber Akışını Açma

**Öncelik:** Kritik · **Risk:** Düşük (dedup + kalite filtresi koruma sağlıyor)

### Bağlam

RSS scheduler döngüsü şu anda 32 kaynak × 5 haber = max **160 aday/döngü** işleyebiliyor.
Kalite filtresi (~%30 düşürür) ve dedup (~%50 düşürür) sonrası sayfaya yalnızca **5–15 yeni haber/döngü** ulaşıyor.

### Değişiklikler

**1.1 — Kaynak başına haber limiti artır**
- Dosya: `backend/src/modules/rss/rss-scheduler.ts` (L154)
- Mevcut: `Math.min(feed.items.length, 5)`
- Hedef: `Math.min(feed.items.length, 15)`
- Etki: 32 × 15 = 480 aday/döngü → beklenen yeni haber: 30–60/döngü

**1.2 — Dedup pencere boyutunu genişlet**
- Dosya: `backend/src/config/constants.ts` (L51)
- Mevcut: `DEDUP_WINDOW_SIZE = 50`
- Hedef: `DEDUP_WINDOW_SIZE = 200`
- Neden: 480 adayı 50 başlıklık pencerenin gözden geçirmesi yetersiz; eski duplikatları kaçırır

### Doğrulama
Scheduler'ı 1 döngü çalıştır:
```
[Scheduler] Döngü bitti. Bu döngüde eklenen: X
```
**Hedef:** X > 20 (önceki: 5–15)

---

## Faz 2 — ML Kategorilendirme Kalitesi

**Öncelik:** Yüksek · **Bağımlılık:** Faz 1'den sonra DB dolunca daha kaliteli eğitim verisi çıkar

### Bağlam

| Metadata | Değer |
|----------|-------|
| Eğitim veri dosyası | `training/naive-bayes/dataset.json` |
| Toplam örnek | ~205 |
| Siyaset + Ekonomi payı | %64 |
| Spor payı | %8 |
| Dünya payı | %4 |
| Genel payı | %0 |
| RSS kaynak dağılımı | Siyaset: 7 feed, Sağlık: 3 feed |
| `ML_CONFIDENCE_THRESHOLD` (constants.ts L68) | 0.60 |
| `ML_THRESHOLD_CONFIDENCE` (rss-scheduler.ts L178) | 0.40 (hardcoded — uyumsuzluk) |

### Değişiklikler

**2.1 — DB dağılımını ölç (ÖNCELİKLE YAPILMASI ZORUNLU)**

Herhangi bir upsampling veya script yazmadan önce şu sorguyu çalıştırın ve sonucu kaydedin:

```sql
SELECT k.ad, COUNT(h.id) AS count
FROM haberler h
JOIN kategoriler k ON h.kategori_id = k.id
GROUP BY k.ad
ORDER BY count DESC;
```

> ⚠️ **Bu adım atlanamaz.** Upsampling stratejisi (kaç kategori, kaç örnek, hangi teknik) bu sorgunun çıktısına göre şekillenecek. Körlemecine yazmayın.

**2.2 — Eğitim verisi dengeleme scripti**
- Script: `backend/scripts/balance-training-data.ts` (yeni)
- Akış: DB'den `durum='hazir'` haberleri çek → 2.1'deki dağılıma göre az temsil edilen kategorileri upsampling ile dengele → min 50 örnek/kategori hedefle → `dataset.json`'a kaydet
- Mevcut bağlam (bu döküman yazılırken bilinen dağılım): ~205 örnek, Siyaset+Ekonomi %64, Spor %8, Dünya %4, Genel %0. Bu verilerle script başlangıç parametreleri belirlenebilir — **ancak 2.1 sorgusu çalıştırılarak güncel DB dağılımı doğrulanmalı**, çünkü Faz 1 tamamlandıktan sonra DB dolmuş olacak ve oranlar değişmiş olabilir. Sorguyu gördükten sonra upsampling hedef sayılarını netleştirin.

**2.3 — ML eğitim minimum eşiğini yükselt**
- Dosya: `backend/src/modules/ml/ml.service.ts` (L57)
- Mevcut: `if (dataset.length < 5)`
- Hedef: `if (dataset.length < 30)`
- Neden: 5 örnekle eğitilen model matematiksel olarak güvenilmez

**2.4 — Kategori başına minimum örnek kontrolü**
- `train()` fonksiyonuna ek guard: her kategoride min 3 örnek yoksa o kategoriyi sessizce atla ve logla
- Sıfır örnekli kategori (örn: "Genel") Naive Bayes'in prior hesabını bozar

**2.5 — Confidence threshold uyumsuzluğunu gider**
- `ML_CONFIDENCE_THRESHOLD` şu anda iki farklı değerde tanımlı:
  - `constants.ts` L68: **0.60**
  - `rss-scheduler.ts` L178: **0.40** (hardcoded `ML_THRESHOLD_CONFIDENCE`)
- Değişiklik: scheduler'daki hardcoded değeri kaldır, `ML_CONFIDENCE_THRESHOLD` constants'tan import et
- Hedef değer: **0.45** (düşük confidence = RSS kaynağının varsayılan kategorisine düş)

### Doğrulama
- Admin panelinden `mlAccuracy` değerini oku — hedef: **%60+** (ilk iterasyon)
  > Not: %60 kasıtlı olarak düşük tutulmuştur. Az veri + sınıf dengesizliği koşullarında gerçekçi bir başlangıç eşiğidir. %62 çıkarsa başarısız değil, beklenendedir. Faz 1 tamamlanıp DB dolunca 2. iterasyonda **%75+** hedeflenir.
- Manuel test: `categorize("Fenerbahçe golcüsü transfer")` → "Spor" dönmeli
- Manuel test: `categorize("Merkez bankası faiz kararı")` → "Ekonomi" dönmeli

---

## Faz 3 — Sentiment Sözlüğü Genişletme

**Öncelik:** Orta-Yüksek · **Bağımlılık:** Yok — Faz 1/2 ile paralel yapılabilir

### Bağlam

| Metadata | Değer |
|----------|-------|
| Sözlük | `backend/src/modules/ml/tr-sentiment-dict.json` |
| Toplam kelime | 154 (+ `_metadata` key, ML'e dahil edilmez) |
| Pozitif kelimeler | 54 (%35) |
| Negatif kelimeler | 84 (%65) → **negatif bias** |
| Nötr bant | ±0.65 → çok geniş, haberler kolayca "Nötr"e düşüyor |
| Kök eşleşme | İlk 6 karakter |
| Mevcut script | `backend/scripts/expand-sentiment-dict.ts` (referans alınabilir) |

### Değişiklikler

**3.1 — Sözlüğü 400+ kelimeye genişlet**
- Dosya: `backend/src/modules/ml/tr-sentiment-dict.json`
- Hedef dağılım: ~180 pozitif / ~180 negatif / ~40 bağlam (±1)
- Öncelikli eklenmesi gereken kelime grupları:

| Alan | Pozitif | Negatif |
|------|---------|---------|
| Ekonomi | büyüme(+2), istihdam(+2), toparlanma(+2), ihracat(+2) | enflasyon(-2), işsizlik(-3), resesyon(-4), daralma(-3) |
| Spor | galibiyet(+3), şampiyonluk(+5), transfer(+1) | yenilgi(-3), sakatlık(-2), küme düşme(-4) |
| Siyaset | anlaşma(+2), uzlaşı(+2), reform(+3) | gerilim(-3), ambargo(-3), yaptırım(-3) |
| Genel | gelişme(+2), ilerleme(+2), rekor(+3) | çökme(-4), patlama(-3), felaket(-5) |

> Not: **Sağlık** ve **Dünya** kategorileri bu tabloda yer almıyor. Eğitim verisindeki payları düşük (%4 Dünya) olsa da sentiment kelime grupları ayrı bir iterasyonda eklenecek (örn: Sağlık: iyileşme(+3), salgın(-4), tedavi(+2); Dünya: barış(+4), çatışma(-4), müzakere(+2)).

**3.2 — Nötr bandı daralt**
- Dosya: `backend/src/modules/ml/ml.service.ts` — sentiment threshold sabitleri
- Mevcut: pozitif > 0.65, negatif < -0.65
- Hedef: pozitif > **0.45**, negatif < **-0.45**
- Etki: Daha az haber "Nötr"e düşer; Sentiment haritasındaki çeşitlilik artar

**3.3 — Yeni birim testleri**
- Dosya: `backend/src/__tests__/ml.service.test.ts`
- Mevcut 4 sentiment testine 4 ek test ekle:
  - Ekonomi jargonu: "Borsa çöktü, ekonomi krizde" → Negatif
  - Spor haberi: "Türkiye Dünya Kupası'na katıldı" → Pozitif
  - Nötr meclis: "Meclis toplandı, gündem görüşüldü" → Nötr
  - Bağlam bağımlı: değil+pozitif kelime → Negatif (negasyon testi)

### Doğrulama
- Mevcut 4 sentiment testi hala geçmeli (regresyon yok)
- Yeni 4 test de geçmeli
- Ana sayfada Sentiment haritası: Pozitif/Negatif/Nötr oranları görsel olarak dengeli

---

## Bağımlılık Haritası ve Sıralama

```
Faz 1 (Haber Akışı) ──────────→ bağımsız, ilk yapılmalı
      ↓ (1-2 döngü bekle, DB dolsun)
Faz 2 (ML Kategorilendirme) ──→ Faz 1 sonrası daha kaliteli eğitim verisi
Faz 3 (Sentiment) ─────────────→ Faz 1/2 ile paralel çalışabilir
```

**Önerilen uygulama sırası:** Faz 1 → bekle → Faz 3 (Faz 2 için DB dolduktan sonra).

---

## İkinci İterasyon Tetikleyicileri

"1-2 döngü bekle" ifadesi kasıtlı olarak belirsiz bırakılmıştır; DB dolmadan Faz 2 çalıştırmak upsampling'i anlamsız kılar. Aşağıdaki iki koşulun **ikisi birden** sağlandığında Faz 2'ye geçilebilir:

| Koşul | Eşik | Nasıl ölçülür |
|-------|------|----------------|
| Toplam `durum='hazir'` haber sayısı | **≥ 300** | `SELECT COUNT(*) FROM haberler WHERE durum='hazir'` |
| En az 3 farklı kategoride haber yoğunluğu | **Her birinde ≥ 30** | 2.1'deki dağılım sorgusu |

> **Neden bu eşikler?** 300 haber × %80 train = 240 eğitim örneği → 7 kategori için ortalama ~34/kategori. Bu, Naive Bayes'in anlamlı prior tahmini yapabildiği minimum seviyedir. 3 kategoride 30+ koşulu ise en azından model çekirdeğinin sağlam olmasını garanti eder; geri kalan kategoriler upsampling ile desteklenir.

> **10 dakikalık döngüde kaç haber girer?** Faz 1 sonrası beklenen: 30–60/döngü. 300 habere ulaşmak teorik olarak **5–10 döngü = 50–100 dakika**. Ancak dedup, kalite filtresi ve LLM kotası gerçek sayıyı azaltır — pratikte 2–4 saat beklemek daha gerçekçidir.

---

## Toplam Doğrulama Suite'i (3 Faz Tamamlandıktan Sonra)

```bash
# 1. Haber döngüsü kontrolü (backend logları)
# Hedef: "Bu döngüde eklenen: X" — X > 20

# 2. Full test suite
cd backend && npx jest --no-coverage --forceExit
# Hedef: 38+ test geçmeli (34 mevcut + 4 yeni sentiment)

# 3. TypeScript
npx tsc --noEmit
# Hedef: 0 hata

# 4. Frontend lint
cd ../frontend && npm run lint
# Hedef: 0 hata, 0 uyarı

# 5. Admin panelinden manuel kontrol
# mlAccuracy → %60+ hedef
# Sentiment haritasında 3 renk görünüyor olmalı (hep Nötr değil)
```

---

## Kapsam Dışı

Aşağıdakiler bu plana dahil **değildir** — ayrı bir oturumda ele alınabilir:

- LLM hibrit sentiment (vizyon haritasında mevcut, önce sözlük genişletilsin)
- Kullanıcı sistemi / JWT auth (`Kullanici` şemada var, implemente edilmemiş)
- RSS kaynak sayısını artırmak (32 kaynak yeterli — sorun kaynak değil, item limiti)
- SocialService'i gerçek API'ye bağlamak (Mock olarak çalışıyor)
- **Naive Bayes çıkış stratejisi:** 3 iterasyon (Faz 1 + 2 tam uygulandıktan ve DB en az 500 haber içerdikten) sonra `mlAccuracy` hâlâ %70'in altında kalırsa, Naive Bayes'in bu veri boyutu ve kategori karmaşıklığı için yetersiz kaldığı kabul edilir. Bu noktada transformer tabanlı bir model (örn: [BERTurk](https://github.com/stefan-it/turkish-bert) fine-tune) değerlendirmesi gündeme alınır. Bu karar veri olmadan verilemez — ölçmeden geçilmez.

---

## İlgili Dosyalar (Hızlı Referans)

| Dosya | Faz | Konu |
|-------|-----|------|
| `backend/src/modules/rss/rss-scheduler.ts` L154 | 1 | Items-per-feed limiti |
| `backend/src/config/constants.ts` L50–51 | 1 | DEDUP_WINDOW_SIZE |
| `backend/src/config/constants.ts` L68 | 2 | ML_CONFIDENCE_THRESHOLD |
| `backend/src/modules/rss/rss-scheduler.ts` L178 | 2 | Hardcoded threshold (uyumsuzluk) |
| `backend/src/modules/ml/ml.service.ts` L57 | 2 | Min training data |
| `backend/src/modules/ml/ml.service.ts` — sentiment thresholds | 3 | ±0.65 nötr bant |
| `backend/src/modules/ml/tr-sentiment-dict.json` | 3 | Sözlük dosyası |
| `training/naive-bayes/dataset.json` | 2 | Eğitim verisi (~205 örnek) |
| `backend/scripts/expand-sentiment-dict.ts` | 3 | Mevcut genişletme scripti (referans) |
| `backend/src/__tests__/ml.service.test.ts` | 3 | Yeni testler eklenecek |
