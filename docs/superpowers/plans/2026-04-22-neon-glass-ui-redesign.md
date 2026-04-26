# Neon+Glass UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform NeuroFeed frontend from basic AntiGravity theme to premium Neon+Glass dark-mode aesthetic for jury demo.

**Architecture:** Incremental design-token approach — S0 (CSS foundation) → S1 (Recharts) → S2 (StatsBar) → S3 (NewsCard + guard UI) → S3.5 (Unsplash) → S4 (HeroCarousel) → S4.5 (Wow Factor: full-viewport hero, gradient orb, dot pattern). Each step independently deployable, all build on S0 tokens.

**Tech Stack:** Next.js 16 + React 19 + Tailwind CSS 4 + Recharts (new) + Framer Motion 12 + Fira Code font (new)

**Spec:** [`docs/superpowers/specs/2026-04-22-neurofeed-neon-glass-ui-design.md`](../specs/2026-04-22-neurofeed-neon-glass-ui-design.md)

**Skills & Workflows Integration:**

| Gate Point | Skill/Workflow | Tetikleme Anı |
|---|---|---|
| Her S adımı component değişikliği | `@ui-designer` | Neon+Glass estetik, responsive breakpoint doğrulama |
| Her S adımı test yazımı | `@test-engineer` | Test case üretimi + coverage gap analizi |
| Her S adımı tamamlanınca | `@verification-before-completion` | Fresh build/test evidence |
| S0 globals.css sonrası | `@code-reviewer` | Global CSS riski en yüksek adım |
| S2 StatsBar sonrası | `@code-reviewer` | Paralel fetch pattern review |
| S3 sonrası | `@performance-profiler` | backdrop-filter mobil performans |
| Tüm S0-S4 tamamlanınca | `@comprehensive-review` workflow | Demo öncesi son gate |
| Her S sonrası | `@deploy` workflow (docker compose) | Bağımsız deploy doğrulama |
| Deploy sonrası | `@health-check` workflow | Sistem sağlık kontrolü |
| S4 tamamlanınca | `@finishing-a-development-branch` | Branch entegrasyonu |

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `frontend/src/components/StatsBar.tsx` | S2: 4-cell stats dashboard bar |
| `frontend/src/components/stats/SentimentCell.tsx` | S2: Mini sentiment horizontal bar |
| `frontend/src/components/stats/ModelCell.tsx` | S2: ML model accuracy display |
| `frontend/src/components/stats/TodayCell.tsx` | S2: Today's processed news count |
| `frontend/src/components/stats/InterestCell.tsx` | S2: Mini interest radar / KVKK lock |
| `frontend/src/utils/confidence.ts` | S3: Confidence band helper |

### Modified Files
| File | Changes |
|---|---|
| `frontend/src/app/globals.css` | S0: Neon variables + utility classes |
| `frontend/src/components/ThemeProvider.tsx` | S0: defaultTheme → "dark" |
| `frontend/src/app/layout.tsx` | S0: Add Fira Code font |
| `frontend/src/types/news.ts` | S3: Add confidenceBand, guardOverride |
| `frontend/src/components/SentimentBiasMap.tsx` | S1: Custom SVG → Recharts |
| `frontend/src/components/Navbar.tsx` | S2: Add neon-border-beam class |
| `frontend/src/app/page.tsx` | S2: Layout swap (LazySection → StatsBar) |
| `frontend/src/components/NewsCard.tsx` | S3: Glass-panel + confidence band + guard icon |
| `frontend/src/utils/newsImage.ts` | S3.5: Activate Unsplash fallback |
| `frontend/src/components/HeroCarousel.tsx` | S4: Mesh gradient + neon badges |
| `frontend/next.config.ts` | S3.5: remotePatterns for Unsplash images |

---

## Chunk 1: S0 — Tema Altyapısı

### Task 1.1: Neon CSS Değişkenleri + Utility Class'lar

**Files:**
- Modify: `frontend/src/app/globals.css:156` (after `.dark` closing brace — insert neon vars inside `.dark` block)
- Modify: `frontend/src/app/globals.css:536` (before `@theme inline` — insert utility classes)

- [ ] **Step 1: globals.css `.dark` bloğuna neon değişkenleri ekle**

Open `frontend/src/app/globals.css`. Inside the `.dark { }` block (starts ~line 97, closes ~line 156), just before the closing `}`, add:

```css
  /* --- Neon+Glass tokens (S0) --- */
  --neon-purple: #7c3aed;
  --neon-cyan: #06b6d4;
  --neon-glow-purple: rgba(124, 58, 237, 0.15);
  --neon-glow-cyan: rgba(6, 182, 212, 0.1);
  --bg-glass-dark: rgba(255, 255, 255, 0.03);
  --border-glass: rgba(255, 255, 255, 0.06);
```

- [ ] **Step 2: globals.css sonuna utility class'ları ekle**

After the last class block (before `@theme inline` around line 531), add:

```css
/* ═══════ Neon+Glass Utility Classes (S0) ═══════ */

.glass-card {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
}
.dark .glass-card {
  background: var(--bg-glass-dark);
}

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
  bottom: 0;
  left: 0;
  right: 0;
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

- [ ] **Step 3: Dev server başlat, dark mode'da değişkenleri doğrula**

Run: `cd frontend && npm run dev`

Open browser → DevTools → Elements → `<html class="dark">` → Computed → `--neon-purple` = `#7c3aed` görünmeli.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat(S0): add neon+glass CSS variables and utility classes"
```

---

### Task 1.2: ThemeProvider Dark Default + Fira Code Font

**Files:**
- Modify: `frontend/src/components/ThemeProvider.tsx:5`
- Modify: `frontend/src/app/layout.tsx:6,11-22`

- [ ] **Step 1: ThemeProvider defaultTheme → "dark"**

In `frontend/src/components/ThemeProvider.tsx` (line 5), change:

```tsx
// Before:
return <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>{children}</NextThemesProvider>;

// After:
return <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>{children}</NextThemesProvider>;
```

- [ ] **Step 2: layout.tsx'a Fira Code fontu ekle**

In `frontend/src/app/layout.tsx`, add Fira Code import alongside existing fonts:

```tsx
// Line 6 — add Fira_Code to import:
import { DM_Sans, DM_Serif_Display, Fira_Code } from "next/font/google";

// After dmSerifDisplay config (line 22), add:
const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-fira-code",
  display: "swap",
});
```

Then add `firaCode.variable` to the `<body>` className (alongside existing `dmSans.variable`, `dmSerifDisplay.variable`).

- [ ] **Step 3: Browser'da doğrula**

- Sayfayı aç → otomatik dark mode olmalı
- `.mono` class'lı herhangi bir element (henüz yok) → DevTools'ta font-family kontrol
- Light mode toggle hâlâ çalışıyor mu? (toggle butonu)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ThemeProvider.tsx frontend/src/app/layout.tsx
git commit -m "feat(S0): dark mode default + Fira Code font"
```

---

### Task 1.3: S0 Glass-Card Aktivasyon Testi

**Files:** Sadece browser testi — kod değişikliği yok

> **Kritik:** `.glass-card` 26+ component'ta kullanılıyor ama daha önce tanımsızdı. Şimdi tanım eklendi → beklenmedik görsel etkiler olabilir.

- [ ] **Step 1: Ana sayfa dark mode — genel görünüm**

Kontrol: card'lar backdrop-blur almış mı? Border doğru mu? Padding/margin kırılmamış mı?

- [ ] **Step 2: Admin paneli kontrol**

Navigate: `/admin` → login → Dashboard. `.glass-card` kullanan admin widget'lar bozulmamış mı?

- [ ] **Step 3: Haber detay sayfası kontrol**

Herhangi bir haber → `/haber/[slug]` → metin okunabilirliği, contrast, glass etkisi.

- [ ] **Step 4: Light mode geri dönüş testi**

Toggle → light mode: `:root` variables kullanılıyor, `.dark .glass-card` override aktif değil. AntiGravity görünüm korunmuş mu?

> 🔧 **Skill gate:** `@code-reviewer` — globals.css değişikliğini review et (en riskli adım).  
> 🔧 **Skill gate:** `@verification-before-completion` — fresh `npm run build` + 4 sayfa kontrol evidence.  
> 🚀 **Workflow:** `@deploy` — `docker compose up -d --build frontend` + `@health-check` çalıştır.

---

## Chunk 2: S1 — Recharts + SentimentBiasMap Refactor

### Task 2.1: Recharts Kurulumu

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Recharts kur**

```bash
cd frontend
npm install recharts
```

Expected: `package.json` → `"recharts": "^2.x.x"` eklendi.

- [ ] **Step 2: Build test**

```bash
npm run build
```

Expected: exit 0, no errors. Recharts tree-shake desteği var, unused import'lar bundle'a girmez.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat(S1): add recharts dependency"
```

---

### Task 2.2: SentimentBiasMap Recharts Refactor

**Files:**
- Modify: `frontend/src/components/SentimentBiasMap.tsx` (176 lines → tam yeniden yazım)

- [ ] **Step 1: Mevcut SentimentBiasMap.tsx'i yedekle**

```bash
cp frontend/src/components/SentimentBiasMap.tsx frontend/src/components/SentimentBiasMap.tsx.bak
```

- [ ] **Step 2: SentimentBiasMap.tsx'i Recharts PieChart ile yeniden yaz**

Tam component yapısı:
- `"use client"` directive
- `import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"`
- Mevcut API fetch logic'i koru (`GET /api/admin/sentiment-stats`)
- Mevcut loading skeleton pattern'i koru
- Mevcut error → demo fallback data pattern'i koru
- SVG circle + stroke-dasharray → `<PieChart>` + `<Pie innerRadius={60} outerRadius={85} paddingAngle={2} strokeWidth={0}>`
- Inner label: "BASKIN: Nötr %43" (dominant sentiment)
- Alt satır: horizontal progress bar'lar + `.mono` yüzde
- Container: `.glass-panel` class
- Renk map: Pozitif=#22c55e, Nötr=#eab308, Negatif=#ef4444

Korunacak davranışlar:
- Hover state → count/percentage toggle
- Trend text: "Gündem daha pozitif yönelimde"
- Confidence: "Güven %81" alt satır

- [ ] **Step 3: Browser'da doğrula**

- 3 segment donut chart render ediyor mu?
- Hover → segment highlight
- Loading skeleton gösteriyor mu?
- API error → demo data fallback çalışıyor mu?

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SentimentBiasMap.tsx
git commit -m "feat(S1): refactor SentimentBiasMap from custom SVG to Recharts PieChart"
```

> 🔧 **Skill gate:** `@ui-designer` — donut chart renk kontrastı, glass-panel entegrasyonu.  
> 🔧 **Skill gate:** `@verification-before-completion` — build + 3 test (render, error, dark mode).

---

## Chunk 3: S2 — StatsBar + Navbar Beam + Page Layout

### Task 3.1: StatsBar Alt-Component'lar

**Files:**
- Create: `frontend/src/components/stats/SentimentCell.tsx`
- Create: `frontend/src/components/stats/ModelCell.tsx`
- Create: `frontend/src/components/stats/TodayCell.tsx`
- Create: `frontend/src/components/stats/InterestCell.tsx`

- [ ] **Step 1: SentimentCell.tsx — mini horizontal stacked bar**

```
Props: none (kendi fetch'ini yapar)
Fetch: GET /api/admin/sentiment-stats
Render: Recharts stacked BarChart (horizontal) + "Gündem +pozitif" text
Loading: Skeleton pulse
Error: "—" fallback
Container: glass-panel, h-full
```

- [ ] **Step 2: ModelCell.tsx — ML accuracy + version**

```
Props: none (kendi fetch'ini yapar)
Fetch: GET /api/ml/status (public, no auth)
Render: "%85.3" .mono büyük + "Combined Acc · v47" alt text + gradient progress bar
Loading: Skeleton pulse
Error: "Model yükleniyor..." fallback
```

Response shape:
```ts
{ success: true, data: { accuracy: number, model_type: string, trained_at: string, sample_count: number } }
```

- [ ] **Step 3: TodayCell.tsx — processed news count**

```
Props: none (kendi fetch'ini yapar)
Fetch: GET /api/news?status=hazir&limit=1 → totalPages × 20
Render: "127" .mono büyük + "haber işlendi" alt text
Loading: Skeleton pulse
```

- [ ] **Step 4: InterestCell.tsx — reading interest / KVKK lock**

```
Props: none (useReadingHistory hook)
Render:
  - KVKK onay var → mini radar (static SVG veya text summary)
  - KVKK onay yok → 🔒 + "İlgi radarı — KVKK onayı gerekli"
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/stats/
git commit -m "feat(S2): add StatsBar cell components (Sentiment, Model, Today, Interest)"
```

---

### Task 3.2: StatsBar Container + Page Layout

**Files:**
- Create: `frontend/src/components/StatsBar.tsx`
- Modify: `frontend/src/app/page.tsx:194-198` (LazySection swap)

- [ ] **Step 1: StatsBar.tsx — 4-cell container**

```tsx
// Responsive grid:
// ≥1024px: grid-cols-4
// ≥640px: grid-cols-2
// <640px: grid-cols-1
// Container: glass-panel, full-width
// Each cell: independent fetch, independent skeleton
```

- [ ] **Step 2: page.tsx layout swap**

Replace the conditional block + `LazySection` block (around lines 220-228). **Önemli:** Mevcut kod `{activeCategory === "Tümü" && !search && (...)}` koşulu içinde. Bu koşulu kaldır — StatsBar her zaman görünür:

```tsx
// Before (koşullu blok içinde):
{activeCategory === "Tümü" && !search && (
  <LazySection minHeight="220px" className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
    <SentimentBiasMap apiUrl={process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"} />
    <InterestRadar />
  </LazySection>
)}

// After (koşulsuz):
<StatsBar />
```

Import ekle: `import StatsBar from "@/components/StatsBar";` (lazy import kaldır — StatsBar her zaman görünür).

SentimentBiasMap ve InterestRadar import'larını silme — admin sayfasında kullanılıyor olabilir. Sadece page.tsx'ten kaldır.

> **❗ Bilinen kısıtlama:** `SentimentCell` ve eski `SentimentBiasMap` aynı endpoint'i çekiyor (`GET /api/admin/sentiment-stats`). SentimentBiasMap page.tsx'ten kaldırıldığı için S2 deploy'unda double fetch olmaz. Ancak SentimentBiasMap hala admin sayfasında kalabilir — orada StatsBar yok, çakışma olmaz. Eğer ileride aynı sayfada ikisi birden görünürse, shared SWR cache veya React context ile deduplicate et.

- [ ] **Step 3: Browser'da doğrula**

- 4 hücre yan yana (desktop)
- Bir endpoint fail → diğer 3 hücre düzgün
- Model hücresi gerçek v47 verisi gösteriyor
- Mobilde 1 sütun stack

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/StatsBar.tsx frontend/src/app/page.tsx
git commit -m "feat(S2): add StatsBar component and replace LazySection in page layout"
```

---

### Task 3.3: Navbar Border Beam

**Files:**
- Modify: `frontend/src/components/Navbar.tsx:30`

- [ ] **Step 1: Navbar header'a neon-border-beam class'ı ekle**

In `Navbar.tsx` line 30, add `neon-border-beam` to the header className.

> **Not:** `motion.header` `sticky` pozisyonlama kullanıyor. `neon-border-beam` class'ı `position: relative` set ediyor — `sticky` bunu override eder, sorun değil. `::after` pseudo-element `bottom: 0` ile navbar altına yerleşir.

```tsx
// Before:
className="sticky top-0 z-50 w-full border-b border-[var(--border-subtle)]"

// After:
className="sticky top-0 z-50 w-full border-b border-[var(--border-subtle)] neon-border-beam"
```

`border-b` mevcut kalsın — beam efekti onun üzerine `::after` ile binecek.

- [ ] **Step 2: Browser'da doğrula**

- Navbar altında gradient beam animasyonu var mı?
- Scroll durumunda beam kaybolmuyor mu?
- Light mode'da da görünüyor (neon vars light'ta tanımsız → gradient transparan olacak, sorun değil)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Navbar.tsx
git commit -m "feat(S2): add neon border beam to navbar"
```

> 🔧 **Skill gate:** `@code-reviewer` — StatsBar paralel fetch pattern review.  
> 🔧 **Skill gate:** `@verification-before-completion` — build + 4 hücre render + mobil test.  
> 🚀 **Workflow:** `@deploy` + `@health-check` — backend API endpoint'leri sağlıklı mı?

---

## Chunk 4: S3 — NewsCard Neon+Glass + Guard UI

### Task 4.1: NewsItem Type Genişletme

**Files:**
- Modify: `frontend/src/types/news.ts:1-23`

- [ ] **Step 1: confidenceBand ve guardOverride ekle**

```tsx
export interface NewsItem {
  id: number;
  baslik: string;
  slug: string;
  metaAciklama: string | null;
  icerik: string | null;
  kategoriId: number;
  kaynakUrl: string | null;
  gorselUrl: string | null;
  sentiment: string | null;
  durum: string;
  mlConfidence: number | null;
  okumaSuresiDakika: number | null;
  yayinlanmaTarihi: string;
  goruntulemeSayisi: number;
  kategori: {
    id: number;
    ad: string;
    slug: string;
    renkKodu: string;
    ikon: string | null;
  };
  // S3: Guard system visibility
  confidenceBand?: 'HIGH' | 'MEDIUM' | 'LOW';
  guardOverride?: string | null;
}
```

- [ ] **Step 2: Backend API response'unda confidenceBand dahil et**

Backend'de `GET /api/news` response'unda `mlConfidence` zaten geliyor. Frontend'de band'ı hesapla (backend değişikliğine gerek kalmaz):

```ts
// utils/confidence.ts (yeni helper)
export function getConfidenceBand(confidence: number | null): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (!confidence) return 'LOW';
  if (confidence >= 0.85) return 'HIGH';   // backend ml.service.ts:1886 ile hizalı
  if (confidence >= 0.60) return 'MEDIUM';  // backend ml.service.ts:1888 ile hizalı
  return 'LOW';
}
```

> **Not:** Eşikler backend `categorize()` fonksiyonundaki band hesabıyla aynı (HIGH ≥ 0.85 + keyword hit, MEDIUM ≥ 0.60). Frontend'de keyword hit kontrolü yok, sadece confidence değerine bakarak basitleştirilmiş band hesaplanır.

> **Not:** `guardOverride` backend'den gelmiyor (runtime-only, DB'ye persist edilmiyor). İlk iterasyonda sadece `confidenceBand` göster. `guardOverride` için backend değişikliği gerekir → backlog'a ekle.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/news.ts frontend/src/utils/confidence.ts
git commit -m "feat(S3): extend NewsItem type with confidenceBand, add confidence helper"
```

---

### Task 4.2: NewsCard Glass Stil + Confidence Band UI

**Files:**
- Modify: `frontend/src/components/NewsCard.tsx`

- [ ] **Step 1: NewsCard container → glass-panel**

Line 56'daki `news-card` class'ına `glass-panel` ekle. Mevcut `news-card` CSS'i (hover/shadow/glow) korunsun:

```tsx
// Before:
className={`news-card group ... sentiment-glow-${sentiment}`}

// After:
className={`news-card glass-panel group ... sentiment-glow-${sentiment}`}
```

- [ ] **Step 2: Kategori badge → neon-badge**

Mevcut BADGE_MAP span'ını `neon-badge` class'ı ile değiştir. Kategori renk kodunu border-color'a bind et.

- [ ] **Step 3: Confidence band indicator ekle**

Footer bölgesine (veya kategori badge yanına):

```tsx
import { getConfidenceBand } from "@/utils/confidence";

// Inside component:
const band = getConfidenceBand(news.mlConfidence);
const bandColor = { HIGH: 'bg-green-500', MEDIUM: 'bg-yellow-500', LOW: 'bg-amber-500' }[band];

// Render (kategori badge yanında):
<span className="inline-flex items-center gap-1">
  <span className={`w-2 h-2 rounded-full ${bandColor}`} />
  <span className="mono text-xs opacity-70">%{Math.round((news.mlConfidence || 0) * 100)}</span>
</span>
```

- [ ] **Step 4: LOW band kartlarda amber border**

```tsx
// Container className'e ekle:
className={`... ${band === 'LOW' ? 'border-amber-500/30' : ''}`}
```

- [ ] **Step 5: Görsel gradient overlay (image alanı üzerine)**

NewsCard'da şu an resim yok — S3.5'te Unsplash eklendikten sonra overlay aktif olacak. Şimdilik CSS class'ı S0 utility class'ları yanına ekle (globals.css, neon utility bloku sonuna):

```css
/* globals.css'e eklenecek: */
.news-card-image-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, var(--bg-card), transparent);
  opacity: 0.6;
}
```

- [ ] **Step 6: Browser'da doğrula**

- Light → dark toggle doğru
- Confidence monospace + band dot doğru renk
- LOW band kartlarda amber border glow
- 7 kategori neon-badge renkleri
- Hover bullet popover kırılmamış
- Sentiment glow border hâlâ çalışıyor

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/NewsCard.tsx frontend/src/app/globals.css
git commit -m "feat(S3): NewsCard neon+glass style with confidence band indicator"
```

> 🔧 **Skill gate:** `@ui-designer` — neon-badge renk kontrastı, confidence dot boyutu.  
> 🔧 **Skill gate:** `@performance-profiler` — 20+ kart backdrop-filter mobil performans testi.  
> 🔧 **Skill gate:** `@verification-before-completion` — build + 7 test kontrol.

---

## Chunk 5: S3.5 — Unsplash Görsel Yükseltmesi (Quick Win)

### Task 5.1: newsImage.ts Unsplash Aktivasyonu

**Files:**
- Modify: `frontend/src/utils/newsImage.ts`

- [ ] **Step 1: getNewsImage() fallback'ini Unsplash'a çevir**

Mevcut `getNewsImage()` picsum.photos kullanıyor. `getNewsImageUnsplash()` zaten var ama kullanılıyor.

> **❗ Unsplash `source.unsplash.com` deprecated olabilir.** Eğer çalışmıyorsa picsum.photos'u koru ve Unsplash API key entegrasyonunu backlog'a ekle. Test et: `curl -I https://source.unsplash.com/800x450/?technology` — 302 redirect alıyorsa hala çalışıyor.

Mevcut `NewsItem` type'ını param olarak kullanmaya devam et (signature değiştirme):

```ts
import { NewsItem } from "@/types/news";

const CATEGORY_QUERIES: Record<string, string> = {
  'Teknoloji': 'technology,computer,ai',
  'Siyaset': 'politics,government,parliament',
  'Ekonomi': 'economy,finance,stock-market',
  'Spor': 'sports,football,stadium',
  'Sağlık': 'health,medicine,hospital',
  'Dünya': 'world,globe,international',
  'Genel': 'news,newspaper,media',
};

function isValidImageUrl(url: string): boolean {
  if (!url || url.length < 10) return false;
  if (url.includes('placeholder')) return false;
  if (url.includes('bbc.co.uk')) return false;
  // Sadece eski seeding hardcoded Unsplash placeholder'ini filtrele:
  if (url === 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167') return false;
  return true;
}

// ❗ Davranış değişikliği: Eskiden tüm unsplash.com URL'leri filtreleniyordu.
// Şimdi sadece tek hardcoded placeholder filtreleniyor.
// Veritabanındaki eski Unsplash URL'leri artık geçerli sayılacak.
export function getNewsImage(item: NewsItem): string {
  if (item.gorselUrl && isValidImageUrl(item.gorselUrl)) {
    return item.gorselUrl;
  }
  const category = item.kategori?.ad || 'Genel';
  const query = CATEGORY_QUERIES[category] || CATEGORY_QUERIES['Genel'];
  const seed = item.id % 1000;
  return `https://source.unsplash.com/800x450/?${query}&sig=${seed}`;
}
```

- [ ] **Step 2: CATEGORY_QUERIES map'ini doğrula**

7 kategori cover ediliyor mu kontrol et:
- Teknoloji, Siyaset, Ekonomi, Spor, Sağlık, Dünya, Genel

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/newsImage.ts
git commit -m "feat(S3.5): activate Unsplash category-based image fallback"
```

---

### Task 5.2: NewsCard'a Görsel Ekle

**Files:**
- Modify: `frontend/src/components/NewsCard.tsx`

- [ ] **Step 1: NewsCard'a image section ekle**

Next.js `<Image>` kullan (raw `<img>` değil). Unsplash external domain için `next.config` güncelle:

```ts
// next.config.ts (veya .js) — images.remotePatterns ekle:
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'source.unsplash.com' },
    { protocol: 'https', hostname: 'images.unsplash.com' },
    { protocol: 'https', hostname: 'picsum.photos' },
  ],
}
```

```tsx
import Image from "next/image";
import { getNewsImage } from "@/utils/newsImage";

// Card üst kısmına (title öncesine):
<div className="relative w-full h-40 overflow-hidden rounded-t-2xl">
  {/* Skeleton: görsel yüklenene kadar pulse */}
  <div className="absolute inset-0 animate-pulse bg-white/5 rounded-t-2xl" />
  <Image
    src={getNewsImage(news)}
    alt={news.baslik}
    fill
    className="object-cover transition-opacity duration-500"
    sizes="(max-width: 768px) 100vw, 33vw"
    unoptimized  // external URL optimization için
    onLoad={(e) => {
      // Skeleton'u gizle, image'i fade-in yap
      const img = e.currentTarget as HTMLImageElement;
      img.style.opacity = '1';
      img.previousElementSibling?.classList.add('hidden');
    }}
    style={{ opacity: 0 }}
  />
  <div className="news-card-image-overlay" />
</div>
```

- [ ] **Step 2: HeroCarousel'da hardcoded Unsplash → getNewsImage**

`HeroCarousel.tsx` line 73'teki hardcoded Unsplash URL'i değiştir:

```tsx
// Before:
src="https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=1200&h=600&fit=crop"

// After:
src={getNewsImage(currentSlide)}
```

`getNewsImage` import'u ekle.

- [ ] **Step 3: Browser'da doğrula**

- Her 7 kategori farklı görsel döndürüyor
- Mevcut `gorselUrl`'li haberler kendi görselini kullanıyor
- NewsCard'da görsel doğru render
- HeroCarousel'da kategori bazlı görsel

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/NewsCard.tsx frontend/src/components/HeroCarousel.tsx frontend/src/utils/newsImage.ts
git commit -m "feat(S3.5): add category-based images to NewsCard and HeroCarousel"
```

> 🔧 **Skill gate:** `@verification-before-completion` — build + görsel render kontrolü.

---

## Chunk 6: S4 — HeroCarousel Neon+Glass

### Task 6.1: HeroCarousel Stil Yükseltmesi

**Files:**
- Modify: `frontend/src/components/HeroCarousel.tsx`

- [ ] **Step 1: Mesh gradient blob ekle**

Container'ın içine (overlay katmanı olarak):

```tsx
{/* Mesh gradient blobs */}
<div className="absolute top-8 right-12 w-32 h-32 rounded-full opacity-20 blur-3xl pointer-events-none"
     style={{ background: 'radial-gradient(circle, var(--neon-purple), transparent)' }} />
<div className="absolute bottom-16 left-8 w-24 h-24 rounded-full opacity-15 blur-2xl pointer-events-none"
     style={{ background: 'radial-gradient(circle, var(--neon-cyan), transparent)' }} />
```

- [ ] **Step 2: Kategori badge → neon-badge + pulse**

```tsx
// Before: düz pill badge
// After:
<span className="neon-badge animate-pulse">
  {currentSlide.kategori.ad}
</span>
```

- [ ] **Step 3: Confidence badge → mono + glass**

```tsx
<span className="mono text-sm px-3 py-1 glass-card">
  %{Math.round((currentSlide.mlConfidence || 0) * 100)}
</span>
```

- [ ] **Step 4: Navigation okları → glass circle + neon border**

```tsx
// Before: yarı saydam yuvarlak
// After:
<button className="glass-card p-2 rounded-full border border-[var(--neon-purple)] hover:bg-[var(--neon-glow-purple)] transition-colors">
  <ChevronLeft className="w-5 h-5" />
</button>
```

- [ ] **Step 5: Dot indicators → neon-purple aktif**

```tsx
// Before: bg-white / bg-white/50
// After:
className={`w-2.5 h-2.5 rounded-full transition-all ${
  index === current
    ? 'bg-[var(--neon-purple)] scale-125'
    : 'bg-white/30 hover:bg-white/50'
}`}
```

- [ ] **Step 6: "Otomatik" label → glass pill**

```tsx
<span className="glass-card px-3 py-1 text-xs flex items-center gap-1.5">
  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
  Otomatik
</span>
```

- [ ] **Step 7: Browser'da doğrula**

- 5 slide geçişi smooth
- Mesh gradient blob'lar görünür (subtle)
- Neon-badge pulse animasyonu
- Glass navigation okları hover efekti
- Dot indicator aktif = neon-purple
- Mobilde performans OK

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/HeroCarousel.tsx
git commit -m "feat(S4): HeroCarousel neon+glass style with mesh gradients"
```

> 🔧 **Skill gate:** `@ui-designer` — mesh gradient subtlety, responsive check.  
> 🔧 **Skill gate:** `@verification-before-completion` — build + 5 slide + mobil test.

---

## Chunk 6.5: S4.5 — "Wow Factor" Layer (Hero Full-Screen + Typography + Dot Pattern)

### Task 6.5.1: Hero Full-Viewport + Bold Typography

**Files:**
- Modify: `frontend/src/components/HeroCarousel.tsx`
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Hero yüksekliğini h-screen yap**

Mevcut: `h-[500px] md:h-[600px]` → Yeni: `h-[85vh] md:h-screen`

```tsx
// Before:
className="relative w-full h-[500px] md:h-[600px] rounded-2xl overflow-hidden group"

// After:
className="relative w-full h-[85vh] md:h-screen rounded-2xl overflow-hidden group"
```

> **Not:** `h-screen` tam viewport. Altına scroll ile StatsBar gelecek. Mobilde `85vh` — browser chrome'u hesabına kat.

- [ ] **Step 2: Hero başlık tipografisini büyüt**

Mevcut hero title muhtemelen `text-2xl md:text-4xl`. Framer/Robotix referansındaki gibi display-level yap:

```tsx
// Hero başlık:
<h2 className="font-serif text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold leading-tight tracking-tight line-clamp-3 md:line-clamp-2">
  {currentSlide.baslik}
</h2>

// Subtitle/meta:
<p className="text-base md:text-lg text-white/60 mt-4 max-w-2xl line-clamp-2">
  {currentSlide.metaAciklama}
</p>
```

`line-clamp-3` mobilde 3 satır, `md:line-clamp-2` tablet/desktop'ta 2 satır ile sınırlar. Uzun Türkçe başlıklar ellipsis ile kesilir, hero layout korunur. `metaAciklama` da 2 satırla sınırlı — hero alanında uzun açıklama gereksiz.

- [ ] **Step 3: Animated gradient orb (3D illusion)**

Spline/Three.js yerine CSS-only animasyonlu orb — Robotix referansındaki 3D obje hissini verir:

```tsx
{/* Animated gradient orb — hero sağ tarafı */}
<div className="absolute right-[-5%] top-[10%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] pointer-events-none">
  <div className="w-full h-full rounded-full animate-orb-float"
    style={{
      background: `
        radial-gradient(circle at 30% 30%, var(--neon-purple), transparent 60%),
        radial-gradient(circle at 70% 70%, var(--neon-cyan), transparent 60%),
        radial-gradient(circle at 50% 50%, rgba(124,58,237,0.3), transparent 70%)
      `,
      filter: 'blur(40px)',
    }} />
</div>
```

Animasyon (globals.css'e ekle):

```css
@keyframes orb-float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-20px) scale(1.05); }
}
.animate-orb-float {
  animation: orb-float 8s ease-in-out infinite;
}
```

- [ ] **Step 4: Browser'da doğrula**

- Hero tam viewport yüksekliğinde
- Başlık devasa, serif font
- Gradient orb sağ tarafta subtle float animasyonu
- Scroll ile StatsBar görünüyor
- Mobilde (375px) orb taşma yok, başlık okunabilir

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/HeroCarousel.tsx frontend/src/app/globals.css
git commit -m "feat(S4.5): hero full-viewport with display typography and animated gradient orb"
```

---

### Task 6.5.2: Dot Pattern Arka Plan

**Files:**
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/app/layout.tsx` veya `page.tsx`

- [ ] **Step 1: CSS dot pattern overlay tanımla**

Robotix referansındaki floating dots etkisi — pure CSS, zero JS:

```css
/* globals.css — neon utility blokuna ekle */
.dot-pattern {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: radial-gradient(circle, rgba(124, 58, 237, 0.15) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
}
```

`mask-image` ile merkezde yoğun, kenarlarda fade-out → derinlik hissi.

- [ ] **Step 2: Dot pattern'i layout'a ekle**

`page.tsx` veya `layout.tsx`'te body'nin ilk child'ı olarak:

```tsx
<div className="dot-pattern" aria-hidden="true" />
```

> **Performans:** `position: fixed` + `pointer-events: none` + CSS-only = sıfır JS, sıfır repaint, GPU-composited layer. `background-size: 32px` ile küçük pattern tile, performans etkisi yok.

- [ ] **Step 3: Browser'da doğrula**

- Dark mode: subtle mor nokta grid'i görünür
- Light mode: neon-purple opak değil, görünmemeli veya çok subtle
- Scroll: dot pattern sabit kalıyor (fixed)
- Performans: 60fps scroll, DevTools'ta "paint" event yok

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/globals.css frontend/src/app/page.tsx
git commit -m "feat(S4.5): add dot pattern background and typography scale"
```

> 🔧 **Skill gate:** `@ui-designer` — orb boyutu/pozisyonu, dot density, tipografi scale kontrolü.  
> 🔧 **Skill gate:** `@performance-profiler` — h-screen hero + fixed dot pattern scroll performansı.

---

## Chunk 7: Final Verification + Demo Prep

### Task 7.1: Comprehensive Review

- [ ] **Step 1: Full build**

```bash
cd frontend && npm run build
```

Expected: exit 0, no errors, no warnings about unused imports.

- [ ] **Step 2: Tüm sayfalar görsel kontrol**

| Sayfa | Kontrol |
|---|---|
| Ana sayfa (dark) | Hero → StatsBar → Grid(3col), neon estetik |
| Ana sayfa (light) | AntiGravity tema korunmuş, glass efektler subtle |
| Admin paneli | `.glass-card` bozulmamış |
| Haber detay | Metin okunabilirliği |
| Mobil (375px) | StatsBar 1col, NewsCard stack, Hero responsive |

- [ ] **Step 3: Performance check**

DevTools → Performance tab → scroll through news grid → 60fps olmalı.  
Özellikle `backdrop-filter` kartlarda jank var mı kontrol et.

> 🔧 **Skill gate:** `@comprehensive-review` workflow — tüm S0-S4 son gate.  
> 🔧 **Skill gate:** `@performance-profiler` — backdrop-filter scroll performansı.

- [ ] **Step 4: Docker deploy + health check**

```bash
cd .. && docker compose up -d --build frontend
```

> 🚀 **Workflow:** `@deploy` + `@health-check`

- [ ] **Step 5: Final commit + branch decision**

> 🔧 **Skill gate:** `@finishing-a-development-branch` — merge/PR kararı.

```bash
git log --oneline --since="today" | head -20
```

Tüm commit'ler sıralı ve anlamlı mesajlı olmalı:
```
feat(S4.5): add dot pattern background and typography scale
feat(S4.5): hero full-viewport with display typography and animated gradient orb
feat(S4): HeroCarousel neon+glass style with mesh gradients
feat(S3.5): add category-based images to NewsCard and HeroCarousel
feat(S3.5): activate Unsplash category-based image fallback
feat(S3): NewsCard neon+glass style with confidence band indicator
feat(S3): extend NewsItem type with confidenceBand, add confidence helper
feat(S2): add neon border beam to navbar
feat(S2): add StatsBar component and replace LazySection in page layout
feat(S2): add StatsBar cell components (Sentiment, Model, Today, Interest)
feat(S1): refactor SentimentBiasMap from custom SVG to Recharts PieChart
feat(S1): add recharts dependency
feat(S0): dark mode default + Fira Code font
feat(S0): add neon+glass CSS variables and utility classes
```

---

## Backlog (İmplementasyon Dışı)

| # | İtem | Kaynak |
|---|------|--------|
| B4 | `guardOverride` backend persist + frontend shield icon | S3 spec — backend DB değişikliği gerekli |
| B5 | Unsplash API key entegrasyonu (source.unsplash.com deprecated ise) | S3.5 |
| B7 | Squash-merge stratejisi (12+ commit → PR) | Branch yönetimi |
