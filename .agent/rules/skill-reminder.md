# 🚨 ZORUNLU KURAL: OTOMATİK HATIRLATICI (PROAKTİF ASİSTAN) 🚨

Kullanıcı "kodla ilgili bir işlem, hata çözümü, özellik ekleme veya deploy" yaptığında, işin asıl kısmı bittikten sonra **MUTLAKA** projendeki mevcut _Skills_ veya _Workflows_ listesinden uygun olan(lar)ı kullanıcıya aşağıdaki gibi öner/hatırlat. Kullanıcı bu araçları unutabilir, senin görevin ona hatırlatmaktır.

## 🎯 Ne Zaman Ne Hatırlatılmalı?

### 🧩 YENİ KOD VEYA ÖZELLİK EKLENDİĞİNDE
- Kod yazıldı veya değiştirildi: "Değişiklikleri **Code Reviewer** veya **Refactoring Advisor** ile incelemememi ister misin?"
- Yeni bir özellik (feature) eklendi: "Bu özelliğin entegrasyonu bitince **Feature Adviser** ile eksik özellik/etki analizi yapalım mı?"
- Yeni bir Route veya API Endpoint eklendi: "**Security Auditor** ile yeni uç noktanın güvenlik taramasını yapalım mı? İstersen **API Documenter** ile dokümantasyonunu da oluşturabilirim."

### 🎨 UI / FRONTEND DEĞİŞİKLİĞİNDE
- Arayüz kodlandı/güncellendi: "**UI Designer** ile tasarımı daha premium bir hale getirelim mi?"

### 🧪 TEST VE KALİTE GÜVENCESİ
- Kod yazıldı ama test edilmedi: "**Test Engineer** ile birim veya entegrasyon testlerini yazalım mı?"
- Ciddi bir hata çözüldü veya servis mantığı değişti: "**Performance Profiler** ile memory leak veya N+1 query kontrolü yapalım mı?"

### 🚀 PROMPT / GÖREV İSTEKLERİ
- Kullanıcı karmaşık veya genel geçer bir prompt/istek gönderdi: İhtiyaç duyarsan "Bunu işleme almadan önce **Prompt Enhancer** ile talebini daha da netleştirip iyileştirelim mi?" diye sor.

### ⚙️ WORKFLOW HATIRLATMALARI (Deploy, Commit, Bakım)
- Birden fazla dosyada değişiklik yapıldı ve iş bitti: "Değişiklikleri github'a atmadan önce **/analyze-project-changes** workflow'u ile analiz edip commit edelim mi?"
- Bot kodu değiştirildi (app, bot, teams mantığı): "Yaptığımız değişiklikleri **/test-bot** workflow'u ile yerel ortamda test edelim mi?"
- Her şey tamam, canlıya alacağız: "Bütün değişiklikler hazırsa **/deploy** workflow'unu çalıştıralım mı? Veya öncesinde **/health-check** veya **/security-scan** yapalım mı?"
- Bağımlılıklarla ilgili bir konu geçtiyse: "Projedeki paketleri **/update-deps** ile güncelleyelim mi?"

## ⚠️ KURALLAR
1. Soruyu sormadan önce mutlaka kullanıcının talebini yerine getir, işi bitir. Sadece cevaplamaktan çekinme, **aksiyonu tamamladıktan sonra son satırda** teklifini sun.
2. Aynı mesaj içinde alakasız 5 tane skill/workflow önerme. O anki bağlama **en uygun 1 veya 2 tanesini** seç.
3. Asla unutturma. Her somut ilerlemede "Bundan sonra şunu da yapabiliriz, ister misin?" yaklaşımını benimse.
4. Kullanıcı "hatırlatma yapma" derse, o session (sohbet) boyunca hatırlatmaları durdur.
