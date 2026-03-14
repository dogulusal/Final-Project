"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
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

/* ─── helpers ───────────────────────────────────────────── */
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Az önce";
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

function categoryClass(cat: string) {
  const map: Record<string, string> = {
    Spor: "badge-spor",
    Ekonomi: "badge-ekonomi",
    Teknoloji: "badge-teknoloji",
    Siyaset: "badge-siyaset",
    Dünya: "badge-dunya",
    Sağlık: "badge-saglik",
    Genel: "badge-genel",
  };
  return map[cat] ?? "badge-genel";
}

/* ─── sub-components ─────────────────────────────────────── */

/** Large featured card with full image */
function FeaturedCard({ item }: { item: NewsItem }) {
  return (
    <Link href={`/haber/${item.slug}`} className="block h-full">
      <article className="news-card-featured group h-full flex flex-col cursor-pointer">
        {/* Image */}
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9" }}>
          {item.gorselUrl ? (
            <img
              src={item.gorselUrl}
              alt={item.baslik}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103"
              style={{ transform: "scale(1)" }}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.03)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
            />
          ) : (
            <div className="img-placeholder w-full h-full" style={{ minHeight: 240 }}>
              <span style={{ fontSize: "2.5rem" }}>{item.kategori.ikon ?? "📰"}</span>
            </div>
          )}
          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)" }}
          />
          {/* Category badge on image */}
          <div className="absolute top-3 left-3">
            <span className={`category-badge ${categoryClass(item.kategori.ad)}`}>
              {item.kategori.ikon} {item.kategori.ad}
            </span>
          </div>
          {/* Sentiment */}
          {item.sentiment && (
            <div className="absolute top-3 right-3">
              <span
                className={`label-xs ${
                  item.sentiment === "Pozitif"
                    ? "sentiment-pozitif"
                    : item.sentiment === "Negatif"
                    ? "sentiment-negatif"
                    : "sentiment-notr"
                }`}
                style={{
                  background: "rgba(0,0,0,0.45)",
                  borderRadius: 4,
                  padding: "2px 7px",
                }}
              >
                {item.sentiment === "Pozitif" ? "↑" : item.sentiment === "Negatif" ? "↓" : "—"}{" "}
                {item.sentiment}
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1 p-5 gap-2">
          <h2 className="headline-md" style={{ color: "var(--text-primary)" }}>
            {item.baslik}
          </h2>
          {item.metaAciklama && (
            <p
              className="text-sm line-clamp-2"
              style={{ color: "var(--text-secondary)", lineHeight: 1.55 }}
            >
              {item.metaAciklama}
            </p>
          )}
          <div className="flex items-center gap-4 mt-auto pt-3" style={{ borderTop: "1px solid var(--divider)" }}>
            <div className="flex items-center gap-1.5 label-xs" style={{ color: "var(--text-muted)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v10l4 2"/></svg>
              {timeAgo(item.yayinlanmaTarihi)}
            </div>
            {item.okumaSuresiDakika && item.okumaSuresiDakika > 1 && (
              <div className="flex items-center gap-1.5 label-xs" style={{ color: "var(--text-muted)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                {item.okumaSuresiDakika} dk okuma
              </div>
            )}
            {item.kaynakUrl && (
              <span
                className="label-xs ml-auto"
                style={{ color: "var(--accent-warm)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {item.kaynakUrl}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

/** Compact horizontal card for secondary stories */
function CompactCard({ item }: { item: NewsItem }) {
  return (
    <Link href={`/haber/${item.slug}`} className="block">
      <article
        className="group flex gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200"
        style={{ background: "transparent" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-secondary)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        {/* Thumbnail */}
        <div
          className="flex-shrink-0 rounded-lg overflow-hidden img-placeholder"
          style={{ width: 72, height: 72 }}
        >
          {item.gorselUrl ? (
            <img src={item.gorselUrl} alt={item.baslik} className="w-full h-full object-cover" />
          ) : (
            <span style={{ fontSize: "1.4rem" }}>{item.kategori.ikon ?? "📰"}</span>
          )}
        </div>
        {/* Text */}
        <div className="flex flex-col justify-between min-w-0 flex-1">
          <div>
            <span className={`category-badge ${categoryClass(item.kategori.ad)} mb-1`}>
              {item.kategori.ad}
            </span>
            <h3
              className="headline-sm line-clamp-2 mt-0.5"
              style={{ color: "var(--text-primary)", fontSize: "0.88rem", lineHeight: 1.4 }}
            >
              {item.baslik}
            </h3>
          </div>
          <div className="flex items-center gap-2 mt-1">
             <span className="label-xs" style={{ color: "var(--text-muted)" }}>
               {timeAgo(item.yayinlanmaTarihi)}
             </span>
             {item.okumaSuresiDakika && item.okumaSuresiDakika > 1 && (
               <span className="label-xs" style={{ color: "var(--text-muted)" }}>
                 · {item.okumaSuresiDakika} dk
               </span>
             )}
          </div>
        </div>
      </article>
    </Link>
  );
}

/** Standard grid card */
function GridCard({ item }: { item: NewsItem }) {
  return (
    <Link href={`/haber/${item.slug}`} className="block h-full">
      <article className="news-card group h-full flex flex-col cursor-pointer">
        {/* Thumbnail */}
        <div className="relative overflow-hidden" style={{ aspectRatio: "3/2" }}>
          {item.gorselUrl ? (
            <img
              src={item.gorselUrl}
              alt={item.baslik}
              className="w-full h-full object-cover transition-transform duration-400"
              style={{ transform: "scale(1)" }}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
            />
          ) : (
            <div className="img-placeholder w-full h-full" style={{ minHeight: 140 }}>
              <span style={{ fontSize: "2rem" }}>{item.kategori.ikon ?? "📰"}</span>
            </div>
          )}
          <div className="absolute top-2 left-2">
            <span className={`category-badge ${categoryClass(item.kategori.ad)}`}>
              {item.kategori.ad}
            </span>
          </div>
        </div>
        {/* Body */}
        <div className="p-4 flex flex-col flex-1 gap-1.5">
          <h3 className="headline-sm line-clamp-3" style={{ color: "var(--text-primary)", lineHeight: 1.45 }}>
            {item.baslik}
          </h3>
          {item.metaAciklama && (
            <p className="text-xs line-clamp-2" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {item.metaAciklama}
            </p>
          )}
          <div className="flex items-center gap-3 mt-auto pt-2" style={{ borderTop: "1px solid var(--divider)" }}>
            <span className="label-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              {timeAgo(item.yayinlanmaTarihi)}
            </span>
            {item.sentiment && (
              <span
                className={`label-xs ml-auto ${
                  item.sentiment === "Pozitif"
                    ? "sentiment-pozitif"
                    : item.sentiment === "Negatif"
                    ? "sentiment-negatif"
                    : "sentiment-notr"
                }`}
              >
                {item.sentiment === "Pozitif" ? "↑" : item.sentiment === "Negatif" ? "↓" : "·"}{" "}
                {item.sentiment}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

/* ─── Loading skeleton ───────────────────────────────────── */
function SkeletonCard({ featured = false }: { featured?: boolean }) {
  return (
    <div
      className="rounded-xl overflow-hidden animate-pulse"
      style={{ background: "var(--bg-secondary)", height: featured ? 380 : 260 }}
    />
  );
}

/* ─── Main Page ──────────────────────────────────────────── */
const CATEGORIES = ["Tümü", "Spor", "Ekonomi", "Teknoloji", "Siyaset", "Dünya", "Sağlık", "Genel"];
const CATEGORY_MAP: Record<string, string> = {
  "Tümü": "Tümü",
  "Spor": "spor",
  "Ekonomi": "ekonomi",
  "Teknoloji": "teknoloji",
  "Siyaset": "siyaset",
  "Dünya": "dunya",
  "Sağlık": "saglik",
  "Genel": "genel",
};

export default function Home() {
  const [news, setNews]               = useState<NewsItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeCategory, setActive]   = useState("Tümü");
  const [search, setSearch]           = useState("");
  const [debouncedSearch, setDebounced] = useState("");
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const limit = 20;

  /* debounce */
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 500);
    return () => clearTimeout(t);
  }, [search]);

  /* fetch */
  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      const catSlug = CATEGORY_MAP[activeCategory];
      let url = `${API_BASE}/api/news?page=${page}&limit=${limit}&status=hazir`;
      
      if (catSlug && catSlug !== "Tümü") url += `&category=${catSlug}`;
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
      
      const res  = await fetch(url);
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        setNews(data.data);
        setTotalPages(data.totalPages || 1);
      } else {
        setNews([]);
        setTotalPages(1);
      }
    } catch {
      /* mock fallback ignored or kept minimal */
    } finally { setLoading(false); }
  }, [page, debouncedSearch, activeCategory]);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 300000); // 5dk fallback polling
    
    // SSE for realtime updates
    const eventSource = new EventSource(`${API_BASE}/api/news/live`);
    eventSource.onmessage = (event) => {
      try {
        const newItem: NewsItem = JSON.parse(event.data);
        if (newItem.durum === "hazir") {
           setNews((prev) => {
             // Avoid duplicates
             if (prev.some(n => n.id === newItem.id)) return prev;
             return [newItem, ...prev].slice(0, limit);
           });
        }
      } catch (e) {
        console.error("SSE parse error", e);
      }
    };

    return () => {
      clearInterval(interval);
      eventSource.close();
    };
  }, [fetchNews]);

  const featured   = news[0];
  const secondary  = news.slice(1, 4);
  const gridItems  = news.slice(4);


  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.07 } },
  };
  const itemVariants = {
    hidden:  { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <main className="min-h-screen">
      <Navbar />

      {/* ── Page Header ──────────────────────────────────── */}
      <section className="pt-8 pb-5" style={{ borderBottom: "1px solid var(--divider)" }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">

          {/* Title */}
          <div>
            <p className="label-xs mb-1" style={{ color: "var(--accent-warm)" }}>
              Gündem
            </p>
            <h1 className="headline-xl" style={{ color: "var(--text-primary)" }}>
              Güney <span className="gradient-text">Gündemi</span>
            </h1>
          </div>

          {/* Search + Live */}
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: "var(--text-muted)" }}
              >
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                className="search-input"
                placeholder="Haber ara..."
                value={search}
                onChange={e => { setSearch(e.target.value); }}
              />
            </div>
            {/* Live indicator */}
            <div className="flex items-center gap-2">
              <span className="pulse-dot" />
              <span className="label-xs" style={{ color: "var(--text-muted)" }}>
                Canlı
              </span>
            </div>
          </div>
        </div>

        {/* ── Category Filter ─────────────────────────── */}
        <div className="flex items-center gap-1.5 mt-5 overflow-x-auto pb-1 -mx-1 px-1"
          style={{ scrollbarWidth: "none" }}>
          {CATEGORIES.map((cat: string) => (
            <button
              key={cat}
              className={`cat-tab ${activeCategory === cat ? "active" : ""}`}
              onClick={() => { setActive(cat); setSearch(""); setPage(1); }}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* ── Content ──────────────────────────────────────── */}
      <motion.div
        className="py-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {loading && news.length === 0 ? (
          /* Skeleton */
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-7"><SkeletonCard featured /></div>
              <div className="lg:col-span-5 flex flex-col gap-3">
                {[1,2,3].map(i => <SkeletonCard key={i} />)}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1,2,3].map(i => <SkeletonCard key={i} />)}
            </div>
          </div>
        ) : news.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <span style={{ fontSize: "2.5rem" }}>🔍</span>
            <p className="headline-sm" style={{ color: "var(--text-secondary)" }}>
              Sonuç bulunamadı
            </p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Farklı bir arama deneyin veya kategori değiştirin.
            </p>
          </div>
        ) : (
          <>
            {/* ── Featured section ──────────────────── */}
            {featured && (
              <motion.div variants={itemVariants}>
                <div className="section-rule mb-5">
                  <span className="section-rule-title">Öne Çıkanlar</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-10">
                  {/* Big featured card */}
                  <div className="lg:col-span-7">
                    <FeaturedCard item={featured} />
                  </div>
                  {/* Secondary stack */}
                  <div className="lg:col-span-5 flex flex-col gap-2 justify-between">
                    {secondary.map(item => (
                      <CompactCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Grid section ──────────────────────── */}
            {gridItems.length > 0 && (
              <motion.div variants={itemVariants}>
                <div className="section-rule mb-5">
                  <span className="section-rule-title">Son Haberler</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {gridItems.map(item => (
                    <motion.div key={item.id} variants={itemVariants}>
                      <GridCard item={item} />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Pagination ────────────────────────── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center mt-14 gap-3">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="pagination-btn"
                >
                  ← Önceki
                </button>
                <span
                  className="label-sm px-4 py-2 rounded-lg"
                  style={{ background: "var(--surface-warm)", color: "var(--text-secondary)" }}
                >
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="pagination-btn"
                >
                  Sonraki →
                </button>
              </div>
            )}
          </>
        )}
      </motion.div>

      <Footer />
    </main>
  );
}
