# Faz 4: Veritabanı ve Optimizasyon (News Module)

- [x] Aşama 1: Veritabanı Mimarisi (Prisma)
  - [x] Prisma şemasında Kategori, Haber modellerinin doğrulanması
  - [x] `PrismaClient` bağlantı havuzlaması (Singleton pattern)
- [x] Aşama 2: Deduplication (Benzerlik Kontrolü) Modülü
  - [x] Yeni gelen başlıkların DB'deki son 50 haberle karşılaştırılması (Levenshtein / Jaccard)
  - [x] DEDUP_SIMILARITY_THRESHOLD (%80) aşılırsa red edilmesi
- [x] Aşama 3: News Service ve API Endpoint
  - [x] Haber Kaydetme, Listeleme, Detay getirme
  - [x] Kayıt sırasında "slug" üretimi
- [x] Aşama 4: Test Edilmesi
