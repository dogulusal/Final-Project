---
trigger: always_on
---

# Multilingual Safety Rules

Haber kaynaklarından (RSS/API) gelen verilerin temizliğini ve çok dilli karakter güvenliğini sağlar:

1. **Anti-Garbage Filter**: Gelen haber başlığı veya içeriğinde %20'den fazla CJK (Çince, Japonca, Korece) karakteri veya anlamsız UTF-8 sembolü varsa haber otomatik olarak "reddedildi" (rejected) statüsüne alınır.
2. **Standardization**: Tüm metin girişleri `trim()` edilmeli ve HTML tag'lerinden tamamen arındırılmalıdır (Content Quality Filter kullanılmalıdır).
3. **Language Detection**: Haber dili Türkçe veya İngilizce değilse, sistem tarafından çevrilmedikçe ana akışta gösterilmez.
4. **Encoding Check**: Veritabanına kayıt öncesi metnin `utf-8` geçerliliği kontrol edilmelidir. `?` veya `` gibi bozuk karakter içeren metinler temizlenmeden kaydedilmemelidir.
