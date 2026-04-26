"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import NewsGrid from "@/components/NewsGrid";
import Footer from "@/components/Footer";
import { NewsItem } from "@/types/news";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
const PAGE_SIZE = 9;

interface Kategori {
    id: number;
    ad: string;
    slug: string;
    renkKodu: string;
    ikon: string | null;
}

interface CategoryCount {
    slug: string;
    ad: string;
    count: number;
}

const CATEGORY_ICONS: Record<string, string> = {
    Spor: "⚽", Ekonomi: "💰", Teknoloji: "💻",
    Siyaset: "🏛️", Dünya: "🌍", Sağlık: "🏥", Genel: "📰",
};

function KategorilerContent() {
    const searchParams = useSearchParams();
    const initialCat = searchParams.get("cat") || null;

    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<string | null>(initialCat);
    const [categories, setCategories] = useState<Kategori[]>([]);
    const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filteredTotal, setFilteredTotal] = useState(0);

    const dedupe = (items: NewsItem[]) => {
        const seen = new Set<string>();
        return items.filter((n) => {
            const key = (n.slug || "").toLowerCase().trim() || `${(n.baslik || "").toLowerCase().trim()}::${(n.kaynakUrl || "").toLowerCase().trim()}`;
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    // Fetch categories + counts on mount
    useEffect(() => {
        (async () => {
            try {
                const catRes = await fetch(`${API_BASE}/api/news/categories`);
                const catData = await catRes.json();
                if (catData.success && Array.isArray(catData.data)) {
                    setCategories(catData.data);
                    
                    // Fetch count for each category + total
                    const countPromises = catData.data.map(async (cat: Kategori) => {
                        const r = await fetch(`${API_BASE}/api/news?limit=1&status=hazir&category=${cat.slug}`);
                        const d = await r.json();
                        return { slug: cat.slug, ad: cat.ad, count: d.total || 0 };
                    });
                    const totalRes = await fetch(`${API_BASE}/api/news?limit=1&status=hazir`);
                    const totalData = await totalRes.json();
                    setTotalCount(totalData.total || 0);

                    const counts = await Promise.all(countPromises);
                    const countMap: Record<string, number> = {};
                    counts.forEach((c: CategoryCount) => { countMap[c.ad] = c.count; });
                    setCategoryCounts(countMap);
                }
            } catch {
                // silent
            }
        })();
    }, []);

    // Fetch news for current page + category
    const fetchNews = useCallback(async () => {
        setLoading(true);
        try {
            let url = `${API_BASE}/api/news?page=${page}&limit=${PAGE_SIZE}&status=hazir`;
            if (activeCategory) {
                const cat = categories.find(c => c.ad === activeCategory);
                if (cat) url += `&category=${cat.slug}`;
            }
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setNews(dedupe(data.data));
                setTotalPages(data.totalPages || 1);
                setFilteredTotal(data.total || 0);
            }
        } catch {
            setNews([]);
        } finally {
            setLoading(false);
        }
    }, [page, activeCategory, categories]);

    useEffect(() => {
        if (categories.length > 0 || activeCategory === null) {
            fetchNews();
        }
    }, [fetchNews, categories]);

    const handleCategoryChange = (catName: string | null) => {
        setActiveCategory(catName);
        setPage(1);
    };

    return (
        <main className="min-h-screen">
            <Navbar />
            <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                    <nav className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-6">
                        <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">Ana Sayfa</Link>
                        <span>›</span>
                        <span className="text-[var(--text-secondary)]">Kategoriler</span>
                    </nav>

                    <h1 className="text-3xl font-extrabold tracking-tight mb-2">
                        <span className="gradient-text">Kategoriler</span>
                    </h1>
                    <p className="text-sm text-[var(--text-secondary)] mb-8">
                        İlgi alanına göre haberleri filtrele.
                    </p>

                    {/* Category Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mb-10">
                        <button
                            onClick={() => handleCategoryChange(null)}
                            className={`glass-card p-4 text-left transition-all duration-200 ${!activeCategory ? "ring-2 ring-[var(--accent-blue)]" : ""}`}
                        >
                            <span className="text-xl block mb-1">🔥</span>
                            <span className="text-sm font-bold block">Tümü</span>
                            <span className="text-[10px] text-[var(--text-muted)]">{totalCount} haber</span>
                        </button>

                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => handleCategoryChange(cat.ad)}
                                className={`glass-card p-4 text-left transition-all duration-200 ${activeCategory === cat.ad ? "ring-2 ring-[var(--accent-blue)]" : ""}`}
                            >
                                <span className="text-xl block mb-1">{CATEGORY_ICONS[cat.ad] || "📄"}</span>
                                <span className="text-sm font-bold block">{cat.ad}</span>
                                <span className="text-[10px] text-[var(--text-muted)]">{categoryCounts[cat.ad] ?? "—"} haber</span>
                            </button>
                        ))}
                    </div>

                    {/* Filtered News */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold">
                            {activeCategory || "Tüm"} Haberleri
                        </h2>
                        <span className="text-xs text-[var(--text-muted)]">{filteredTotal} sonuç</span>
                    </div>

                    <NewsGrid news={news} loading={loading} />

                    {/* Pagination */}
                    {!loading && totalPages > 1 && (
                        <div className="flex items-center justify-center gap-3 mt-10">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                                className="px-5 py-2 rounded-xl border border-[var(--border-subtle)] text-sm font-semibold disabled:opacity-30 hover:bg-[var(--bg-secondary)] transition-colors"
                            >
                                ← Önceki
                            </button>
                            <span className="text-sm font-bold text-[var(--text-muted)]">
                                {page} / {totalPages}
                            </span>
                            <button
                                disabled={page === totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="px-5 py-2 rounded-xl border border-[var(--border-subtle)] text-sm font-semibold disabled:opacity-30 hover:bg-[var(--bg-secondary)] transition-colors"
                            >
                                Sonraki →
                            </button>
                        </div>
                    )}
                </motion.div>
            </section>
            <Footer />
        </main>
    );
}

export default function KategorilerPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen">
                <Navbar />
                <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-[var(--text-muted)]">
                    Yükleniyor...
                </div>
            </main>
        }>
            <KategorilerContent />
        </Suspense>
    );
}
