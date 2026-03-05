# AI Haber Ajansı — Proje Yol Haritası

> **Son Güncelleme:** 5 Mart 2026 | **Versiyon:** 1.0  
> **Proje:** Full-Stack AI Haber Platformu  
> **Teknoloji:** Node.js · Next.js 16 · n8n · PostgreSQL · Docker

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
│  │ ORM      │    │ 6 Modül      │    │ Orkestratör  │    │ Tailwind │  │
│  └──────────┘    └──────────────┘    └──────────────┘    └──────────┘  │
│                         │                   │                  │       │
│                         ▼                   ▼                  ▼       │
│              ┌────────────────┐   ┌──────────────┐   ┌─────────────┐  │
│              │ ML + LLM + RSS │   │ RSS Toplama   │   │ Haber       │  │
│              │ Render + News  │   │ Kategorize    │   │ Listeleme   │  │
│              │ Dedup + Social │   │ Özgünleştirme │   │ Detay       │  │
│              └────────────────┘   │ Görsel + Pay. │   │ Filtreleme  │  │
│                                   └──────────────┘   └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Modül Durum Tablosu

### Backend Modülleri

| # | Modül | Endpoint | Durum | Açıklama |
|---|-------|----------|-------|----------|
| 1 | RSS Parser | `POST /api/rss/parse` | ✅ | Çoklu RSS kaynağından haber çekme |
| 2 | ML Kategorisasyon | `POST /api/ml/categorize` | ✅ | Naive Bayes sınıflandırma + güven skoru |
| 3 | LLM Entegrasyonu | `POST /api/llm/generate` | ✅ | Ollama / OpenAI provider (Factory pattern) |
| 4 | Render Engine | `POST /api/render` | ✅ | Canvas ile haber görseli oluşturma |
| 5 | News CRUD | `GET/POST /api/news` | ✅ | Kaydetme, listeleme, slug detay, Jaro-Winkler dedup |
| 6 | Sosyal Medya | — | 🔶 | Sadece interface + mock adapter var |

### n8n Workflow'ları

| # | Workflow | Görev | Durum |
|---|----------|-------|-------|
| 1 | Haber Toplama | RSS → ML kategorize → Kopya kontrol → DB kaydet | ✅ |
| 2 | İçerik Zenginleştirme | Ham haberleri çek → Gemini AI ile özgünleştir → DB güncelle | ✅ |
| 3 | Yayınlama | Hazır haberleri çek → Görsel oluştur → Telegram paylaşım → "Yayında" yap | ✅ |
| 4 | Sağlık Kontrolü | Sistem sağlık kontrolü → Arıza varsa Telegram uyarısı | ✅ |

### Altyapı

| Bileşen | Durum | Detay |
|---------|-------|-------|
| PostgreSQL + Prisma ORM | ✅ | 6 model, migration, seed |
| Docker Compose | ✅ | 4 servis (postgres, n8n, backend, frontend) |
| Centralized Error Handler | ✅ | ConflictError, NotFoundError, ValidationError |
| Next.js Frontend | 🔶 | Ana sayfa var, alt sayfalar eksik |

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

Kullanıcı      ──► Frontend       ──► GET /api/news ──► Haber Listesi Ekranı
```

---

## 4. Eksik Geliştirmeler (Öncelik Sırasıyla)

### 🔴 P0 — Zorunlu

| # | Görev | Efor | Açıklama |
|---|-------|------|----------|
| 1 | `/haber/[slug]` detay sayfası | 2 sa | Habere tıklanınca açılacak tam içerik sayfası |
| 2 | `/kategoriler` sayfası | 1.5 sa | Kategori bazlı haber filtreleme |
| 3 | `/hakkinda` sayfası | 1 sa | Proje tanıtım ve mimari açıklama |
| 4 | NewsCard → Link bağlantısı | 30 dk | Kartları tıklanabilir yapma |
| 5 | Demo veri kaldırma | 30 dk | Sadece gerçek API verisine geçiş |

### 🟡 P1 — Önemli

| # | Görev | Efor | Açıklama |
|---|-------|------|----------|
| 6 | CORS yapılandırması | 30 dk | Frontend origin izni |
| 7 | Sosyal medya controller/router | 1.5 sa | Mock adapter'ı API'ye bağlama |
| 8 | Otomatik yenileme (Polling) | 2 sa | Her 60 sn'de yeni haber kontrolü |

### 🟢 P2 — İyileştirme

| # | Görev | Efor | Açıklama |
|---|-------|------|----------|
| 9 | Arama fonksiyonu | 3 sa | Başlık/içerik bazlı haber arama |
| 10 | Pagination | 2 sa | Büyük veri setleri için sayfalama |
| 11 | Admin dashboard | 4 sa | İstatistik paneli |
| 12 | Kullanıcı sistemi | 6 sa | JWT auth + kişisel akış |
| 13 | KVKK çerez onayı | 2 sa | Yasal uyum |

---

## 5. Risk Matrisi

| Risk | Olasılık | Etki | Çözüm |
|------|----------|------|-------|
| n8n + Prisma migration çakışması | Orta | Yüksek | n8n için ayrı DB şeması |
| CORS engeli (port farkı) | Yüksek | Düşük | Backend CORS listesine `:3001` ekle |
| LLM provider erişim kaybı | Düşük | Orta | Graceful degradation: ham haber göster |
| Demo verinin yanıltması | Yüksek | Düşük | "Demo Modu" etiketi ekle |

---

## 6. Sonraki Sprint Planı

```
Sprint 1 (P0 — Tahmini 5.5 saat)
├── 1. /haber/[slug] detay sayfası
├── 2. /kategoriler sayfası
├── 3. /hakkinda sayfası
├── 4. NewsCard link bağlama
└── 5. Demo veri temizliği

Sprint 2 (P1 — Tahmini 4 saat)
├── 6. CORS düzeltmesi
├── 7. Sosyal medya modülü
└── 8. Auto-refresh mekanizması

Sprint 3 (P2 — Tahmini 17 saat)
├── 9.  Arama
├── 10. Pagination
├── 11. Dashboard
├── 12. Auth sistemi
└── 13. KVKK uyumu
```

---

## 7. Dosya Yapısı

```
Final-Project/
├── backend/                          # Express + TypeScript
│   ├── prisma/                       # Schema, migration, seed
│   └── src/modules/
│       ├── rss/                      # ✅ RSS Parser
│       ├── ml/                       # ✅ Naive Bayes
│       ├── llm/                      # ✅ Ollama / OpenAI
│       ├── render/                   # ✅ Canvas görselleri
│       ├── news/                     # ✅ CRUD + Dedup
│       └── social/                   # 🔶 Interface only
├── frontend/                         # Next.js 16 + Tailwind
│   └── src/
│       ├── app/                      # 🔶 Sadece ana sayfa
│       └── components/               # ✅ 7 bileşen
├── training/naive-bayes/             # ML eğitim verisi
├── docker-compose.yml                # ✅ 4 konteyner
└── docs/                             # Bu dosya + faz raporları
```
