# Commit Message Format (Conventional Commits)

Projede yapacağınız tüm GitHub Commit mesajları, profesyonel bir log takibi için **Conventional Commits** standartlarına uymak zorundadır.

## 1. Format
Commit mesajları şu şablona sadık kalmalıdır:
```
<type>(<scope>): <kısa-açıklama>

[opsiyonel uzun açıklama gövdesi nedenleriyle birlikte]

[opsiyonel FOOTER (örn: Closes #12)]
```

## 2. Type (Tür) Seçenekleri
Mesajın en başında işlemin ne tür bir değişiklik olduğunu gösteren bir tag bulunmalıdır:
- **feat**: Kullanıcı / proje için yeni bir özellik.
- **fix**: Bir hata / bug düzeltmesi.
- **docs**: Kod mantığına dokunmayan, sadece README, docs/, JSDoc vb. belge değişiklikleri.
- **style**: Kod düzenini (formatlama, eksik noktalı virgüller, prettier vb.) etkileyen ama mantığı değiştirmeyen kodlar.
- **refactor**: Yeni bir hata düzeltmeyen ya da özellik eklemeyen, ancak kodun iç iskeletini iyileştiren (ör: kodu modülle ayırma) süreç.
- **test**: Yeni bir test ekleme veya eksik/bozuk testleri düzeltme süreci.
- **chore**: Build süreci, yardımcı araçlar, CI/CD ayarları ve dev dependency güncellemeleri. (Örn: npm update)

## 3. Örnek Kullanımlar

```bash
# Sadece özellik eklendi:
feat(sql): add specific database query builder

# Bir bug çözüldü ve uzun açıklaması var:
fix(bot): resolve conversation state leak issue

The bot was keeping too much history in RAM, resulting in memory leak.
Added cleanup middleware.

# Dökümantasyon değişti:
docs(readme): add healthcheck endpoint details

# Kurulum paketleri güncellendi:
chore(deps): bump express to v4.18
```
