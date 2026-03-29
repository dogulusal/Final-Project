# Frontend — AI Haber Ajansı

Bu dizin Next.js 16 tabanlı kullanıcı arayüzünü içerir.

## Komutlar

```bash
# development
npm run dev

# production build
npm run build

# production start
npm run start

# lint
npm run lint
```

## Varsayılan Portlar

- Lokal dev: `http://localhost:3001`
- Docker compose: `http://localhost:3003`

## Ortam Değişkenleri

`frontend/.env.local` içinde en az şu değer olmalıdır:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3002
```

## Notlar

- Ana sayfada `HeroCarousel`, `PersonalizedHeroCarousel`, `SentimentBiasMap`, `InterestRadar` bileşenleri `next/dynamic` ile lazy yüklenir.
- Kişiselleştirilmiş haber sıralaması memoize edilerek gereksiz yeniden hesaplama azaltılmıştır.
