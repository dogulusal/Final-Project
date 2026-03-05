"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import NewsGrid from "@/components/NewsGrid";
import CategoryFilter from "@/components/CategoryFilter";
import SearchInput from "@/components/SearchInput";
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

  // P2: Search
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // P2: Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // Debounce logic for search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Sıfırla
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch logic
  const fetchNews = async () => {
    try {
      setLoading(true);
      const categoryQuery = activeCategory !== "Tümü" && !debouncedSearch ? `&status=hazir` : ""; // Or use category ID if supported via API
      let url = `${API_BASE}/api/news?page=${page}&limit=${limit}${categoryQuery}`;

      if (debouncedSearch) {
        url += `&search=${encodeURIComponent(debouncedSearch)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setNews(data.data);
        setTotalPages(data.totalPages || 1);
      } else {
        setNews([]);
      }
    } catch {
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();

    // P1: Auto-refresh mechanism (Her 60 saniyede bir sessiz yenile)
    const interval = setInterval(() => {
      fetchNews();
    }, 60000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch]); // Kategoriyi şimdilik filtrelemeyi client-side yapalım, search/page server-side olsun

  // Eğer search yoksa kategorileri listele ve client-side filtrele:
  const filteredNews = activeCategory === "Tümü" || debouncedSearch
    ? news
    : news.filter(n => n.kategori && n.kategori.ad === activeCategory);

  const categories = ["Tümü", "Spor", "Ekonomi", "Teknoloji", "Siyaset", "Dünya", "Sağlık", "Genel"];

  return (
    <main className="min-h-screen">
      <Navbar />
      <HeroSection />

      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <h2 className="text-3xl font-extrabold tracking-tight">
              Güney <span className="gradient-text">Gündemi</span>
            </h2>
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 w-full sm:w-auto">
              <SearchInput value={search} onChange={setSearch} />

              <div className="flex items-center gap-3">
                <span className="pulse-dot" />
                <span className="text-sm font-medium text-[var(--text-secondary)]">Gerçek Zamanlı Akış</span>
              </div>
            </div>
          </div>

          <CategoryFilter
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={(cat) => {
              setActiveCategory(cat);
              setSearch(""); // Arama varsa sıfırla
              setPage(1); // Sayfayı sıfırla
            }}
          />

          <NewsGrid news={filteredNews} loading={loading && news.length === 0} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center mt-12 gap-4">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-6 py-2 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
              >
                Önceki
              </button>
              <span className="text-sm font-semibold text-[var(--text-secondary)]">
                Sayfa {page} / {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="px-6 py-2 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-[var(--accent-blue)]"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
              >
                Sonraki
              </button>
            </div>
          )}

        </motion.div>
      </section>
      <Footer />
    </main>
  );
}
