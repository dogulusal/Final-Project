---
description: Scan project for vulnerabilities, secret leaks, and bad dependency packages
---

# /security-scan

**Açıklama:** Projeyi baştan sona güvenlik taramasından geçiren otomatik pipeline adımıdır. Deploy öncesi ya da major değişiklikler sonrası tetiklenmeli.

1. **Bağımlılık Taraması (Dependency Audit):**
   ```bash
   npm audit
   ```
2. **Secret Kaçağı Taraması:**
   Dosyalarda `.env` dışında hardcode olarak bırakılmış anahtar (API KEY, Password, Secret) aranır.
   ```bash
   # Gelişmiş grep taramaları yapılır: (pass, key, secret kelimeleri .ts dosyalarında aranır).
   ```
3. **Statik Kod Analizi:**
   Security Auditor (Skill) kurallarına göre Controller ve Model dosyaları taranır:
   - Injection riskleri var mı?
   - Tüm yeni uç noktalarına auth logik/middleware'i eklenmiş mi?
4. **Sonuç Raporlama:**
   Analiz tamamlandıktan sonra tespit edilen Kritik/Orta düzey açıklar listelenir. Açık bulunursa **"Commit blocked. Fix required."** tarzında bir raporlama ile, güvenli kod önerisi verilir. 
