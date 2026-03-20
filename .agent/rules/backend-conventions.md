---
trigger: always_on
---

Backend projelerinde şu kurallara her zaman uy:

1. API anahtarları, tokenlar ve gizli bilgiler asla koda yazılmaz. Hepsi `.env` dosyasında tanımlanmalı ve `constants.ts` üzerinden import edilmeli.
2. Tüm dış servis çağrıları (SQL, API, Power BI) try-catch ile sarılmalı ve anlamlı hata mesajları döndürmeli.
3. Servisler interface/abstract üzerinden yazılmalı — ileride kolayca değiştirilebilir olmalı (örn: Redis cache → in-memory cache swap).
4. Her servis dosyasında loglama zorunlu — hangi işlem yapıldı, ne kadar sürdü, başarılı mı.
5. Environment ayarları (dev, staging, production) `.env` ile yönetilmeli, koda hardcode edilmemeli.
6. Docker-compatible yazılmalı — container içinde çalışabilir olmalı.
