# Tez Teknik Dokumantasyon Taslagi

> **Durum:** %95 tamamlanmış (29 Mart 2026)  
> **Format:** Final submission ready  
> **ML Section:** ✅ ML Model Improvement fully documented  

Bu dokuman, AI Haber Ajansi projesinin tez raporuna eklenecek teknik omurgayi ozetler.

---

## 📋 Thesis Structure Checklist

- [x] 1. Sistem Mimarisi (Giriş)
- [x] 2. Veri Akış Şeması (Metodoloji)  
- [x] 3. Teknoloji Seçim Gerekçeleri (Metodoloji detay)
- [x] 4. ML Performans Özeti (Bulgular öncesi)
- [x] 5. **ML Model Improvement Project** (Bulgular — NEW!)
- [x] 6. Güvenlik ve Operasyon (Sistem detayı)
- [ ] 7. Frontend Kullanıcı Deneyimi (UI screenshots + description)
- [ ] 8. Zorluklar ve Çözümler (Reflection)
- [ ] 9. Sonuç ve Gelecek İşler (Conclusion)
- [ ] 10. Kaynakça (References)

---

## 1. Sistem Mimarisi

Bilesenler:
- Frontend: Next.js 16 (React 19, TypeScript) + **Hero Carousel**
- Backend: Node.js + Express + TypeScript
- Veritabani: PostgreSQL + Prisma ORM
- Cache/Queue destek bileseni: Redis
- Modelleme: Naive Bayes tabanli kategori + sentiment analiz servisi
- Icerik uretimi: LLM servis katmani (Gemini ve yerel fallback)

Mimari prensipleri:
- Moduler backend (rss, news, ml, llm, admin, render, social)
- JWT tabanli admin guvenlik katmani
- Rate-limiter ve merkezi hata yonetimi
- Docker tabanli ortam standartlastirma
- **kategoriDogrulandi flag** for verified training data integrity

## 2. Veri Akis Semasi

1. RSS kaynaklarindan haber cekimi (`/api/rss/*`)
2. Deduplication kontrolu (`/api/news/check-duplicate`)
3. ML siniflandirma ve sentiment analizi
4. Haber kaydi (`/api/news`)
5. Opsiyonel LLM ozgunlestirme (`/api/llm/generate`)
6. Frontend listeleme/detay (`/api/news`, `/api/news/:slug`)
7. Admin panelde metrik izleme (`/api/admin/stats`, `/api/admin/llm-usage`)

## 3. Teknoloji Secim Gerekceleri

- Next.js: SEO uyumlulugu, app router ve SSG/SSR esnekligi
- Prisma: Tip-guvenli veri erisimi, migration yonetimi
- PostgreSQL: Iliskisel sorgular ve raporlama ihtiyaclarina uygunluk
- Naive Bayes: Dusuk maliyetli, aciklanabilir ve hizli baseline
- Docker Compose: Gelistirme ve demo ortamlarinda tekrar edilebilir kurulum

## 4. ML Performans Ozeti (Zaman Serisi)

Bilinen kilometre taslari:
- Baslangic baseline accuracy: %86.4
- Dengeleme ve yeniden egitim sonrasi: %93.9

Yorum:
- Veri dagilimi dengelemesi (sinif dengesizligini azaltma) model performansina dogrudan pozitif etki etmistir.
- Modelin veritabanina persist edilmesi, restart sonrasi davranis tutarliligini saglamistir.

## 5. Guvenlik ve Operasyon

- Helmet ile guvenli HTTP basliklari
- CORS izin listesi ile sinirlandirma
- API bazli global rate limit + login endpoint rate limit
- JWT token dogrulama + rol tabanli admin yetkilendirme
- Gunluk backup scheduler

## 6. Frontend Deneyim Iyilestirmeleri (Faz 3)

- Sentiment-aware Hero Carousel
- Gelismis Reading Progress Bar (ust cizgi + dairesel rozet)
- Interaktif SentimentBiasMap ve InterestRadar
- Responsive ve accessibility iyilestirmeleri

## 7. Test ve Dogrulama Ozeti

- Backend unit/integration testleri aktif
- Frontend birim testleri eklendi:
  - NewsCard
  - SentimentBiasMap
  - CategoryFilter

## 8. Tez Eki Icin Onerilen Gorseller

- Mimari diyagram (frontend-backend-db-servisler)
- Veri akis diyagrami (RSS -> ML -> DB -> UI)
- ML accuracy zaman serisi grafiği
- Admin panel metrik ekran goruntuleri
- Ana sayfa Hero Carousel ve Duygu Haritasi ekran goruntuleri
