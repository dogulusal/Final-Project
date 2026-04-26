# NeuroFeed — Neon+Glass UI Redesign Spec

> **Tarih:** 2026-04-22  
> **Durum:** Onaylandı  
> **Yaklaşım:** Design Token + Incremental (Yaklaşım 2)  
> **Estetik:** Neon + Glass (Dark mode default)  
> **Layout:** Hero → Stats Bar → Grid (3 sütun, sidebar yok)

---

## 1. Bağlam

NeuroFeed (AI Haber Ajansı) jüri demosu/sunumu için frontend UI'ın "premium AI SaaS" estetiğine yükseltilmesi. Backend (ML pipeline, API, guard sistemi) değişmiyor. Sadece frontend değişikliği.

### Mevcut Stack
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4 + CSS Variables ("AntiGravity v3" tema)
- shadcn + Base UI React (primitives)
- Framer Motion (animasyon)
- Lucide React (ikonlar)
- next-themes (`.dark` class on `<html>`)
- Chartlar: Custom SVG (Recharts **yok**)

### Kararlar
| Karar | Seçim | Neden |
|-------|-------|-------|
| Estetik yönü | Neon + Glass | Fütüristik, "AI startup" hissi, jüri etkisi yüksek |
| Layout | Hero → Stats Bar → Grid(3col) | Dashboard-first, sidebar yok, veri ilk bakışta görünür |
| Yaklaşım | Design Token + Incremental | Her adım bağımsız deploy edilebilir, düşük risk |
| Chart kütüphanesi | Recharts | Custom SVG bakım maliyetini azaltır, tooltip/animasyon built-in |
| MagicUI | Kullanılmıyor | Mevcut Tailwind + Framer Motion yeterli |
| Spline (3D) | Kullanılmıyor | Performans maliyeti çok yüksek |
| Mobil StatsBar | 1 sütun stack | Yatay scroll sezgisel değil |

---

## 2. Adımlar

### S0 — Tema Altyapısı
**Risk:** Orta (global CSS değişikliği)  
**Dosyalar:** `globals.css`, `layout.tsx`, `ThemeProvider.tsx`

**Yapılacaklar:**
1. Mevcut `:root` ve `.dark` değişkenlerine dokunma
2. `.dark` altına neon renk değişkenleri ekle:
   ```css
   .dark {
     --neon-purple: #7c3aed;
     --neon-cyan: #06b6d4;
     --neon-glow-purple: rgba(124, 58, 237, 0.15);
     --neon-glow-cyan: rgba(6, 182, 212, 0.1);
     --bg-glass-dark: rgba(255, 255, 255, 0.03);
     --border-glass: rgba(255, 255, 255, 0.06);
   }
   ```
3. `defaultTheme: "dark"` yap (ThemeProvider.tsx)
4. `.glass-card` tanımla (26+ component'ta kullanılıyor ama tanımsız):
   ```css
   .glass-card {
     background: var(--bg-glass);
     backdrop-filter: blur(12px);
     -webkit-backdrop-filter: blur(12px);
     border: 1px solid var(--border-subtle);
     border-radius: 16px; /* --radius-lg @theme override ile 10px'e düşüyor, sabit kullan */
   }
   .dark .glass-card {
     background: var(--bg-glass-dark);
   }
   ```
   > **Not:** `--radius-lg` `:root`'ta 16px ama `@theme inline` bloğu 0.625rem'e override ediyor. `.glass-card`'da sabit 16px kullanılacak.
5. Yeni utility class'ları ekle:
   ```css
   .glass-panel {
     background: var(--bg-glass);
     backdrop-filter: blur(16px);
     -webkit-backdrop-filter: blur(16px);
     border: 1px solid var(--border-glass);
     border-radius: 16px;
     padding: 1.25rem;
   }
   .dark .glass-panel {
     background: var(--bg-glass-dark);
   }

   .neon-badge {
     display: inline-flex;
     align-items: center;
     gap: 0.25rem;
     padding: 0.25rem 0.75rem;
     font-size: 0.75rem;
     font-weight: 600;
     border-radius: 9999px;
     border: 1px solid var(--neon-purple);
     background: var(--neon-glow-purple);
     color: var(--neon-purple);
   }

   .mono {
     font-family: 'Fira Code', ui-monospace, SFMono-Regular, monospace;
     font-variant-numeric: tabular-nums;
   }

   .neon-border-beam {
     position: relative;
   }
   .neon-border-beam::after {
     content: '';
     position: absolute;
     bottom: 0; left: 0; right: 0;
     height: 1px;
     background: linear-gradient(90deg, transparent, var(--neon-purple), var(--neon-cyan), transparent);
     background-size: 200% 100%;
     animation: beam 4s linear infinite;
   }

   @keyframes beam {
     0%   { background-position: -100% 0; }
     100% { background-position: 100% 0; }
   }
   ```
6. `Fira Code` fontu ekle (`layout.tsx` Google Fonts, weight: 400..700 variable)
7. `@keyframes beam` animasyonu yukarıda tanımlı

**Performans notu:** `.glass-card` backdrop-filter 20+ kart grid'inde mobil performans riski taşır. News grid kartlarında `will-change: transform` ekle veya grid dışı scroll durumunda blur'u devre dışı bırak.

**Revert planı:** `.dark` override bloğunu sil + `defaultTheme: "system"` geri dön. Light mode hiç etkilenmez.

**Test:**
- [ ] Ana sayfa light mode — AntiGravity görünüm bozulmamış
- [ ] Ana sayfa dark mode — neon değişkenler aktif
- [ ] Admin paneli — `.glass-card` tanım sonrası layout bozulmamış
- [ ] Haber detay — metin okunabilirliği OK
- [ ] `.glass-card` kullanan 3-4 farklı component kontrol (tanım eklendikten sonra beklenmedik görsel değişiklik var mı?)

---

### S1 — Recharts + SentimentBiasMap Refactor
**Risk:** Düşük (bağımsız component)  
**Dosyalar:** `package.json`, `SentimentBiasMap.tsx`

**Yapılacaklar:**
1. `npm install recharts` (frontend)
2. `SentimentBiasMap.tsx` yeniden yazım — custom SVG → Recharts PieChart

**Component yapısı:**
```
SentimentBiasMap.tsx
├── fetch: GET /api/admin/sentiment-stats (değişmez)
├── loading: Skeleton (mevcut pattern)
├── error: fallback demo data (korunur)
└── render:
    ├── Recharts PieChart (donut)
    │   ├── data: [{name:'Pozitif', value:29, fill:'#22c55e'}, ...]
    │   ├── innerRadius={60}, outerRadius={85}
    │   ├── paddingAngle={2}, strokeWidth={0}
    │   └── Inner label: "BASKIN: Nötr %43"
    ├── Yüzde bar'ları (3 satır horizontal)
    └── Alt: "Gündem daha pozitif yönelimde · Güven %81"
```

**API contract (değişmiyor):**
```ts
GET /api/admin/sentiment-stats
→ { distribution: { Pozitif: {count, percentage}, ... }, confidence: {average, min, max}, totalArticles }
```

**Neon+Glass entegrasyonu:** `.glass-panel` container, dominant sentiment subtle glow, `.mono` yüzde değerleri.

**Not:** `innerRadius` Recharts'ta number olarak kullan (`{60}`), string kabul etmezse dökümantasyona bak.

**Test:**
- [ ] Donut chart 3 segment doğru yüzde
- [ ] Loading skeleton
- [ ] API error → fallback demo data
- [ ] Dark mode renk kontrastı

---

### S2 — StatsBar (Yeni Component) + Navbar Beam
**Risk:** Orta (yeni component + sayfa düzeni değişikliği)  
**Dosyalar:** yeni `StatsBar.tsx`, `page.tsx` (ana sayfa), `Navbar.tsx`

**StatsBar — 4 hücre:**

| Hücre | Veri Kaynağı | Gösterge |
|-------|-------------|----------|
| SentimentCell | `GET /api/admin/sentiment-stats` | Stacked horizontal bar (Recharts) + "Gündem +pozitif" |
| ModelCell | `GET /api/ml/status` | `%85.3` mono + "Combined Acc · v47" + gradient progress bar |
| TodayCell | `GET /api/news?status=hazir&limit=1` (totalPages × limit) | `127` mono + "haber işlendi" (delta yok, ilk iterasyon) |
| InterestCell | Client-side `useReadingHistory` hook | Mini radar veya "İlgi radarı" + kilit = KVKK onayı bekleniyor |

**API contracts:**
```ts
GET /api/ml/status  (public, auth gereksiz)
→ { success: true, data: { accuracy: number, model_type: string, trained_at: string, sample_count: number, accuracy_source: string }, timestamp: string }

GET /api/news?status=hazir&limit=1
→ { success: true, data: [...], totalPages: number }
// Toplam sayı = totalPages × pageSize(20)
```

**Fetch stratejisi:**
- Her hücre bağımsız fetch + bağımsız skeleton loader
- Bir endpoint fail → diğer 3 hücre etkilenmez
- Duygu + Model = server fetch, 60s cache
- İlgi = client-only hook

**Responsive:**
- `≥1024px`: 4 hücre yan yana
- `≥640px`: 2×2 grid
- `<640px`: 1 sütun stack

**Sayfa entegrasyonu (page.tsx):**
```
Mevcut:                    Yeni:
<HeroCarousel />          <HeroCarousel />
<SentimentBiasMap />  →   <StatsBar />
<InterestRadar />         <NewsFeed />
<NewsFeed />
```
Eski `SentimentBiasMap` ve `InterestRadar` silinmez — StatsBar'da küçültülmüş versiyonları kullanılır. Orijinaller admin/detay sayfasında kalabilir.

**page.tsx diff notu:** Mevcut layout `LazySection` wrapper + `lg:grid-cols-2` grid kullanıyor. `SentimentBiasMap` + `InterestRadar` sadece `activeCategory === "Tümü" && !search` koşulunda render ediliyor. Bu koşullu blok `<StatsBar />` ile değiştirilecek (koşul kaldırılacak — StatsBar her zaman görünür).

**Navbar border beam:**
```css
.navbar-glass::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--neon-purple), var(--neon-cyan), transparent);
  background-size: 200% 100%;
  animation: beam 4s linear infinite;
}
```

**TodayCell veri notu:** Mevcut `GET /api/news` endpoint'i `totalCount` döndürmüyor — `totalPages` döndürüyor. Toplam haber sayısı `totalPages × pageSize` ile hesaplanacak. "↑14 vs dün" delta karşılaştırması ilk iterasyonda yok. Backlog'a bırakıldı.

**InterestCell kilit notu:** Kilit ikonu = KVKK onayı verilmemiş anlamına gelir. Kullanıcı onay verdiyse mini radar gösterilir, vermediyse "İlgi radarı — KVKK onayı gerekli" + kilit ikonu.

**Test:**
- [ ] 4 hücre render, bağımsız skeleton'lar
- [ ] Bir endpoint fail → diğer 3 hücre düzgün
- [ ] Model hücresi gerçek v47 verisi
- [ ] Mobilde 1 sütun stack doğru
- [ ] Navbar beam animasyonu smooth

---

### S3 — NewsCard Neon+Glass Stil
**Risk:** Düşük (CSS-only, logic değişmiyor)  
**Dosyalar:** `NewsCard.tsx`

**Değişiklikler:**

| Alan | Mevcut | Yeni |
|------|--------|------|
| Container | `bg-white dark:bg-[#1d1f2e]` | `.glass-panel` (`.news-card` mevcut hover/shadow/glow efektleri korunur) |
| Kategori badge | Düz renkli span | `.neon-badge` |
| Confidence skoru | Gösterilmiyor | `.mono` + confidence band indicator |
| Confidence band | Yok | LOW → amber dot, MEDIUM → sarı, HIGH → yeşil |
| Guard override | Yok | `guardOverride` varsa küçük kalkan ikonu (🛡️) |
| Border | `border-subtle` | Sentiment glow korunur |
| Görsel overlay | Yok | Alt kısım gradient fade |

**confidenceBand & guardOverride entegrasyonu:**

Bu alanlar backend `CategoryResult`'ta runtime'da hesaplanıyor ama DB'ye persist edilmiyor ve frontend `NewsItem` type'ına henüz eklenmemiş.

**Gerekli backend değişiklik:** Haber kategorize edilirken `confidenceBand` ve `guardOverride` değerleri `haberler` tablosuna yazılmalı VEYA API response'a dahil edilmeli.

**Önerilen yaklaşım (minimal):**
1. `NewsItem` type'ına ekle: `confidenceBand?: 'HIGH' | 'MEDIUM' | 'LOW'` ve `guardOverride?: string | null`
2. Backend `GET /api/news` response'unda bu alanları dahil et (mevcut `ml_confidence`'tan band hesapla)
3. NewsCard'da göster:
   - Confidence satırı: `<span class="mono">%{confidence}</span>` + renkli dot (HIGH=yeşil, MEDIUM=sarı, LOW=amber)
   - LOW band'li kartlarda: border'a `border-amber-500/30` ek class → "bu haberin güveni düşük" sinyali
   - `guardOverride` varsa: 🛡️ ikonu + tooltip "Guard sistemi kategoriyi düzeltti: {orijinal} → {yeni}"

> **Jüri değeri:** LOW band kartlarının görsel farkı + guard kalkan ikonu, ML pipeline'ın karar sürecini kullanıcıya şeffaf kılar.

**Görsel gradient overlay:**
```tsx
<div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-card)] via-transparent to-transparent opacity-60" />
```

**Değişmeyen:** Bullet point logic, reading history recording, click/navigation, responsive grid.

**Test:**
- [ ] Light → dark toggle doğru
- [ ] Confidence monospace hizalı + band dot doğru renk
- [ ] LOW band kart border amber glow
- [ ] Guard override kalkan ikonu + tooltip
- [ ] 7 kategori badge renkleri doğru
- [ ] Hover bullet popover kırılmamış
- [ ] Sentiment glow border hâlâ çalışıyor

---

### S4 — HeroCarousel Neon+Glass
**Risk:** Orta (layout değişikliği)  
**Dosyalar:** `HeroCarousel.tsx`

**Değişiklikler:**

| Alan | Mevcut | Yeni |
|------|--------|------|
| Arka plan overlay | Düz kategori gradient | Mesh gradient + kategori tonu |
| Kategori badge | Düz pill | `.neon-badge` + pulse glow |
| Confidence badge | Normal font | `.mono` + glass background |
| Navigation okları | Yarı saydam yuvarlak | Glass circle + neon border |
| Dot indicators | Düz beyaz/gri | Aktif = neon-purple |
| "Otomatik" label | Düz text | Glass pill + yeşil dot |

**Mesh gradient:**
```tsx
<div className="absolute top-8 right-12 w-32 h-32 rounded-full opacity-20 blur-3xl"
     style={{ background: `radial-gradient(circle, var(--neon-purple), transparent)` }} />
```

**Değişmeyen:** Auto-play logic, 5s interval, swipe handling, responsive.

**Test:**
- [ ] 5 slide geçişi smooth
- [ ] Mesh gradient mobilde performans OK
- [ ] "Haberi Oku" butonu link doğru
- [ ] Dot indicator aktif state doğru

---

### S3.5 — Unsplash Görsel Yükseltmesi (Quick Win)
**Risk:** Düşük (utility fonksiyon swap)  
**Dosyalar:** `newsImage.ts`, `NewsCard.tsx`, `HeroCarousel.tsx`

**Bağlam:** `getNewsImageUnsplash()` fonksiyonu zaten yazılmış ama aktif değil. Mevcut `getNewsImage()` picsum.photos kullanıyor (rastgele, konu dışı görseller). Unsplash kategori bazlı arama yapıyor ("technology,computer,ai" gibi) — jüri demosunda görsel kalitesi büyük fark yaratır.

**Yapılacaklar:**
1. `getNewsImage()` fallback'ini picsum → Unsplash'a çevir (mevcut `getNewsImageUnsplash` fonksiyonunu aktive et)
2. Unsplash hardcoded URL filtresi koru (`includes("unsplash.com")` → sadece tek bir placeholder URL'i filtrele, kategori bazlı Unsplash URL'lerini kabul et)
3. `CATEGORY_QUERIES` map'ini doğrula — 7 kategori cover ediliyor mu?
4. `NewsCard.tsx`'a görsel ekle (şu an kart'ta resim yok — kategori bazlı Unsplash görseli ekle)

**Not:** `source.unsplash.com` rate limit'i var (~50 req/hr free). Jüri demosu için yeterli ama production'da cache gerekir (backlog).

**Test:**
- [ ] Her 7 kategori için farklı görsel dönüyor
- [ ] Mevcut `gorselUrl`'li haberler kendi görselini kullanıyor
- [ ] Placeholder Unsplash URL filtreleniyor
- [ ] NewsCard'da görsel doğru render ediliyor

---

### S4.5 — "Wow Factor" Layer
**Risk:** Düşük-Orta (CSS-only + tipografi değişikliği)  
**Dosyalar:** `HeroCarousel.tsx`, `globals.css`, `page.tsx`/`layout.tsx`

**Referans:** Robotix (full-viewport hero, 3D orb, floating dots) + Framer (devasa display font, negatif alan)

**Değişiklikler:**

| Alan | Mevcut | Yeni |
|------|--------|------|
| Hero yüksekliği | `h-[500px] md:h-[600px]` | `h-[85vh] md:h-screen` |
| Hero başlık | `text-2xl md:text-4xl` | `text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-serif` |
| Sağ taraf | Boş / overlay | Animated gradient orb (CSS-only, blur-40px, float animasyonu) |
| Arka plan | Düz gradient | Dot pattern overlay (CSS radial-gradient, fixed, mask-image fade) |

**Animated Gradient Orb (Spline/Three.js yerine):**
```tsx
<div className="absolute right-[-5%] top-[10%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] pointer-events-none">
  <div className="w-full h-full rounded-full animate-orb-float"
    style={{ background: 'radial-gradient(...var(--neon-purple)...var(--neon-cyan)...)', filter: 'blur(40px)' }} />
</div>
```

**Dot Pattern:**
```css
.dot-pattern {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background-image: radial-gradient(circle, rgba(124,58,237,0.15) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
}
```

**Değişmeyen:** Auto-play logic, swipe, slide geçişleri.

**Test:**
- [ ] Hero tam viewport yüksekliğinde, scroll ile StatsBar görünüyor
- [ ] Başlık devasa serif font, mobilde okunabilir
- [ ] Gradient orb subtle float animasyonu
- [ ] Dot pattern 60fps scroll, mobilde jank yok
- [ ] Light mode: dot pattern görünmüyor veya çok subtle

---

## 3. Bonus (Vakit Kalırsa)

### S5 — InterestRadar Session Profil
- KVKK onayı olmadan `sessionStorage` ile anonim geçici profil
- Recharts RadarChart ile yeniden yazım
- Boş state iyileştirme ("3 haber oku" yerine daha bilgilendirici UI)

### S6 — Duygu Haritası Kategori Breakdown
- Backend: `GET /api/admin/sentiment-stats?byCategory=true` (GROUP BY kategori_id)
- Frontend: Recharts BarChart, kategori bazlı Pozitif/Nötr/Negatif
- "Siyaset %60 negatif, Teknoloji %70 pozitif" gibi bilgi

---

## 4. Bağımlılık Grafiği

```
S0 (Tema) ──► S1 (Recharts) ──► S2 (StatsBar)
    │                               │
    ├──► S3 (NewsCard) ──► S3.5 (Unsplash Quick Win)
    │                               │
    └──► S4 (HeroCarousel) ──► S4.5 (Wow Factor: full-hero + orb + dots)
                                    │
                                    ├──► S5 (InterestRadar, bonus)
                                    └──► S6 (Duygu breakdown, bonus)
```

S0 tüm adımların önkoşulu. S1 S2'den önce (StatsBar Recharts kullanır). S3 ve S4 bağımsız, paralel yapılabilir. S3.5 S3'ten sonra (NewsCard image alanı gerekli). S4.5 S4'ten sonra (hero zaten S4'te dokunuluyor).

---

## 5. Yeni Bağımlılıklar

| Paket | Neden | Boyut |
|-------|-------|-------|
| `recharts` | Chart'lar (PieChart, BarChart, RadarChart) | ~45KB gzip / ~200KB parsed |
| Google Font: `Fira Code` | Monospace rakamlar | ~15KB (variable) |

MagicUI, ReactBits, Spline **eklenmeyecek**.

---

## 6. Risk Matrisi

| Risk | Olasılık | Etki | Mitigasyon |
|------|----------|------|------------|
| `.glass-card` tanımı 26 component'ta beklenmedik görsel | Orta | Orta | S0'da 3-4 component manual kontrol |
| `backdrop-filter` mobilde yavaş | Orta | Düşük | News grid kartlarında `will-change: transform`, above-fold dışı lazy |
| Recharts bundle size artışı | Düşük | Düşük | Tree-shake, sadece PieChart/BarChart import |
| Dark mode default — light mode kırılması | Düşük | Yüksek | Mevcut `:root` değişkenlerine dokunma |
| S2 StatsBar 4 fetch — waterfall | Orta | Düşük | Paralel fetch + bağımsız skeleton |

---

## 7. Backlog (Bu Spec Dışı)

| # | İtem | Kaynak |
|---|------|--------|
| B1 | ML Train async job queue (LR ~30dk timeout) | [roadmap.md](../../roadmap.md) |
| B2 | TodayCell "vs dün" delta karşılaştırması | S2 tasarım notu |
| B3 | Unsplash production cache (rate limit koruması) | S3.5 production follow-up |
