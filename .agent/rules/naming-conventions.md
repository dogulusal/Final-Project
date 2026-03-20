# Naming Conventions (İsimlendirme Standartları)

Proje içindeki kod okunabilirliğini sağlamak adına isimlendirmeler her zaman aşağıdaki kurallara göre yapılmalıdır:

## 1. Dosya ve Dizin İsimlendirmeleri
- **Dosya İsimleri:** Daima camelCase (veya kebap-case) kullanılmalı. Node.js backend projelerinde genelde `camelCase` tercih edilir.
  - Örnek: `userController.ts`, `sqlService.ts`, `abTestService.test.ts`
- **Dizin İsimleri:** Daima küçük harfle başlar, kebap-case veya tek kelime.
  - Örnek: `middleware`, `data-access`

## 2. Kod İçi İsimlendirmeler

| Tür | Kural | Örnek |
| --- | --- | --- |
| Sınıflar (Class) | **PascalCase** | `class DatabaseConnection { ... }`, `class GenAIService { ... }` |
| Fonksiyonlar ve Metodlar | **camelCase** | `function getUserById()`, `public fetchToken() { ... }` |
| Değişkenler | **camelCase** | `let userList = [];`, `const databasePort = 1433;` |
| Sabit Değerler (Constant) | **UPPER_SNAKE_CASE** | `const MAX_RETRY_COUNT = 3;`, `const DEFAULT_LOCALE = "tr-TR";` |

## 3. TypeScript Spesifik (Arayüz & Enum)
- **Interface'ler:** TypeScript dünyasında eski usül başa "I" koyma adeti esnetilmiştir. Modern conventionlarda `PascalCase` ile doğrudan isim verilebilir (ancak projede halihazırda `IUser` formatı baskınsa ona uyulur).
  - Örnek: `interface UserRole`, `interface SqlQueryResponse`
- **Enum'lar:** `PascalCase` isimlendirilir, özellikleri ise genellikle ya `PascalCase` ya da `UPPER_SNAKE_CASE` yazılır.
  - Örnek: `enum TaskStatus { InProgress = 0, Completed = 1 }`

## 4. Genel İpuçları
- Kısaltmalardan kaçının: `usrId` yerine `userId`, `cb` yerine `callback`, `ctx` yerine `context`. Kod anlaşılır ve kendi kendini açıklayan kelimelerden oluşmalıdır.
