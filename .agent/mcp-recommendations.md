# Recommended MCP Servers for AI News Agency

Bu proje için gelişim sürecini hızlandıracak ve otomatize edecek önerilen MCP sunucuları:

## 1. GitHub MCP
- **Neden**: Kod değişikliklerini PR (Pull Request) seviyesinde denetlemek, issue takibi yapmak ve CI/CD süreçlerini bot üzerinden yönetmek için.
- **Kullanım**: `github.create_pull_request`, `github.list_repository_issues`.

## 2. Sequential Thinking MCP
- **Neden**: Karmaşık ML mimarisi veya RSS kuyruk yönetimi gibi "derin düşünme" gerektiren görevlerde botun adım adım mantık yürütmesini sağlamak için.
- **Kullanım**: Mimari refactor planlamalarında.

## 3. Fetch / Newspaper (Web Content) MCP
- **Neden**: RSS'ten gelen linklerin sadece snippet'larını değil, tam metinlerini (full content) temiz bir şekilde parse etmek için. Şu anki `read_url_content` genel bir araçtır, bu araç tamamen haber odaklıdır.
- **Kullanım**: Haber botunun detaylı içerik analizi yaparken.

## 4. Mem0 / Long-term Memory MCP
- **Neden**: Tekrarlayan hataları (örn: CJK karakter hatası gibi) geçmiş seanslardan hatırlayıp proaktif uyarılar vermek için.
- **Kullanım**: Audit seanslarında geçmiş bulguları otomatik getirmek için.

## 5. PostgreSQL / Prisma Visualizer MCP
- **Neden**: Veritabanı durumunu, tablo ilişkilerini ve kategori dağılımlarını anlık görselleştirmek için.
- **Kullanım**: Admin panelindeki verilerin doğruluğunu kod yazmadan denetlemek için.
