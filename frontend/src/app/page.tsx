"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import NewsFeed from "@/features/news/ui/NewsFeed";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Search } from "lucide-react";
import { NewsItem } from "@/types/news";
import { useReadingHistory } from "@/hooks/useReadingHistory";
import { personalizedSort } from "@/utils/personalizedSort";

const PersonalizedHeroCarousel = dynamic(() => import("@/components/PersonalizedHeroCarousel"), { loading: () => null });

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

const makeNewsIdentity = (item: NewsItem) => {
  const slugKey = (item.slug || "").trim().toLowerCase();
  const titleKey = (item.baslik || "").trim().toLowerCase();
  const sourceKey = (item.kaynakUrl || "").trim().toLowerCase();
  return slugKey || `${titleKey}::${sourceKey}`;
};

const dedupeNewsItems = (items: NewsItem[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = makeNewsIdentity(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};


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
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeCategory, setActive] = useState("Tümü");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const limit = 9;
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { getInterests, isPersonalized } = useReadingHistory();
  const interests = useMemo(() => getInterests(), [getInterests]);
  const canShowPersonalized = isPersonalized && Object.keys(interests).length >= 3;
  const personalizedNews = useMemo(
    () => (isPersonalized && activeCategory === "Tümü" ? personalizedSort(news, interests) : news),
    [isPersonalized, activeCategory, news, interests]
  );
  const personalizedCarouselItems = useMemo(
    () => (canShowPersonalized ? personalizedSort(news, interests).slice(0, 3) : []),
    [canShowPersonalized, news, interests]
  );

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
      setNews([]);
      setHasMore(true);
    }, 500);
    return () => clearTimeout(t);
  }, [search]);

  // Reset on category change
  const handleCategoryChange = useCallback((catName: string) => {
    setActive(catName);
    setPage(1);
    setNews([]);
    setHasMore(true);
  }, []);

  // Fetch news — appends when page > 1
  const fetchNews = useCallback(async (pageNum: number, append: boolean) => {
    try {
      if (append) setLoadingMore(true); else setLoading(true);
      const category = CATEGORIES.find(c => c.name === activeCategory);
      const catSlug = category?.slug;
      
      let url = `${API_BASE}/api/news?page=${pageNum}&limit=${limit}&status=hazir`;
      if (catSlug && catSlug !== "Tümü") url += `&category=${catSlug}`;
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
      
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit'
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      if (data.success) {
        const newItems = dedupeNewsItems(data.data);
        if (append) {
          setNews(prev => dedupeNewsItems([...prev, ...newItems]));
        } else {
          setNews(newItems);
        }
        const totalPages = data.totalPages || 1;
        setHasMore(pageNum < totalPages);
      } else {
        if (!append) setNews([]);
        setHasMore(false);
      }
    } catch {
      if (!append) setNews([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [debouncedSearch, activeCategory]);

  // Initial fetch + fetch on filter change
  useEffect(() => {
    fetchNews(page, page > 1);
  }, [page, fetchNews]);

  // SSE — stable connection, independent of pagination
  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/api/news/live`);
    eventSource.onmessage = (event) => {
      try {
        const newItem = JSON.parse(event.data);
        if (newItem.durum === "hazir") {
          setNews((prev) => {
            if (prev.some(n => n.id === newItem.id || makeNewsIdentity(n) === makeNewsIdentity(newItem))) {
              return prev;
            }
            return dedupeNewsItems([newItem, ...prev]);
          });
        }
      } catch {
        // silent
      }
    };
    return () => eventSource.close();
  }, []);

  // Infinite scroll — IntersectionObserver on sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          setPage(p => p + 1);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore]);

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] relative">
      <div className="dot-pattern" aria-hidden="true" />
      <Navbar />
      
      {/* Haberleri Keşfet */}
      <HeroSection />

      {/* Sizin İçin Seçilenler Carousel */}
      {!loading && canShowPersonalized && news.length > 0 && (
        <PersonalizedHeroCarousel newsItems={personalizedCarouselItems} />
      )}

      <div id="news" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Kontroller */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          {/* Kategoriler */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-2 px-2 hide-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                onClick={() => handleCategoryChange(cat.name)}
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

        {/* Ana İçerik */}
        <ErrorBoundary>
            <NewsFeed 
            newsItems={personalizedNews}
                loading={loading} 
            />
        </ErrorBoundary>

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-px" />
        {loadingMore && (
          <div className="flex justify-center py-8">
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-24 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                <div className="h-full w-1/2 bg-[var(--neon-purple)]/30 animate-pulse rounded-full" />
              </div>
              <span className="text-xs text-[var(--text-muted)] mono">Yükleniyor...</span>
            </div>
          </div>
        )}
        {!hasMore && news.length > 0 && (
          <p className="text-center text-xs text-[var(--text-muted)] py-8 mono">
            Tüm haberler yüklendi
          </p>
        )}
      </div>

      <Footer />
    </main>
  );
}
