# Faz 4: Veritabanı ve Optimizasyon (News Module)

- [ ] Aşama 1: Veritabanı Mimarisi (Prisma)
  - [ ] Prisma şemasında Kategori, Haber modellerinin doğrulanması
  - [ ] `PrismaClient` bağlantı havuzlaması (Singleton pattern)
- [ ] Aşama 2: Deduplication (Benzerlik Kontrolü) Modülü
  - [ ] Yeni gelen başlıkların DB'deki son 50 haberle karşılaştırılması (Levenshtein / Jaccard)
  - [ ] DEDUP_SIMILARITY_THRESHOLD (%80) aşılırsa red edilmesi
- [ ] Aşama 3: News Service ve API Endpoint
  - [ ] Haber Kaydetme, Listeleme, Detay getirme
  - [ ] Kayıt sırasında "slug" üretimi
- [ ] Aşama 4: Test Edilmesi
