# AI Haber Ajansı — Proje Yol Haritası

> **Son Güncelleme:** 5 Mart 2026 | **Versiyon:** 2.0  
> **Proje:** Full-Stack AI Haber Platformu  
> **Teknoloji:** Node.js · Next.js 16 · n8n · PostgreSQL · Docker · Gemini AI

---

## 1. Mimari Genel Bakış

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DOCKER COMPOSE                                │
│                                                                        │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │ postgres │◄───│   backend    │◄───│     n8n      │    │ frontend │  │
│  │ :5432    │    │ :3000        │    │ :5678        │    │ :3001    │  │
│  │          │    │              │    │              │    │          │  │
│  │ Prisma   │    │ Express API  │    │ 4 Workflow   │    │ Next.js  │  │
│  │ ORM      │    │ 7 Modül      │    │ Orkestratör  │    │ Tailwind │  │
│  └──────────┘    └──────────────┘    └──────────────┘    └──────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Modül Durum Tablosu

### Backend Modülleri

| # | Modül | Endpoint | Durum | Açıklama |
|---|-------|----------|-------|----------|
| 1 | RSS Parser | `POST /api/rss/parse` | ✅ | Çoklu RSS kaynağından haber çekme |
| 2 | ML Kategorisasyon | `POST /api/ml/categorize` | ✅ | Naive Bayes sınıflandırma + güven skoru |
| 3 | LLM Entegrasyonu | `POST /api/llm/generate` | ✅ | Gemini AI provider |
| 4 | Render Engine | `POST /api/render` | ✅ | Canvas ile haber görseli oluşturma |
| 5 | News CRUD | `GET/POST /api/news` | ✅ | Kaydetme, listeleme, arama, pagination, dedup |
| 6 | Sosyal Medya | `POST /api/social/publish` | ✅ | Mock adapter + controller + service |
| 7 | CORS | Middleware | ✅ | localhost:3001 ve 3002 origin izinli |

### n8n Workflow'ları

| # | Workflow | Görev | Durum |
|---|----------|-------|-------|
| 1 | Haber Toplama | RSS → ML kategorize → Kopya kontrol → DB kaydet | ✅ |
| 2 | İçerik Zenginleştirme | Ham haberleri çek → Gemini AI ile özgünleştir → DB güncelle | ✅ |
| 3 | Yayınlama | Hazır haberleri çek → Görsel oluştur → Telegram paylaşım | ✅ |
| 4 | Sağlık Kontrolü | Sistem sağlık kontrolü → Arıza varsa Telegram uyarısı | ✅ |

### Frontend Sayfaları

| Sayfa | Durum | Açıklama |
|-------|-------|----------|
| `/` (Ana Sayfa) | ✅ | Haber listesi, arama, kategori filtresi, pagination, auto-refresh |
| `/haber/[slug]` | ✅ | Dinamik haber detay sayfası, breadcrumb, okuma süresi |
| `/kategoriler` | ✅ | Kategori kartları + filtreleme |
| `/hakkinda` | ✅ | Proje mimarisi, tech stack, pipeline |
| Tema Değiştirici | ✅ | Karanlık / Aydınlık mod (next-themes) |
| KVKK Çerez Onayı | ✅ | Animasyonlu cookie consent banner |

### Altyapı

| Bileşen | Durum | Detay |
|---------|-------|-------|
| PostgreSQL + Prisma ORM | ✅ | 6 model, migration, seed |
| Docker Compose | ✅ | 4 servis (postgres, n8n, backend, frontend) |
| Centralized Error Handler | ✅ | ConflictError, NotFoundError, ValidationError |

---

## 3. Veri Akış Diyagramı

```
RSS Kaynakları ──► n8n Workflow 1 ──► /api/ml/categorize ──► Kategori Tahmini
                                  ──► /api/news (Dedup) ──► PostgreSQL (durum: "ham")
                                  
Zamanlayıcı    ──► n8n Workflow 2 ──► DB'den ham haberleri çek
                                  ──► Gemini AI ile özgünleştir
                                  ──► DB güncelle (durum: "hazir")

Zamanlayıcı    ──► n8n Workflow 3 ──► DB'den hazır haberleri çek
                                  ──► /api/render ile görsel oluştur
                                  ──► Telegram paylaşım
                                  ──► DB güncelle (durum: "yayinda")

Kullanıcı      ──► Frontend       ──► GET /api/news ──► Haber Listesi + Arama + Pagination
```

---

## 4. Tamamlanan Geliştirmeler

### ✅ Sprint 1 (P0 — Zorunlu)

| # | Görev | Durum |
|---|-------|-------|
| 1 | `/haber/[slug]` detay sayfası | ✅ Tamamlandı |
| 2 | `/kategoriler` sayfası | ✅ Tamamlandı |
| 3 | `/hakkinda` sayfası | ✅ Tamamlandı |
| 4 | NewsCard → Link bağlantısı | ✅ Tamamlandı |
| 5 | Demo veri kaldırma | ✅ Tamamlandı |

### ✅ Sprint 2 (P1 — Önemli)

| # | Görev | Durum |
|---|-------|-------|
| 6 | CORS yapılandırması | ✅ Tamamlandı |
| 7 | Sosyal medya controller/router | ✅ Tamamlandı |
| 8 | Otomatik yenileme (Polling 60sn) | ✅ Tamamlandı |

### ✅ Sprint 3 (P2 — İyileştirme)

| # | Görev | Durum |
|---|-------|-------|
| 9 | Arama fonksiyonu (Backend + UI) | ✅ Tamamlandı |
| 10 | Pagination (Backend + UI) | ✅ Tamamlandı |
| 13 | KVKK çerez onayı | ✅ Tamamlandı |
| 14 | Karanlık / Aydınlık tema | ✅ Tamamlandı |
| 15 | Minimalist UI tasarım güncellemesi | ✅ Tamamlandı |

### 🔶 Bekleyen (Opsiyonel)

| # | Görev | Efor | Açıklama |
|---|-------|------|----------|
| 11 | Admin dashboard | 4 sa | İstatistik paneli |
| 12 | Kullanıcı sistemi | 6 sa | JWT auth + kişisel akış |

---

## 5. Risk Matrisi

| Risk | Olasılık | Etki | Çözüm |
|------|----------|------|-------|
| n8n + Prisma migration çakışması | Orta | Yüksek | n8n için ayrı DB şeması |
| CORS engeli | ~~Yüksek~~ | ~~Düşük~~ | ✅ Çözüldü |
| LLM provider erişim kaybı | Düşük | Orta | Graceful degradation: ham haber göster |

---

## 6. Dosya Yapısı

```
Final-Project/
├── backend/                          # Express + TypeScript
│   ├── prisma/                       # Schema, migration, seed
│   └── src/modules/
│       ├── rss/                      # ✅ RSS Parser
│       ├── ml/                       # ✅ Naive Bayes
│       ├── llm/                      # ✅ Gemini AI
│       ├── render/                   # ✅ Canvas görselleri
│       ├── news/                     # ✅ CRUD + Dedup + Search + Pagination
│       └── social/                   # ✅ Controller + Service + Mock Adapter
├── frontend/                         # Next.js 16 + Tailwind
│   └── src/
│       ├── app/                      # ✅ 4 sayfa (/, /haber, /kategoriler, /hakkinda)
│       └── components/               # ✅ 11 bileşen
├── training/naive-bayes/             # ML eğitim verisi
├── docker-compose.yml                # ✅ 4 konteyner
└── docs/                             # Roadmap + n8n rehberi
```
