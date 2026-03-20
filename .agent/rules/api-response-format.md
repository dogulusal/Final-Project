# API Response Format Convention

Proje içindeki tüm API Controller'ları ve Handler'ları, istemciye (frontend / bot) yanıt dönerken TUTARLI bir JSON formatı kullanmalıdır.

## 1. Başarılı İşlemler (HTTP 200, 201 vb.)

Başarılı her isteğin gövdesinde (body) şu standart obje bulunmalıdır:
```json
{
  "success": true,
  "data": {
    // İşlem sonucunda dönen gerçek veriler (ör: obje, array)
  },
  "message": "Opsiyonel başarı/bilgi mesajı" // Sadece gerekliyse (ör: "Kayıt başarıyla oluşturuldu")
}
```

## 2. Hatalı İşlemler (HTTP 400, 401, 403, 404, 500 vb.)

Hata fırlatıldığında veya yakalandığında (try-catch mekanizması ya da global errorHandler üzerinden) yanıt her zaman şu formatta dönmelidir:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_BURAYA", // Örnek: "VALIDATION_FAILED", "UNAUTHORIZED", "DB_CONNECTION_ERROR"
    "message": "Kullanıcıya gösterilebilecek açıklayıcı, ancak sızıntı yapmayan hata mesajı"
  }
}
```

## 3. Kurallar
- Asla sadece `res.send("Hata oldu")` veya `res.json({ foo: "bar" })` şeklinde düz responselar dönmeyin. Her zaman `success` ve `data`/`error` sarmalamasını yapın.
- Hassas veriler (şifreler, tokenlar, stack traceler, iç SQL hata kodları) `error.message` kısmına yazılmamalıdır! Loglama arka planda yapılabilir ancak kullanıcıya/cliente güvenli bir hata mesajı iletilmelidir.
- HTTP Status Code'lar mantıklı seçilmelidir: (200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Internal Server Error)
