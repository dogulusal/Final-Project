# AI Haber Ajansı — API Referansı

**Base URL:** `http://localhost:3001`  
**Content-Type:** `application/json`  
**Auth:** `Authorization: Bearer <access_token>` (korumalı endpointler için)

---

## Authentication

### POST /api/admin/login
Admin girişi. JWT token döner.

**Public endpoint — auth gerekmez.**

**Request:**
```json
{
  "email": "admin@newsagency.com",
  "sifre": "admin123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "admin@newsagency.com",
      "ad": "Admin"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

**Error (401):**
```json
{ "success": false, "error": "Hatalı şifre" }
```

**Rate Limit:** 5 istek / 15 dakika (production'da)

---

## Health

### GET /api/health
Sistem durumu kontrolü. **Public endpoint.**

**Response (200):**
```json
{
  "status": "ok",
  "environment": "development",
  "timestamp": "2026-03-28T10:00:00.000Z"
}
```

---

## Haberler

### GET /api/news
Son haberleri listeler.

**Query Parameters:**

| Parametre | Tip | Default | Açıklama |
|-----------|-----|---------|----------|
| `page` | number | 1 | Sayfa numarası |
| `limit` | number | 20 | Sayfa başına kayıt |
| `status` | string | - | `ham` \| `hazir` \| `yayinda` |
| `search` | string | - | Başlık araması |
| `category` | string | - | Kategori slug'ı |

**Response (200):**
```json
{
  "success": true,
  "count": 20,
  "total": 1346,
  "totalPages": 68,
  "page": 1,
  "data": [
    {
      "id": 1,
      "baslik": "Türkiye Ekonomisi Güçleniyor",
      "slug": "turkiye-ekonomisi-gucleniyor",
      "kategori": { "id": 2, "ad": "Ekonomi", "slug": "ekonomi" },
      "sentiment": "Pozitif",
      "mlConfidence": 0.92,
      "yayinlanmaTarihi": "2026-03-28T10:00:00.000Z",
      "durum": "hazir"
    }
  ]
}
```

### GET /api/news/categories
Tüm kategorileri listeler.

**Response (200):**
```json
{
  "success": true,
  "data": [
    { "id": 1, "ad": "Gündem", "slug": "gundem", "renkKodu": "#FF5733", "ikon": "📰" }
  ]
}
```

### GET /api/news/:slug
Slug ile haber detayı.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "baslik": "Haber Başlığı",
    "icerik": "...",
    "kategori": { "ad": "Gündem" },
    "gorselUrl": "https://...",
    "yayinlanmaTarihi": "2026-03-28T10:00:00.000Z"
  }
}
```

### GET /api/news/id/:id
ID ile haber detayı.

**Response:** Aynı slug endpoint'i ile aynı format.

### POST /api/news
Yeni haber kaydet.

**Request:**
```json
{
  "baslik": "Haber Başlığı",
  "icerik": "Haber içeriği...",
  "kategoriId": 1,
  "kaynakUrl": "https://kaynak.com/haber"
}
```

### POST /api/news/check-duplicate
Haber tekrarı kontrol et.

**Request:**
```json
{ "title": "Kontrol edilecek başlık" }
```

**Response:**
```json
{
  "success": true,
  "is_duplicate": false,
  "similarity": 0.12,
  "matched_title": null
}
```

---

## Admin (JWT Gerekli)

> Tüm admin endpoint'leri `Authorization: Bearer <token>` header'ı gerektirir.
> Eksik veya geçersiz token: **401**.

### GET /api/admin/stats
Dashboard istatistikleri.

**Response (200):**
```json
{
  "success": true,
  "stats": {
    "totalNews": 1346,
    "activeCategories": 7,
    "mlAccuracy": "86.2",
    "mlTrainSize": 1442,
    "mlTestSize": 268,
    "avgConfidence": "78.4",
    "abTestCount": 0,
    "breakdown": { "hazir": 1200, "ham": 146, "yayinda": 0 },
    "llmBreakdown": { "gemini": 800, "bilinmiyor": 546 },
    "pipeline": { "enabled": true, "dailyQuota": 100 },
    "recentCategorizations": [...]
  }
}
```

### GET /api/admin/scheduler-status
RSS zamanlayıcı durumu.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "lastRun": "2026-03-28T09:50:00.000Z",
    "nextRun": "2026-03-28T10:00:00.000Z",
    "todayCount": 23,
    "failedSources": ["haberturk-spor"]
  }
}
```

### GET /api/admin/llm-usage
LLM token kullanımı ve maliyet takibi.

**Query Parameters:**

| Parametre | Tip | Default | Max |
|-----------|-----|---------|-----|
| `days` | number | 30 | 365 |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "period": {
      "days": 30,
      "startDate": "2026-02-27T00:00:00.000Z",
      "endDate": "2026-03-28T00:00:00.000Z"
    },
    "byProvider": [
      {
        "provider": "gemini",
        "callCount": 245,
        "totalInputTokens": 184200,
        "totalOutputTokens": 73500,
        "estimatedCost": 0.0358
      }
    ],
    "totalCost": 0.0358
  }
}
```

### GET /api/admin/sentiment-stats
Duygu analizi istatistikleri.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "distribution": {
      "Pozitif": { "count": 523, "percentage": 43 },
      "Nötr":    { "count": 498, "percentage": 41 },
      "Negatif": { "count": 193, "percentage": 16 }
    },
    "totalArticles": 1214,
    "confidence": {
      "average": 78,
      "min": 45,
      "max": 99
    },
    "trend": [
      { "date": "2026-03-21", "sentiment": "Pozitif", "count": 12 }
    ]
  }
}
```

---

## ML

> `Authorization: Bearer <token>` veya `x-api-key` gerektirir.

### POST /api/ml/train
DB'deki onaylı haberlerden modeli yeniden eğitir.

**Response (200):**
```json
{
  "success": true,
  "message": "Model DB üzerindeki Onaylı Haberler ile başarıyla eğitildi."
}
```

**Error (500):**
```json
{
  "success": false,
  "message": "Model eğitimi başarısız oldu."
}
```

### POST /api/ml/categorize
Metin kategorize et.

**Request:**
```json
{
  "text": "Türkiye Büyük Millet Meclisi bugün toplandı...",
  "title": "TBMM Toplantısı"
}
```

**Response (200):**
```json
{
  "success": true,
  "query": "TBMM Toplantısı",
  "kategori": "Gündem",
  "guven_skoru": 0.89,
  "detayli_skorlar": [
    { "label": "Gündem", "value": 0.89 },
    { "label": "Siyaset", "value": 0.08 }
  ],
  "uyari": null
}
```

---

## RSS

### GET /api/rss/test
Test RSS kaynaklarından örnek haberleri döner.

**Response (200):**
```json
{
  "success": true,
  "totalItems": 24,
  "sample": [
    {
      "title": "Örnek Haber",
      "source": "NTV Son Dakika",
      "link": "https://..."
    }
  ]
}
```

### POST /api/rss/health
Tek bir RSS URL'inin erişilebilirliğini ve parse edilebilirliğini kontrol eder.

**Request:**
```json
{ "url": "https://feeds.bbci.co.uk/turkce/rss.xml" }
```

**Response (200):**
```json
{
  "success": true,
  "url": "https://feeds.bbci.co.uk/turkce/rss.xml",
  "isHealthy": true
}
```

**Error (400):**
```json
{
  "success": false,
  "error": "Yalnızca HTTP/HTTPS protokolüne izin verilir"
}
```

---

## LLM

> `Authorization: Bearer <token>` veya `x-api-key` gerektirir.

### POST /api/llm/generate
Başlık + özetten özgün haber metni üretir.

**Request:**
```json
{
  "title": "Merkez Bankası Faiz Kararı",
  "summary": "Politika faizi sabit tutuldu.",
  "category": "Ekonomi",
  "url": "https://kaynak.com/haber"
}
```

**Response (200):**
```json
{
  "success": true,
  "original_title": "Merkez Bankası Faiz Kararı",
  "generated": {
    "baslik": "Merkez Bankası Faizi Sabit Tuttu",
    "ozet": "...",
    "icerik": "...",
    "kaynak_url": "https://kaynak.com/haber"
  }
}
```

---

## Render

### POST /api/render/generate
Haber başlığından sosyal medya görseli üretir (PNG binary döner).

**Request:**
```json
{
  "title": "Örnek Başlık",
  "category": "Teknoloji",
  "source": "AI Haber Ajansı",
  "date": "29.03.2026",
  "preset": "TWITTER_POST"
}
```

**Response (200):**
- `Content-Type: image/png`
- `X-Image-Width`, `X-Image-Height` header'ları ile boyut bilgisi
- Body: PNG binary

### GET /api/render/presets
Desteklenen render preset boyutlarını döner.

**Response (200):**
```json
{
  "success": true,
  "presets": [
    { "name": "TWITTER_POST", "width": 1200, "height": 675 }
  ]
}
```

---

## Social

### POST /api/social/publish
Sosyal medya dağıtımını tetikler (şu an mock mode).

**Request:**
```json
{
  "baslik": "Örnek Başlık",
  "ozet": "Örnek özet",
  "gorsel_url": "https://.../image.png",
  "haber_url": "https://.../haber",
  "etiketler": ["gundem", "ekonomi"]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "⚠️ MOCK MODE: Sosyal medya paylaşımları simüle edildi. Gerçek API entegrasyonu henüz yapılmadı.",
  "mock": true,
  "data": {
    "twitter": { "success": true },
    "telegram": { "success": true }
  }
}
```

---

## Error Responses

Tüm hata yanıtları şu formattadır:

```json
{
  "success": false,
  "error": "Hata mesajı",
  "code": "ERROR_CODE"
}
```

**HTTP Durum Kodları:**

| Kod | Açıklama |
|-----|----------|
| 200 | Başarılı |
| 201 | Oluşturuldu |
| 400 | Geçersiz istek (eksik/hatalı parametre) |
| 401 | Kimlik doğrulama hatası (`NO_TOKEN`, `TOKEN_EXPIRED`, `INVALID_TOKEN`) |
| 403 | Yetki hatası (`INSUFFICIENT_PERMISSIONS`) |
| 404 | Kaynak bulunamadı |
| 429 | Rate limit aşıldı (`RATE_LIMIT_EXCEEDED`) |
| 500 | Sunucu hatası |
