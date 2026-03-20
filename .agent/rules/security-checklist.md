# Security Checklist (Güvenlik Kontrol Listesi)

Backend üzerinde yeni bir API, Endpoint, Servis veya Veritabanı sorgusu oluşturmadan / commit etmeden önce bu listeden onay alınmalıdır:

## 1. Veri Girişi (Input Validation)
- [ ] Dışarıdan gelen veri (params, body, query, headers) kontrol edildi mi? (Zod/Joi gibi kütüphaneler ile)
- [ ] Beklenmeyen tehlikeli tipler filtreleniyor mu?

## 2. Enjeksiyon ve Veritabanı (SQL Injection vb.)
- [ ] Tüm SQL/Veritabanı işlemleri parametrize (Parameterized Queries) edildi mi? (String birleştirme ile SQL YAZILMAMALI)
- [ ] ORM veya Query Builder kullanılıyorsa escape ediliyor mu?

## 3. Erişim ve Kimlik (Authentication & Authorization)
- [ ] Bu endpoint dışarıya açık olması gerekiyor mu? Gerekiyorsa Rate Limiting var mı?
- [ ] Korumalı bir işlem ise, kullanıcının/botun geçerli yetkisi/tokeni var mı?

## 4. API & Rate Limiting
- [ ] Public endpoint'lere spam/DDOS önlemi olarak Rate Limit (örn. express-rate-limit) uygulandı mı?
- [ ] Kritik/Maaliyetli endpointler (Azure OpenAI vb.) için istek kotası sınırlandı mı?

## 5. Secret ve Hassas Veriler
- [ ] Eklediğin hiçbir kod parçasında (API secret, connection string vb.) hardcoded olarak şifre/parola/anahtar yazılı mı? Yalnızca `process.env.*` kullanılmalı!
- [ ] `.env`'ye yeni bir parametre eklendiyse, `.env.example` doyası da güvensiz bir placeholder değer ile güncellendi mi?

## 6. Loglama (Data Leakage)
- [ ] `console.log()` veya `logger.info()` içerisinde kullanıcının özel bilgisi, JWT token'ı, session'ı ya da kredi kartı bilgisi var mı? (Bunlar dışarıya loglanmamalı)
