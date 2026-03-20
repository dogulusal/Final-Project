# Kalite Güvence (QA) Pipeline Kuralı

Büyük çaplı her geliştirme, refactoring veya yeni feature eklemesinden sonra KESİNLİKLE aşağıdaki 5 fazlı QA Pipeline planını uygulamak için **kullanıcıdan izin iste.** 

Eğer kullanıcı onay verirse bu 5 adımı sırasıyla uygula:

## Faz 1: Refactoring Advisor 🧹
**Amaç:** Son yapılan değişikliklerde teknik borç, code smell veya DRY ihlali var mı?
- Değişen servisleri ve büyük dosyaları tara
- Dead code / kullanılmayan import tespiti
- JSON config ve prompt mantığı tutarlılık kontrolü

## Faz 2: Code Reviewer 🔍
**Amaç:** Güvenlik, okunabilirlik ve performans açısından kritik bulguları tespit et.
- Yeni eklenen veya değişen dosyalarda Hardcoded değer, secret leak, input validation eksikliği ara
- `security-checklist.md` kuralına uygunluğu denetle

## Faz 3: Test Engineer 🧪
**Amaç:** Eksik veya zayıf test coverage tespit et, testleri güçlendir.
- Yeni akışlara ve mantıklara göre test ekle
- `npm test` komutunu çalıştırarak mevcut testlerin bozulmadığını (0 hata) doğrula

## Faz 4: /test-bot 🤖
**Amaç:** Botu lokalde başlatıp uçtan uca çalıştığını doğrula.
- `npm run dev` ile botu çalıştır
- `/health` endpointi ile sağlığını check et
- Sistem loglarında crash olup olmadığına bak

## Faz 5: /analyze-project-changes 📦
**Amaç:** Tüm değişiklikleri analiz et, lint/type-check yap ve commit'le.
- `npm run build` ile TypeScript sorunsuz derleniyor mu?
- `npm test` ile son testi al
- Conventional Commits ile commit yap.
