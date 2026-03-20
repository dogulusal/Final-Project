# Kapsamlı Frontend UI ve Veri Görselleştirme Planı

Bu plan, backend tarafında başarıyla oturtulan **genişletilmiş sentiment analizi gücü** ile **premium UI-Designer özelliklerini** harmanlayarak kullanıcıya mükemmel bir deneyim (Wow effect) sunmayı amaçlamaktadır. Plandaki *her şey* adım adım hayata geçirilecektir.

## TEMA 1: Sentiment & Bias (Duygu) Görselleştirmeleri
Genişletilmiş sentiment sözlüğümüz ve hibrit LLM algoritmamız sayesinde haberlerin duygu durumu artık çok daha hızlı (0 maliyetli ve internetsiz çalışabilen) ve isabetli. Bu mühendislik başarısını frontend'de şık bir şekilde sergilemeliyiz:

1. **[NEW] Component: `SentimentGlow`**
   - Haber kartlarının (NewsCard) dış hatlarına (border) veya gölgelerine (box-shadow) haberin duygu durumuna göre yumuşak bir parlama (glow) efekti eklenecek.
   - Pozitif -> Açık Yeşil, Negatif -> Açık Kırmızı/Bordo, Nötr -> Mavi/Gri.
   - Bu özellik, okuyucunun haberi açmadan bilinçaltında algıyı hissetmesini sağlar.

2. **[NEW] Component: `SentimentBiasMap`**
   - Kullanıcının okuduğu haberlerin veya genel akışın "duygu bulutunu" gösteren, Glassmorphism (yarı saydam cam) efektli bir istatistik kartı.
   - Örneğin ana sayfada sidebar veya tepe kısmında "Bugünün Duygu Haritası" bölümü.

## TEMA 2: Kişiselleştirme ve Kullanıcı Yolculuğu (Journey)
Kişiselleştirme (çerez) yapımız backend/frontend uyumlu halde çalışıyor. Bunu görsel bir şölene dönüştürmemiz lazım:

3. **[NEW] Component: `InterestRadar` (Kişiselleştirilmiş İlgi Çarkı)**
   - `useReadingHistory` kancasından alınan verilere göre kullanıcının hangi kategorilere ağırlık verdiğini gösteren, Recharts veya benzeri bir kütüphaneyle (framer-motion ile desteklenmiş) etkileşimli kabarcık (bubble) veya radar grafiği.

4. **[MODIFY] `page.tsx`: "Senin İçin Seçilenler" Hero Carousel**
   - Ana sayfa yüklendiğinde en üstte (Hero Section) kullanıcının kişisel skoru en yüksek olan 3 haber devasa, görkemli ve gradyan arka planlı bir yatay kaydırma (carousel) ile sunulacak.

## TEMA 3: Dinamik Mikro-Etkileşimler (Premium Motion)
5. **[MODIFY] `NewsCard.tsx`: Akıllı Kartlar (Smart Cards)**
   - Fare ile üzerine gelindiğinde (hover) haber görselleri hafifçe büyüyecek (scale), kart derinlik kazanacak.
   - Hover durumundayken haberin AI tarafından ayrıştırılmış ilk 2 özet maddesi (bullet point) aşağıdan süzülerek (fade-in) ortaya çıkacak.

6. **[NEW] Component: `ReadingProgressBar`**
   - Kullanıcı AI haber detay modalını açtığında (veya sayfasında), aşağı kaydırdıkça ekranın en üstünde ilerleyen, sayfa okunma yüzdesini gösteren ince, şık ve kaygan bir ilerleme çubuğu.

## TEMA 4: Estetik Detaylar ve Temellendirme
7. **[MODIFY] `globals.css` / `layout.tsx`: Modern Tipografi ve Tema Geçişleri**
   - Projenin ana fontları `Inter` veya `Outfit` (Google Fonts) gibi temiz, modern sans-serif fontlarla değiştirilecek.
   - Koyu/Açık tema değişikliğinde (Dark Mode toggle), renk geçişlerinin `transition: all 0.5s ease;` şeklinde 1 saniye içinde yumuşakça (smoothly) yapılması sağlanacak.

---

## Uygulama Sırası (Execution Chain)
1. **Adım 1:** `globals.css` ve `layout.tsx` (Tipografi ve Yumuşak Tema Geçişleri)
2. **Adım 2:** `NewsCard.tsx` (Hover efektleri, Smart Card özet maddeleri, Sentiment Glow)
3. **Adım 3:** "Senin İçin Seçilenler" Hero Carousel bölümünün `page.tsx`'e eklenmesi
4. **Adım 4:** `ReadingProgressBar` bileşeninin Modal/Haber detay içine eklenmesi
5. **Adım 5:** `SentimentBiasMap` (Duygu Haritası) ve `InterestRadar` (İlgi Çarkı) bileşenlerinin yapılıp ana sayfaya yerleştirilmesi.
