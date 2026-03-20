---
description: Update project npm dependencies safely
---

# /update-deps

**Açıklama:** Projedeki NPM paketlerinin eski versiyonlarını güncelleyen, breaking-change risklerini kontrol edip onay alan bakım işlemidir.

1. **Kontrol (Outdated Check):**
   ```bash
   npm outdated
   ```
   Hangi paketlerin major, minor ve patch seviyesinde güncelleme aldığı incelenir.
2. **Güvenlik Çakışması Analizi:**
   Eğer bir `major` paket güncellemesi varsa (örneğin `express` v4'ten v5'e), bunun kodu bozup bozmayacağı (breaking-change) kontrol edilir/hatırlatılır.
3. **Güncelleme (Eksikse onaysız yapma):**
   Safe (minor/patch) güncellemeler uygulanır:
   ```bash
   npm update
   ```
4. **Doğrulama (Verification):**
   ```bash
   npm run build
   npm test
   ```
   Eğer paket güncellemesi sonrası kod kırılırsa (build hata verirse), hangi paketten sebep olduğu bulunur ve eski versiyona rollback önerilir.
5. **Raporlama:** "Uygulanan güncellemeler ve sistem durumu sağlıklı mı?" sonucu Geliştiriciye iletilir.
