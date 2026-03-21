"use client";

import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import NewsFeed from "@/features/news/ui/NewsFeed";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Search, Target } from "lucide-react";
import { NewsItem } from "@/types/news";
import { useReadingHistory } from "@/hooks/useReadingHistory";
import { personalizedSort } from "@/utils/personalizedSort";
import PersonalizedHeroCarousel from "@/components/PersonalizedHeroCarousel";
import SentimentBiasMap from "@/components/SentimentBiasMap";
import InterestRadar from "@/components/InterestRadar";
import LazySection from "@/components/LazySection";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";


const CATEGORIES = [
    { name: "Tümü", slug: "Tümü", icon: "🏠" },
    { name: "Genel", slug: "genel", icon: "📰" },
    { name: "Spor", slug: "spor", icon: "⚽" },
    { name: "Teknoloji", slug: "teknoloji", icon: "💻" },
    { name: "Ekonomi", slug: "ekonomi", icon: "💰" },
    { name: "Siyaset", slug: "siyaset", icon: "🏛️" },
    { name: "Sağlık", slug: "saglik", icon: "🏥" },
    { name: "Dünya", slug: "dunya", icon: "🌍" },
];

export default function Home() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActive] = useState("Tümü");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  const { getInterests, isPersonalized } = useReadingHistory();

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(t);
  }, [search]);

  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      const category = CATEGORIES.find(c => c.name === activeCategory);
      const catSlug = category?.slug;
      
      let url = `${API_BASE}/api/news?page=${page}&limit=${limit}&status=hazir`;
      if (catSlug && catSlug !== "Tümü") url += `&category=${catSlug}`;
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
      
      console.log("[fetchNews] Fetching from:", url);
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit'
      });
      
      if (!res.ok) {
        console.error(`[fetchNews] HTTP Error: ${res.status} ${res.statusText}`);
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log("[fetchNews] API Response:", data);
      
      if (data.success) {
        setNews(data.data);
        setTotalPages(data.totalPages || 1);
      } else {
        console.warn("[fetchNews] API başarısız:", data);
        setNews([]);
      }
    } catch (error) {
      console.error("[fetchNews] Error:", error);
      setNews([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, activeCategory]);

  useEffect(() => {
    fetchNews();
    
    // SSE for real-time updates
    const eventSource = new EventSource(`${API_BASE}/api/news/live`);
    eventSource.onmessage = (event) => {
      try {
        const newItem = JSON.parse(event.data);
        if (newItem.durum === "hazir") {
          setNews((prev) => {
            if (prev.some(n => n.id === newItem.id)) return prev;
            return [newItem, ...prev].slice(0, limit);
          });
        }
      } catch (e) {
        console.error("SSE parse error", e);
      }
    };

    return () => eventSource.close();
  }, [fetchNews]);

  return (
    <main className="min-h-screen bg-[var(--bg-primary)]">
      <Navbar />
      
      <HeroSection />

      {/* Sizin İçin Seçilenler Carousel */}
      {!loading && isPersonalized && news.length > 0 && Object.keys(getInterests()).length >= 3 && (
        <PersonalizedHeroCarousel newsItems={personalizedSort(news, getInterests()).slice(0, 3)} />
      )}

      <div id="news" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Kontroller */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          {/* Kategoriler */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-2 px-2 hide-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                onClick={() => { setActive(cat.name); setPage(1); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  activeCategory === cat.name
                    ? "bg-[var(--accent-primary)] text-[var(--text-inverse)] shadow-lg"
                    : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Arama */}
          <div className="relative min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
            <input 
              type="text"
              placeholder="Gündemi yakala..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] transition-all"
            />
          </div>
        </div>

        {/* Canlı Akış Göstergesi */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
              Gerçek Zamanlı Akış
            </span>
          </div>
          
          {isPersonalized && activeCategory === "Tümü" && Object.keys(getInterests()).length >= 3 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--surface-warm)] border border-[var(--accent-warm)]/20 animate-in fade-in slide-in-from-right-4 duration-500">
              <Target size={14} className="text-[var(--accent-warm)]" />
              <span className="text-[10px] font-bold text-[var(--accent-warm)] uppercase tracking-wider">🎯 Senin İçin Kişiselleştirildi</span>
            </div>
          )}
        </div>

        {/* Dashboard Analytics Row — lazy-mounted via IntersectionObserver */}
        {activeCategory === "Tümü" && !search && (
          <LazySection minHeight="220px" className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <SentimentBiasMap />
            <InterestRadar />
          </LazySection>
        )}

        {/* Ana İçerik */}
        <ErrorBoundary>
            <NewsFeed 
                newsItems={isPersonalized && activeCategory === "Tümü" ? personalizedSort(news, getInterests()) : news} 
                loading={loading} 
            />
        </ErrorBoundary>

        {/* Sayfalama */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-16">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-6 py-2 rounded-xl border border-[var(--border-subtle)] text-sm font-semibold disabled:opacity-30 hover:bg-[var(--bg-secondary)] transition-colors"
            >
              ← Önceki
            </button>
            <span className="text-sm font-bold text-[var(--text-muted)]">
              {page} / {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-6 py-2 rounded-xl border border-[var(--border-subtle)] text-sm font-semibold disabled:opacity-30 hover:bg-[var(--bg-secondary)] transition-colors"
            >
              Sonraki →
            </button>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
