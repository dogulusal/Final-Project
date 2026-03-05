"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import NewsGrid from "@/components/NewsGrid";
import CategoryFilter from "@/components/CategoryFilter";
import StatsBar from "@/components/StatsBar";
import Footer from "@/components/Footer";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export interface NewsItem {
  id: number;
  baslik: string;
  slug: string;
  metaAciklama: string | null;
  icerik: string | null;
  kategoriId: number;
  kaynakUrl: string | null;
  gorselUrl: string | null;
  sentiment: string | null;
  durum: string;
  mlConfidence: number | null;
  yayinlanmaTarihi: string;
  goruntulemeSayisi: number;
  kategori: {
    id: number;
    ad: string;
    slug: string;
    renkKodu: string;
    ikon: string | null;
  };
}

export default function Home() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("Tümü");

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/news?limit=50`);
      const data = await res.json();
      if (data.success) {
        setNews(data.data);
      }
    } catch {
      // Backend kapalıysa demo verisiyle devam et
      setNews(DEMO_NEWS);
    } finally {
      setLoading(false);
    }
  };

  const filteredNews = activeCategory === "Tümü"
    ? news
    : news.filter(n => n.kategori?.ad === activeCategory);

  const categories = ["Tümü", ...Array.from(new Set(news.map(n => n.kategori?.ad).filter(Boolean)))];

  return (
    <main className="min-h-screen">
      <Navbar />
      <HeroSection />
      <StatsBar newsCount={news.length} />
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">
              <span className="gradient-text">Son Haberler</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="pulse-dot" />
              <span className="text-sm text-[var(--text-secondary)]">Canlı güncelleniyor</span>
            </div>
          </div>
          <CategoryFilter
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
          <NewsGrid news={filteredNews} loading={loading} />
        </motion.div>
      </section>
      <Footer />
    </main>
  );
}

// Demo data for when backend is offline
const DEMO_NEWS: NewsItem[] = [
  {
    id: 1, baslik: "Yapay Zeka Sektöründe Devrim: Yeni Model Dünya Çapında Ses Getirdi",
    slug: "yapay-zeka-sektorunde-devrim", metaAciklama: "AI dünyasında çığır açan gelişme",
    icerik: "Yapay zeka alanında uzun süredir beklenen gelişme nihayet gerçekleşti...",
    kategoriId: 3, kaynakUrl: "https://example.com", gorselUrl: null,
    sentiment: "Pozitif", durum: "yayinda", mlConfidence: 0.92,
    yayinlanmaTarihi: new Date().toISOString(), goruntulemeSayisi: 1250,
    kategori: { id: 3, ad: "Teknoloji", slug: "teknoloji", renkKodu: "#2d1a47", ikon: "💻" }
  },
  {
    id: 2, baslik: "Merkez Bankası Faiz Kararını Açıkladı: Piyasalarda Sert Hareketler",
    slug: "merkez-bankasi-faiz-karari", metaAciklama: "Faiz kararı piyasaları sarstı",
    icerik: "Merkez Bankası bugün yaptığı toplantıda politika faizini değiştirmeme kararı aldı...",
    kategoriId: 2, kaynakUrl: "https://example.com", gorselUrl: null,
    sentiment: "Nötr", durum: "yayinda", mlConfidence: 0.87,
    yayinlanmaTarihi: new Date(Date.now() - 3600000).toISOString(), goruntulemeSayisi: 890,
    kategori: { id: 2, ad: "Ekonomi", slug: "ekonomi", renkKodu: "#1a2a47", ikon: "💰" }
  },
  {
    id: 3, baslik: "Süper Lig'de Şampiyonluk Yarışı Kızıştı: Kritik Maç Sonuçları",
    slug: "super-lig-sampiyonluk-yarisi", metaAciklama: "Süper Lig'de heyecan dorukta",
    icerik: "Süper Lig'de bu hafta oynanan kritik maçlar şampiyonluk yarışını iyice kızıştırdı...",
    kategoriId: 1, kaynakUrl: "https://example.com", gorselUrl: null,
    sentiment: "Pozitif", durum: "yayinda", mlConfidence: 0.95,
    yayinlanmaTarihi: new Date(Date.now() - 7200000).toISOString(), goruntulemeSayisi: 2100,
    kategori: { id: 1, ad: "Spor", slug: "spor", renkKodu: "#1a472a", ikon: "⚽" }
  },
  {
    id: 4, baslik: "Seçim Anketlerinde Son Durum: Sürpriz Sonuçlar Ortaya Çıktı",
    slug: "secim-anketleri-son-durum", metaAciklama: "Anket sonuçları açıklandı",
    icerik: "Son yapılan kamuoyu araştırmalarında dikkat çekici sonuçlar ortaya çıktı...",
    kategoriId: 4, kaynakUrl: "https://example.com", gorselUrl: null,
    sentiment: "Nötr", durum: "yayinda", mlConfidence: 0.78,
    yayinlanmaTarihi: new Date(Date.now() - 10800000).toISOString(), goruntulemeSayisi: 1560,
    kategori: { id: 4, ad: "Siyaset", slug: "siyaset", renkKodu: "#471a1a", ikon: "🏛️" }
  },
  {
    id: 5, baslik: "Dünya Sağlık Örgütü'nden Kritik Açıklama: Yeni Salgın Uyarısı",
    slug: "dso-yeni-salgin-uyarisi", metaAciklama: "DSÖ'den yeni salgın uyarısı",
    icerik: "Dünya Sağlık Örgütü, küresel sağlık tehditlerine yönelik kapsamlı açıklama yaptı...",
    kategoriId: 6, kaynakUrl: "https://example.com", gorselUrl: null,
    sentiment: "Negatif", durum: "yayinda", mlConfidence: 0.81,
    yayinlanmaTarihi: new Date(Date.now() - 14400000).toISOString(), goruntulemeSayisi: 730,
    kategori: { id: 6, ad: "Sağlık", slug: "saglik", renkKodu: "#47381a", ikon: "🏥" }
  },
  {
    id: 6, baslik: "NATO Zirvesi'nde Kritik Kararlar: Türkiye'nin Rolü Öne Çıktı",
    slug: "nato-zirvesi-turkiye", metaAciklama: "NATO zirvesinden önemli kararlar",
    icerik: "NATO'nun olağanüstü zirvesinde alınan kararlar dünya gündemine oturdu...",
    kategoriId: 5, kaynakUrl: "https://example.com", gorselUrl: null,
    sentiment: "Pozitif", durum: "yayinda", mlConfidence: 0.88,
    yayinlanmaTarihi: new Date(Date.now() - 18000000).toISOString(), goruntulemeSayisi: 1890,
    kategori: { id: 5, ad: "Dünya", slug: "dunya", renkKodu: "#1a3847", ikon: "🌍" }
  },
];
