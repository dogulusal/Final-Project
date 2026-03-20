---
description: Test the live/local health of the system (SQL, API, Tokens, Memory)
---

# /health-check

**Açıklama:** Sistemin ayakta, veritabanı bağlantılarının stabil ve token servislerinin çalıştığından emin olmak için kullanılan tanı (diagnostic) aracıdır.

1. **Endpoint Kontrolü:**
   Sistem çalışıyorsa aşağıdaki endpoint'e istek atılır:
   ```bash
   curl -s http://localhost:3978/health
   # ya da production'da Azure URL'ine.
   ```
2. **Bağımlılık Durumları (Denetlenecek Servisler):**
   - **SQL Bağlantı Havuzu:** Ayakta mı?
   - **Power BI Token:** Geçerli mi? Expire olmuş mu?
   - **Azure OpenAI:** İsteklere yanıt veriyor mu? (Basit bir ping)
3. **Sistem Kaynakları (Opsiyonel Kontrol):**
   Gerekliyse sunucu hafıza (RAM) durumu ve Event Loop gecikmesi ölçümlenir.
4. **Analiz ve Rapor:**
   Sonuçlar derlenir ve aşağıdaki formatta (✅ ve ❌ kullanarak) net bir tablo olarak kullanıcıya sunulur. Eğer hata varsa, olası çözüm yolları loglarla birlikte gösterilir. 
