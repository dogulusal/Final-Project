# AI Haber Ajansı — Yapay Zeka Destekli Otomatik Yayın Sistemi

Uçtan uca otonom çalışan bir AI haber ajansı. Güvenilir kaynaklardan haber toplar, ML ile kategorize eder, LLM ile özgün metin üretir, deterministik rendering ile marka tutarlı görseller oluşturur.

## Tech Stack

| Katman | Teknoloji |
|---|---|
| Backend API | Node.js + Express.js (TypeScript) |
| Auth | JWT (access 1h + refresh 7d), bcrypt |
| ML Kategorize | Naive Bayes (`natural` kütüphanesi) |
| LLM | Gemini 2.5 Flash (primary) + Ollama (fallback) |
| Görsel Motor | `@napi-rs/canvas` |
| Veritabanı | PostgreSQL 16 (Prisma ORM) |
| Cache | Redis 7 |
| Frontend | Next.js 16 + React 19 + Tailwind CSS v4 |
| Deploy | Docker Compose |

## Hızlı Başlangıç

```bash
# 1. Repo'yu klonla
git clone <repo-url>
cd Final-Project

# 2. Ortam değişkenlerini ayarla
cp backend/.env.example backend/.env
# backend/.env dosyasını düzenle (DATABASE_URL, JWT_SECRET, LLM_API_KEY vb.)

cp frontend/.env.example frontend/.env.local
# frontend/.env.local içinde NEXT_PUBLIC_API_URL ayarla

# 3. Docker ile başlat
docker compose up -d

# 4. Veritabanı seed (admin kullanıcısı + kategoriler)
cd backend && npm run prisma:seed

# 5. Admin panele giriş
# Frontend: http://localhost:3000/login
# Email: admin@newsagency.com  |  Şifre: admin123456
```

## Proje Yapısı

```
├── backend/               # Express API (TypeScript)
│   ├── src/
│   │   ├── modules/       # rss, ml, llm, render, social, news, admin
│   │   ├── middleware/    # auth, role, rate-limit, error-handler
│   │   ├── config/        # constants, database, redis, env-validation
│   │   ├── common/        # auth helpers (JWT, bcrypt)
│   │   └── scripts/       # backup-scheduler, seed vb.
│   ├── scripts/           # backup-db.sh, restore-db.sh
│   ├── prisma/            # DB schema & migrations
│   └── .env.example       # Ortam değişkenleri şablonu
├── frontend/              # Next.js + Tailwind
│   ├── src/app/           # pages (login, admin, haber vb.)
│   ├── src/components/    # UI components
│   └── .env.example       # Frontend config şablonu
├── training/              # ML & LLM eğitim verileri
├── docs/                  # Dokümantasyon
│   └── API.md             # Endpoint referansı
└── docker-compose.yml
```

## Commit Convention

```
feat:     Yeni özellik
fix:      Hata düzeltme
chore:    Bakım işleri
docs:     Dokümantasyon
test:     Test
refactor: Yeniden yapılandırma
```
