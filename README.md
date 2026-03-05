# 🌟 AI Haber Ajansı — Yapay Zeka Destekli Otomatik Yayın Sistemi

Uçtan uca otonom çalışan bir AI haber ajansı. Güvenilir kaynaklardan haber toplar, ML ile kategorize eder, fine-tuned LLM ile özgün metin üretir, deterministik rendering ile marka tutarlı görseller oluşturur ve çok kanallı dağıtım yapar.

## Tech Stack

| Katman | Teknoloji |
|---|---|
| Orkestrasyon | n8n (self-hosted) |
| Backend API | Node.js + Express.js (TypeScript) |
| ML Kategorize | `natural` (Naive Bayes) |
| LLM | Provider-agnostic (OpenAI / Gemini / Anthropic / Ollama) |
| Görsel Motor | `node-canvas` |
| Veritabanı | PostgreSQL (Prisma ORM) |
| Frontend | Next.js + Tailwind CSS |
| Deploy | Docker |

## Hızlı Başlangıç

```bash
# 1. Repo'yu klonla
git clone <repo-url>
cd Final-Project

# 2. .env dosyasını oluştur
cp .env.example .env
# .env dosyasını düzenle

# 3. Docker ile başlat
docker-compose up -d

# 4. Backend bağımlılıklarını yükle (local geliştirme)
cd backend && npm install

# 5. Veritabanı migration
npm run prisma:migrate

# 6. Backend'i başlat
npm run dev
```

## Proje Yapısı

```
├── backend/          # Express API (TypeScript)
│   ├── src/modules/  # rss, ml, llm, render, social, news
│   ├── prisma/       # DB schema & migrations
│   └── assets/       # Font, logo, gradient mask
├── frontend/         # Next.js + Tailwind
├── n8n/              # Workflow export/backup
├── training/         # ML & LLM eğitim verileri
├── docs/             # Dokümantasyon
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
