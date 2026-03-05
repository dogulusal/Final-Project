"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import NewsGrid from "@/components/NewsGrid";
import CategoryFilter from "@/components/CategoryFilter";
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
  okumaSuresiDakika: number | null;
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
      } else {
        setNews([]);
      }
    } catch {
      // Backend kapalıysa veya hata varsa boş liste göster
      setNews([]);
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
      <section className="max-w-[1500px] w-full mx-auto px-6 lg:px-12 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 gap-4">
            <h2 className="text-3xl font-extrabold tracking-tight">
              Güney <span className="gradient-text">Gündemi</span>
            </h2>
            <div className="flex items-center gap-3">
              <span className="pulse-dot" />
              <span className="text-sm font-medium text-[var(--text-secondary)]">Gerçek Zamanlı Akış</span>
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
