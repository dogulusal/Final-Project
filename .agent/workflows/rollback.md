---
description: Rollback application to a previously stable state and revert problematic commits
---

# /rollback

**Açıklama:** Sistemin bozulduğunun fark edildiği durumlarda (Azure deploy hatası, kritik crash veya data leak) güvenli bir önceki duruma geri dönüşü sağlar.

1. **Commit Loglarını Kontrol Et:**
   ```bash
   git log --oneline -n 5
   ```
   Son 5 yapılan işlem okunur ve güvenilen son stable (başarılı) commit Hash'i (örn: abc1234) bulunur.
2. **Geliştirici İzni:**
   "Son çalışan versiyon X olarak görünüyor. `git revert` ile geri alayım mı?" diye onay istenir. 
   (Kesinlikle direkt hard reset atılmaz).
3. **Uygulama:**
   ```bash
   git revert <hatali-commit-hash>
   # Veya
   # git rev-parse HEAD tespitleri..
   ```
4. **Re-Test (Test Tekrarı):**
   Değişiklik geri alındıktan sonra sistem eski güvenli halinde mi kontrol etmek için:
   ```bash
   npm run build
   npm test
   ```
5. **Raporlama:**
   Eğer rollback başarılıysa ve testler yeşil yanıyorsa;
   "Rolback başarıyla uygulandı, sistem eski stabil yapısına (xyz commit) döndürüldü. Lütfen hatayı lokal ortamda giderdikten sonra tekrar deneyin." mesajı dönülür.
