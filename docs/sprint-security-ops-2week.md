# 2 Haftalık Sprint: Eksik Tamamlama + Temizlik (28 Mart - 11 Nisan 2026)

> **Hedef:** Mevcut eksiklikleri kapatma, mock/ölü kodları temizleme, production-ready duruma getirme  
> **Kapsam:** 10 iş günü aktif çalışma + 4 gün buffer/test  
> **Felsefe:** YENİ ÖZELLİK YOK — sadece eksik olan tamamlanacak, kullanılmayan temizlenecek

---

## 🔍 Audit Sonuçları: Zaten Var vs Gerçekten Eksik

### ✅ ZATEN VAR (Sprint'ten çıkarıldı)
| Bileşen | Durum | Dosya |
|---------|-------|-------|
| Helmet (security headers) | ✅ Aktif, CSP prod'da | `backend/src/index.ts` |
| CORS (env-based whitelist) | ✅ Aktif, configurable origins | `backend/src/index.ts` |
| Rate Limiting (100 req/min) | ✅ Aktif, global | `backend/src/index.ts` |
| Health Check endpoint | ✅ `GET /api/health` çalışıyor | `backend/src/index.ts` |
| Error Handler (centralized) | ✅ AppError + factories | `backend/src/middleware/error-handler.ts` |
| Graceful Shutdown | ✅ SIGTERM/SIGINT | `backend/src/index.ts` |
| .gitignore (.env, node_modules) | ✅ Doğru ayarlanmış | `.gitignore` |
| SSRF Protection | ✅ RSS health endpoint'te | `backend/src/modules/rss/` |
| Render Module | ✅ Canvas ile çalışıyor | `backend/src/modules/render/` |

### ❌ GERÇEKTEN EKSİK (Bu sprint'te yapılacak)
| Eksik | Neden Kritik |
|-------|-------------|
| JWT Auth (sadece x-api-key var) | Admin paneli herkes tarafından erişilebilir |
| bcrypt + jsonwebtoken paketleri | Şema'da `sifreHash` var ama kütüphane yok |
| Login sayfası (frontend) | `/admin` login olmadan açılıyor |
| Kullanici seed (admin user yok) | Prisma'da model var ama seed'de user yok |
| DB Backup otomasyonu | Hiç yok |
| LLM cost tracking | Token kullanımı loglanmıyor |
| SentimentBiasMap gerçek veri | Frontend'de hardcoded demo değerler |
| Login endpoint | backend POST /auth/login yok |

### 🗑️ MOCK/ÖLÜ KOD (Temizlenecek veya netleştirilecek)
| Bileşen | Durum | Karar |
|---------|-------|-------|
| Social Module (MockSocialAdapter) | 100% mock, fake 500-1500ms delay | ⚠️ Kaldır veya "coming soon" flag |
| n8n klasörü + docker-compose | Boş klasör, compose'da comment out | 🗑️ Klasör sil, compose temizle |
| OpenAI Provider (stub) | Boş implementation | 🗑️ Kaldır |
| Anthropic Provider (stub) | Boş implementation | 🗑️ Kaldır |
| Hardcoded API Key default | `'ag-agency-secret-token-2026'` | ⛔ Güvenlik riski, kaldır |
| Admin ML Accuracy initial state | Frontend'de hardcoded %85 başlangıç | ⚠️ API'den gelene kadar skeleton göster |

---

## 📋 Hafta 1: Auth Sistemi + Güvenlik Açıkları (Gün 1-5)

### Gün 1: JWT Altyapısı (4 saat)

**Hedef:** Backend'de JWT sign/verify + role guard çalışır durumda.

| # | Task | Dosya | Efor | Detay |
|---|------|-------|------|-------|
| 1.1 | `bcrypt` + `jsonwebtoken` install | `backend/package.json` | 15dk | `npm install bcrypt jsonwebtoken && npm install -D @types/bcrypt @types/jsonwebtoken` |
| 1.2 | JWT_SECRET env tanımı | `backend/.env` | 15dk | `JWT_SECRET=<openssl rand -hex 32>`, constants.ts'ye ekle |
| 1.3 | auth.middleware.ts refactor | `backend/src/middleware/auth.middleware.ts` | 2h | Mevcut x-api-key kontrolünü koru + **yeni** `verifyJWT()` middleware ekle. İkisi paralel çalışsın (geriye uyumluluk) |
| 1.4 | Role guard middleware | `backend/src/middleware/role.middleware.ts` (NEW) | 1h | `requireRole(roles[])` → JWT decode → role check → next() veya 403 |
| 1.5 | Hardcoded default key kaldırma | `backend/src/config/constants.ts` | 30dk | `'ag-agency-secret-token-2026'` fallback'i kaldır → env'de yoksa hata fırlat |

**Mevcut Durum:** `auth.middleware.ts` sadece `x-api-key` header check ediyor. JWT yok, role yok.  
**Çıkış:** JWT verify + role guard middleware hazır, henüz route'lara bağlanmadı.

---

### Gün 2: Login Endpoint + User Seed (4 saat)

**Hedef:** Admin login olabiliyor, JWT token alıyor.

| # | Task | Dosya | Efor | Detay |
|---|------|-------|------|-------|
| 2.1 | Login endpoint | `backend/src/modules/admin/admin.controller.ts` | 2h | `POST /api/admin/login { email, sifre }` → bcrypt compare → JWT return |
| 2.2 | Admin user seed | `backend/prisma/seed.ts` | 1h | Mevcut kategori seed'ine Kullanici ekle: email + bcrypt hash. **Not:** Şema'da Kullanici modeli zaten var |
| 2.3 | Login endpoint testi | `backend/src/__tests__/auth.middleware.test.ts` | 1h | Mevcut test dosyasına login flow testleri ekle: doğru/yanlış şifre, token format |

**Mevcut Durum:** `seed.ts` sadece 7 kategori seed'liyor. Kullanici tablosu boş.  
**Çıkış:** `POST /api/admin/login` çalışıyor, doğru credentials → JWT token.

---

### Gün 3: Admin Endpoints JWT Guard + Frontend Login (4 saat)

**Hedef:** Admin paneli artık login gerektiriyor.

| # | Task | Dosya | Efor | Detay |
|---|------|-------|------|-------|
| 3.1 | Admin routes'a JWT guard ekle | `backend/src/modules/admin/admin.controller.ts` | 1h | `GET /admin/stats` ve `GET /admin/scheduler-status` → `verifyJWT` + `requireRole(['admin'])` middleware zinciri |
| 3.2 | Frontend login sayfası | `frontend/src/app/login/page.tsx` (NEW) | 1.5h | Basit form: email + şifre → `/api/admin/login` fetch → token'ı localStorage'e kaydet |
| 3.3 | Frontend auth wrapper | `frontend/src/lib/auth.ts` (NEW) | 1h | `getToken()`, `isLoggedIn()`, `logout()` helpers + fetch wrapper'a `Authorization: Bearer` header ekle |
| 3.4 | Admin page guard | `frontend/src/app/admin/page.tsx` | 30dk | Mevcut dosyaya: token yoksa `/login`'e redirect. Mevcut `x-api-key` header'ı `Authorization: Bearer` ile değiştir |

**Mevcut Durum:** Frontend admin sayfası `x-api-key` header'ı ile backend'e istek atıyor. Login sayfası yok.  
**Çıkış:** `/admin` açılınca login yoksa redirect → `/login` → JWT token al → admin dashboard göster.

---

### Gün 4: Ölü Kod Temizliği (4 saat)

**Hedef:** Mock ve kullanılmayan kodlar temizlendi veya açıkça işaretlendi.

| # | Task | Dosya | Efor | Detay |
|---|------|-------|------|-------|
| 4.1 | n8n klasörü + docker-compose temizliği | `n8n/`, `docker-compose.yml` | 30dk | `n8n/` klasörünü sil, docker-compose'daki comment-out satırları kaldır |
| 4.2 | Social module "mock" flag'i | `backend/src/modules/social/` | 1h | Mock olduğunu açıkça belirten log + API response'a `{ mock: true, message: "Social media integration not yet implemented" }` ekle. Endpoint çağrıldığında yanıltmasın |
| 4.3 | OpenAI + Anthropic stub temizliği | `backend/src/modules/llm/providers/` | 1h | Stub dosyaları kaldır. `content-generation.service.ts`'de referansları temizle. Sadece Gemini + Ollama kalsın |
| 4.4 | Frontend hardcoded defaults düzeltme | `frontend/src/app/admin/page.tsx` + `SentimentBiasMap.tsx` | 1h | Admin initial state'lerdeki hardcoded değerleri `null` yap, API yüklenene kadar skeleton/spinner göster |
| 4.5 | Frontend hardcoded kategori listesi | `frontend/src/app/page.tsx` | 30dk | Home page'deki 8 hardcoded CATEGORIES array'ini backend `/api/news/categories` endpoint'inden çek |

**Mevcut Durum:** Social module tamamen mock ama cevapları "başarılı" gibi gösteriyor. n8n boş klasör. Stub provider'lar var. Frontend'de hardcoded initial value'lar var.  
**Çıkış:** Ölü kod kaldırıldı, mock'lar açıkça etiketlendi, frontend gerçek data'ya bağlandı.

---

### Gün 5: Endpoint-Seviye Rate Limit + Env Validation (4 saat)

**Hedef:** Login brute force koruması, env startup check.

| # | Task | Dosya | Efor | Detay |
|---|------|-------|------|-------|
| 5.1 | Login rate limit (ayrı) | `backend/src/index.ts` | 1h | Mevcut global 100/min yanında: `/api/admin/login` için ayrı 5 req/15min limiter. express-rate-limit zaten yüklü |
| 5.2 | Env validation fonksiyonu | `backend/src/config/validateEnv.ts` (NEW) | 1h | Startup'ta kontrol: `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY_1` yoksa process.exit(1) + açık hata mesajı |
| 5.3 | .env.example oluştur | `backend/.env.example` (NEW) | 30dk | Tüm env var'ları listele, hassas değerler yerine `<your-secret-here>` placeholder |
| 5.4 | Frontend .env.example | `frontend/.env.example` (NEW) | 30dk | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ADMIN_API_KEY` (kaldırılacak, JWT ile değişecek) |
| 5.5 | Index.ts'ye validateEnv() çağrısı | `backend/src/index.ts` | 30dk | Server başlamadan önce çağır |

**Mevcut Durum:** Global rate limit var (100/min). Env validation yok — eksik env var sessizce `undefined` oluyor.  
**Çıkış:** Login brute-force korumalı, eksik env var'da net hata mesajı + process exit.

---

## 📋 Hafta 2: Operasyonel Eksikler + Admin Panel (Gün 6-10)

### Gün 6: DB Backup Otomasyonu (4 saat)

**Hedef:** Günlük otomatik yedekleme çalışıyor.

| # | Task | Dosya | Efor | Detay |
|---|------|-------|------|-------|
| 6.1 | Backup script | `backend/scripts/backup-db.sh` (NEW) | 1.5h | `docker exec` ile pg_dump, gzip sıkıştırma, `backups/` dizinine tarihli dosya, 7 günden eski sil |
| 6.2 | Node.js cron wrapper | `backend/scripts/backup-cron.ts` (NEW) | 1.5h | node-cron ile günde 02:00 UTC'de backup-db.sh çalıştır, başarı/hata logla |
| 6.3 | Restore test script | `backend/scripts/restore-db.sh` (NEW) | 1h | En son backup'tan restore testi çalıştır, data integrity check (SELECT count) |

**Mevcut Durum:** `db_backup.dump` kök dizinde var ama otomatik sistem yok. Manuel tek seferlik dump.  
**Çıkış:** Günlük 02:00'da otomatik backup + 7 günlük retention.

---

### Gün 7: LLM Token Kullanım Takibi (4 saat)

**Hedef:** Her Gemini çağrısının token kullanımı loglanıyor.

| # | Task | Dosya | Efor | Detay |
|---|------|-------|------|-------|
| 7.1 | LlmUsage Prisma modeli | `backend/prisma/schema.prisma` | 1h | `LlmKullanim { id, saglayici, girisToken, cikisToken, tapihmaniMaliyet, tarih, durum }` + migration |
| 7.2 | Gemini provider'a usage logging | `backend/src/modules/llm/providers/gemini.provider.ts` | 1.5h | Response'taki `usageMetadata` → `promptTokenCount`, `candidatesTokenCount` oku → DB'ye kaydet |
| 7.3 | Admin cost endpoint | `backend/src/modules/admin/admin.controller.ts` | 1.5h | `GET /api/admin/llm-usage` → günlük/aylık toplam, provider bazlı breakdown |

**Mevcut Durum:** Gemini çağrıları yapılıyor ama token kullanımı hiç kaydedilmiyor. Maliyet görünmüyor.  
**Çıkış:** Her LLM call'ı DB'de log, admin'de toplam görebiliyor.

---

### Gün 8: SentimentBiasMap Gerçek Veri + Admin Düzeltmeleri (4 saat)

**Hedef:** Frontend'deki tüm hardcoded/demo veriler gerçek API'ye bağlandı.

| # | Task | Dosya | Efor | Detay |
|---|------|-------|------|-------|
| 8.1 | Sentiment stats backend endpoint | `backend/src/modules/admin/admin.controller.ts` | 1.5h | `GET /api/admin/sentiment-stats` → DB'den: Pozitif/Negatif/Nötr haber sayıları, ortalama confidence |
| 8.2 | SentimentBiasMap API bağlantısı | `frontend/src/components/SentimentBiasMap.tsx` | 1h | Mevcut hardcoded `{positive: 45, negative: 20, neutral: 35}` → fetch ile gerçek veri |
| 8.3 | Admin panel skeleton states | `frontend/src/app/admin/page.tsx` | 1h | Tüm initial state `null`, loading sırasında skeleton component göster |
| 8.4 | News CRUD eksik endpoint'ler | `backend/src/modules/news/news.controller.ts` | 30dk | `GET /api/news/:id` → tek haber detayı (slug ile var ama id ile yok) — varsa kontrol et, yoksa ekle |

**Mevcut Durum:** SentimentBiasMap 45/20/35 hardcoded gösteriyor. Admin initial state %85 accuracy hardcoded. Slug endpoint'i var ama bazı eksikler olabilir.  
**Çıkış:** Frontend'te tek bir hardcoded demo veri kalmadı.

---

### Gün 9: Mevcut Test Dosyalarını Güncelle (4 saat)

**Hedef:** Mevcut testler yeni auth sistemiyle uyumlu, kırık test yok.

| # | Task | Dosya | Efor | Detay |
|---|------|-------|------|-------|
| 9.1 | auth.middleware.test.ts güncelle | `backend/src/__tests__/auth.middleware.test.ts` | 1.5h | Mevcut x-api-key testleri koru + JWT verify testleri ekle: valid token, expired token, wrong role |
| 9.2 | admin.controller.test.ts güncelle | `backend/src/__tests__/admin.controller.test.ts` | 1.5h | Mevcut testlere JWT header ekle, 401 without token test ekle |
| 9.3 | Tüm testleri çalıştır + fix | terminal | 1h | `npm test` → kırık testleri düzelt, yeni auth flow ile uyumlu hale getir |

**Mevcut Durum:** Test dosyaları mevcut ama eski x-api-key auth ile yazılmış. JWT eklendikten sonra kırılacaklar.  
**Çıkış:** `npm test` → tüm testler geçiyor.

---

### Gün 10: Dokümantasyon + .env.example Son Kontrol (4 saat)

**Hedef:** Proje'yi klonlayan birisi README okuyarak ayağa kaldırabilir.

| # | Task | Dosya | Efor | Detay |
|---|------|-------|------|-------|
| 10.1 | README.md güncelle | `README.md` | 2h | Kurulum adımları (docker compose up), env setup, admin login bilgisi, mimari açıklama, endpoint listesi |
| 10.2 | API endpoint dökümantasyonu | `docs/API.md` (NEW) | 1.5h | Tüm GET/POST endpoint'leri, auth gereksinimleri, örnek request/response |
| 10.3 | Sprint changelog | `docs/sprint-security-ops-2week.md` | 30dk | Her gün tamamlanan task'ların checkbox'larını işaretle |

**Mevcut Durum:** README.md mevcut ama güncel mimari yansıtmıyor (n8n referansları vs). Endpoint doku yok.  
**Çıkış:** Güncel README + API docs.

---

## 📋 Gün 11-14: Buffer + Smoke Test + Sprint Kapanış

### Gün 11-12: Buffer (8 saat)
Herhangi bir gün'de tamamlanamayan task'lar için yedek zaman.  
Tahminen: auth edge case'leri, test fix'leri, Docker rebuild sorunları.

### Gün 13: Smoke Test (4 saat)
| Test | Adım |
|------|------|
| 1 | `docker compose down && docker compose up -d --build` → temiz başlatma |
| 2 | `POST /api/admin/login` → JWT token al |
| 3 | `GET /api/admin/stats` with Bearer token → 200 |
| 4 | `GET /api/admin/stats` without token → 401 |
| 5 | Frontend `/admin` → redirect to `/login` → login → dashboard |
| 6 | RSS scheduler çalışıyor mu kontrolü |
| 7 | `npm test` → tüm testler pass |

### Gün 14: Sprint Retro + Sonraki Faz Planı (4 saat)
- Neler tamamlandı, neler kaldı?
- Teknik borç notları güncelle
- Phase 2 planlaması (SEO, performans, beta launch)

---

## 📊 Sprint Metrikleri

| Metrik | Eski Plan | Revize Plan |
|--------|-----------|-------------|
| Toplam efor | ~120 saat | ~60 saat |
| Yeni dosya sayısı | ~20 | ~10 |
| Kaldırılan dosya/kod | 0 | ~5 dosya/modül |
| Zaten var (gereksiz iş) | 0 saat | **~32 saat tasarruf** |

**Tasarruf edilen:** Helmet kurulumu (zaten var), CORS refactor (zaten var), rate limit (zaten var), health check endpoint (zaten var), .gitignore (zaten var).

---

## ✅ Success Criteria (Sprint End)

- [x] `POST /api/admin/login` çalışıyor, JWT token dönüyor ✅ `28.03.2026`
- [x] `/admin` sayfası login gerektiriyor ✅
- [x] Hardcoded `ag-agency-secret-token-2026` default kaldırıldı ✅
- [x] n8n klasörü + stub provider'lar temizlendi ✅
- [x] Social module açıkça `mock: true` flag'i ile işaretli ✅
- [x] Günlük DB backup zamanlandı (02:00 UTC, 7 günlük retention) ✅
- [x] LLM token kullanımı loglanıyor (maliyet dahil) ✅
- [x] SentimentBiasMap gerçek API verisini gösteriyor ✅
- [x] Frontend'de hiç hardcoded demo veri kalmadı ✅
- [x] `npm test` → 52/52 test geçiyor ✅
- [x] README güncel, `docs/API.md` hazır ✅
- [x] Env yoksa startup'ta net hata mesajı ✅

---

## 🚀 Sonrası (Phase 2)

Bu sprint bitince:
1. **SEO + Meta Tags** (2 gün): sitemap.xml, robots.txt, JSON-LD NewsArticle schema
2. **Performance** (2 gün): DB index review, Redis caching genişletme, image lazy loading
3. **Social Module Kararı** (1 gün): Gerçek Telegram Bot API entegrasyonu veya tamamen kaldır
4. **Beta Launch Prep** (3 gün): Domain, SSL/TLS, reverse proxy (nginx), production .env

### Phase 2 İlerleme (28 Mart 2026)
- [x] `frontend/src/app/sitemap.ts` eklendi (dinamik haber URL'leri + static route'lar)
- [x] `frontend/src/app/robots.ts` eklendi (sitemap referansı + admin/login disallow)
- [x] Haber detay sayfasına `NewsArticle` JSON-LD eklendi (`frontend/src/app/haber/[slug]/page.tsx`)
- [x] Root metadata güçlendirildi (`metadataBase`, canonical, OG, Twitter, robots)
- [x] Kategori/Hakkında sayfaları için metadata genişletmesi (`head.tsx`)
- [x] Sitemap'te kategori slug bazlı route listesi tamamlandı (`/kategoriler/[slug]` route'u ve sitemap category URL üretimi eklendi)
- [x] Backend read endpoint cache genişletmesi (`/api/admin/*`, `/api/news/categories`)
- [x] Haber sorguları için yeni DB index'leri eklendi ve deploy edildi (`20260328113000_add_perf_indexes`)
- [x] Frontend görsellerde lazy-loading audit'i tamamlandı (NewsFeedCard zaten `next/image` + non-hero için lazy davranışı kullanıyor)

---

## 🔁 Sprint Retro — 28 Mart 2026

### ✅ Neler İyi Gitti
- Audit-driven yaklaşım ~32 saat iş tasarrufu sağladı (zaten var olan şeyleri rebuild etmedik)
- JWT auth 2 günde tam çalışır hale geldi, test edildi
- LLM token tracking beklenenden daha hızlı tamamlandı (Gemini usageMetadata mevcut)
- 52 test, 7 suite — sıfır kırık test sprint sonunda
- Smoke testlerin tamamı (11/11) Docker ortamında geçti

### ⚠️ Zorluklar / Teknik Borç
- **Docker volume sıfırlaması:** `docker compose down -v` yapılınca DB silindiği için `prisma migrate deploy && prisma generate` adımı docker-compose'a eklendi. **Çözüm:** `command: sh -c "npx prisma migrate deploy && npx prisma generate && npm run dev"` 
- **Root .env eksikliği:** `JWT_SECRET` backend `.env`'inde tanımlıydı ama docker-compose kök `.env`'i okur. `JWT_SECRET` kök `.env`'e eklendi.
- **Social Module:** 100% mock, gerçek entegrasyon yok. Phase 2'de karar verilmeli.
- **Backup scheduler:** Linux `bash` komutu gerektiriyor — Windows geliştirme ortamında çalışmaz. Production (Linux container) için tasarlandı.

### 📊 Sprint Metrikleri (Gerçekleşen)
| Gün | Görev | Efor (h) |
|-----|-------|----------|
| 1 | JWT Altyapısı | 4 |
| 2 | Login + Seed | 4 |
| 3 | Admin JWT Guard + Frontend | 4 |
| 4 | Ölü Kod Temizliği | 4 |
| 5 | Rate Limit + Env Validation | 4 |
| 6 | DB Backup Otomasyon | 4 |
| 7 | LLM Token Tracking | 4 |
| 8 | SentimentBiasMap Real Data | 4 |
| 9-10 | Test Suite + Dokümantasyon | 6 |
| 13 | Smoke Test + Docker Fix | 3 |
| **TOPLAM** | | **~41h** |

