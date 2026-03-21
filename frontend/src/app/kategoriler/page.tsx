"use client";

import { motion } from "framer-motion";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import NewsGrid from "@/components/NewsGrid";
import Footer from "@/components/Footer";
import { NewsItem } from "@/types/news";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Kategori {
    id: number;
    ad: string;
    slug: string;
    renkKodu: string;
    ikon: string | null;
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

    useEffect(() => {
        fetchNews();
    }, []);

    const fetchNews = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/news?limit=100`);
            const data = await res.json();
            if (data.success) setNews(data.data);
        } catch {
            // API erişim hatası
        } finally {
            setLoading(false);
        }
    };

    const categories: Kategori[] = [];
    const seenIds = new Set<number>();
    for (const n of news) {
        if (n.kategori && !seenIds.has(n.kategori.id)) {
            seenIds.add(n.kategori.id);
            categories.push(n.kategori);
        }
    }

    const filteredNews = activeCategory
        ? news.filter(n => n.kategori?.ad === activeCategory)
        : news;

    const categoryCount = (catName: string) => news.filter(n => n.kategori?.ad === catName).length;

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
                            onClick={() => setActiveCategory(null)}
                            className={`glass-card p-4 text-left transition-all duration-200 ${!activeCategory ? "ring-2 ring-[var(--accent-blue)]" : ""}`}
                        >
                            <span className="text-xl block mb-1">🔥</span>
                            <span className="text-sm font-bold block">Tümü</span>
                            <span className="text-[10px] text-[var(--text-muted)]">{news.length} haber</span>
                        </button>

                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.ad)}
                                className={`glass-card p-4 text-left transition-all duration-200 ${activeCategory === cat.ad ? "ring-2 ring-[var(--accent-blue)]" : ""}`}
                            >
                                <span className="text-xl block mb-1">{CATEGORY_ICONS[cat.ad] || "📄"}</span>
                                <span className="text-sm font-bold block">{cat.ad}</span>
                                <span className="text-[10px] text-[var(--text-muted)]">{categoryCount(cat.ad)} haber</span>
                            </button>
                        ))}
                    </div>

                    {/* Filtered News */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold">
                            {activeCategory || "Tüm"} Haberleri
                        </h2>
                        <span className="text-xs text-[var(--text-muted)]">{filteredNews.length} sonuç</span>
                    </div>

                    <NewsGrid news={filteredNews} loading={loading} />
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
