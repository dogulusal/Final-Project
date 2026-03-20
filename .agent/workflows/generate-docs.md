---
description: Auto-generate code and API documentations
---

# /generate-docs

**Açıklama:** `API Documenter` kimliği kullanılarak kod içerisindeki yeni fonksiyon ve servislerin dokümantasyonunu çıkaran workflow'dur.

1. **Son Değişiklikleri Analiz Et:**
   Yakın zamanda `src/services`, `src/bot/handlers` gibi dizinlerde eklenen yeni kod blokları taranır.
2. **Dokümantasyon Taslakları:**
   Eğer yeni bir HTTP endpoint'iyse:
   - İstek Modeli (Request)
   - Parametreler
   - Başarı Tanımı (200 OK) ve Hata Kodları (4xx, 5xx) JSON şeması olarak hazırlanır.
   Eğer Bot Handler'ıysa:
   - Hangi keywordlerde tetiklendiği.
   - Ne veri döneceği ve hangi servise bağımlı olduğu.
3. **Uygulama:**
   - JSDoc / TSDoc tagleri halinde koda geri yazılır.
   - Veya istenirse `docs/` dizininde bir Markdown (`.md`) dosyasına/sistemin ana `README.md` dosyasına özellik listesi olarak entegre edilir.
4. **Onay İsteme:** Yapılan doc güncellemelerini ekrana yansıt ve geliştirici onaylarsa kalıcılaştır.
