"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import NewsGrid from "@/components/NewsGrid";
import Footer from "@/components/Footer";
import type { NewsItem } from "@/app/page";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Kategori {
    id: number;
    ad: string;
    slug: string;
    renkKodu: string;
    ikon: string | null;
}

const BADGE_MAP: Record<string, string> = {
    Spor: "badge-spor", Ekonomi: "badge-ekonomi", Teknoloji: "badge-teknoloji",
    Siyaset: "badge-siyaset", Dünya: "badge-dunya", Sağlık: "badge-saglik", Genel: "badge-genel",
};

export default function KategorilerPage() {
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

    // Kategorileri haberlerden çıkar
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
            <section className="max-w-[1500px] w-full mx-auto px-6 lg:px-12 py-16">
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    {/* Header */}
                    <nav className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-8">
                        <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">Ana Sayfa</Link>
                        <span>›</span>
                        <span className="text-[var(--text-secondary)]">Kategoriler</span>
                    </nav>

                    <h1 className="text-4xl font-extrabold tracking-tight mb-4">
                        <span className="gradient-text">Kategoriler</span>
                    </h1>
                    <p className="text-lg text-[var(--text-secondary)] mb-12 max-w-xl">
                        İlgi alanına göre haberleri filtrele.
                    </p>

                    {/* Category Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
                        <button
                            onClick={() => setActiveCategory(null)}
                            className={`glass-card p-5 text-left transition-all duration-300 ${!activeCategory ? "ring-2 ring-[var(--accent-blue)]" : ""}`}
                        >
                            <span className="text-2xl block mb-2">🔥</span>
                            <span className="text-base font-bold block">Tümü</span>
                            <span className="text-xs text-[var(--text-muted)]">{news.length} haber</span>
                        </button>

                        {categories.map(cat => {
                            const badge = BADGE_MAP[cat.ad] || "badge-genel";
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.ad)}
                                    className={`glass-card p-5 text-left transition-all duration-300 ${activeCategory === cat.ad ? "ring-2 ring-[var(--accent-blue)]" : ""}`}
                                >
                                    <span className="text-2xl block mb-2">{cat.ikon || "📄"}</span>
                                    <span className="text-base font-bold block">{cat.ad}</span>
                                    <span className={`${badge} text-[10px] font-bold px-2 py-0.5 rounded-full mt-2 inline-block`}>
                                        {categoryCount(cat.ad)} haber
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Filtered News */}
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold">
                            {activeCategory ? activeCategory : "Tüm"} Haberleri
                        </h2>
                        <span className="text-sm text-[var(--text-muted)]">{filteredNews.length} sonuç</span>
                    </div>

                    <NewsGrid news={filteredNews} loading={loading} />
                </motion.div>
            </section>
            <Footer />
        </main>
    );
}
