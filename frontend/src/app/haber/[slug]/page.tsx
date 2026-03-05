"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { NewsItem } from "@/app/page";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function HaberDetay() {
    const params = useParams();
    const slug = params.slug as string;

    const [news, setNews] = useState<NewsItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!slug) return;
        fetchNews();
    }, [slug]);

    const fetchNews = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/news/${slug}`);
            const data = await res.json();
            if (data.success) {
                setNews(data.data);
            } else {
                setError(true);
            }
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <main className="min-h-screen">
                <Navbar />
                <div className="max-w-[900px] mx-auto px-6 lg:px-12 py-20">
                    <div className="animate-pulse space-y-6">
                        <div className="h-8 w-32 rounded-full" style={{ background: "var(--bg-card-hover)" }} />
                        <div className="h-12 w-full rounded-xl" style={{ background: "var(--bg-card-hover)" }} />
                        <div className="h-12 w-3/4 rounded-xl" style={{ background: "var(--bg-card-hover)" }} />
                        <div className="h-4 w-48 rounded" style={{ background: "var(--bg-card-hover)" }} />
                        <div className="h-px w-full" style={{ background: "var(--border-subtle)" }} />
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-4 w-full rounded" style={{ background: "var(--bg-card-hover)" }} />
                        ))}
                    </div>
                </div>
            </main>
        );
    }

    if (error || !news) {
        return (
            <main className="min-h-screen">
                <Navbar />
                <div className="max-w-[900px] mx-auto px-6 lg:px-12 py-20 text-center">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <span className="text-6xl block mb-6">📭</span>
                        <h1 className="text-3xl font-bold mb-4">Haber Bulunamadı</h1>
                        <p className="text-[var(--text-secondary)] mb-8">
                            Aradığınız haber silinmiş veya taşınmış olabilir.
                        </p>
                        <Link href="/" className="px-8 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-300 hover:scale-105"
                            style={{ background: "var(--gradient-hero)" }}>
                            Ana Sayfaya Dön
                        </Link>
                    </motion.div>
                </div>
                <Footer />
            </main>
        );
    }

    const categorySlug = news.kategori?.slug || "genel";
    const BADGE_MAP: Record<string, string> = {
        spor: "badge-spor", ekonomi: "badge-ekonomi", teknoloji: "badge-teknoloji",
        siyaset: "badge-siyaset", dunya: "badge-dunya", saglik: "badge-saglik", genel: "badge-genel",
    };
    const badgeClass = BADGE_MAP[categorySlug] || "badge-genel";

    const formattedDate = new Date(news.yayinlanmaTarihi).toLocaleDateString("tr-TR", {
        year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

    return (
        <main className="min-h-screen">
            <Navbar />
            <article className="max-w-[900px] mx-auto px-6 lg:px-12 py-16">
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-8">
                        <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">Ana Sayfa</Link>
                        <span>›</span>
                        <Link href={`/kategoriler?cat=${news.kategori?.ad}`} className="hover:text-[var(--text-primary)] transition-colors">
                            {news.kategori?.ad}
                        </Link>
                        <span>›</span>
                        <span className="text-[var(--text-secondary)] truncate max-w-[200px]">{news.baslik}</span>
                    </nav>

                    {/* Category Badge */}
                    <span className={`${badgeClass} px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase inline-block mb-6`}>
                        {news.kategori?.ad}
                    </span>

                    {/* Title */}
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-6 tracking-tight">
                        {news.baslik}
                    </h1>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-muted)] mb-10">
                        <span>📅 {formattedDate}</span>
                        {news.okumaSuresiDakika && <span>⏱ {Math.ceil(news.okumaSuresiDakika)} dk okuma</span>}
                        <span>👁 {news.goruntulemeSayisi.toLocaleString("tr-TR")} görüntülenme</span>
                        {news.sentiment && <span>{news.sentiment === "Pozitif" ? "🟢" : news.sentiment === "Negatif" ? "🔴" : "🟡"} {news.sentiment}</span>}
                    </div>

                    {/* Divider */}
                    <div className="h-px w-full mb-10" style={{ background: "var(--border-subtle)" }} />

                    {/* Content */}
                    {news.icerik ? (
                        <div className="prose prose-invert max-w-none text-lg leading-relaxed text-[var(--text-secondary)]"
                            style={{ lineHeight: "1.9" }}>
                            {news.icerik.split("\n").map((paragraph, i) => (
                                <p key={i} className="mb-6">{paragraph}</p>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[var(--text-muted)] italic">Bu haberin içeriği henüz yüklenmedi.</p>
                    )}

                    {/* Source Link */}
                    {news.kaynakUrl && (
                        <div className="mt-12 p-6 glass-card">
                            <span className="text-sm text-[var(--text-muted)] block mb-2">Kaynak</span>
                            <a href={news.kaynakUrl} target="_blank" rel="noopener noreferrer"
                                className="text-[var(--accent-blue)] hover:underline text-sm break-all">
                                {news.kaynakUrl}
                            </a>
                        </div>
                    )}

                    {/* Back Button */}
                    <div className="mt-16">
                        <Link href="/" className="px-8 py-3 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-105 inline-block"
                            style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                            ← Tüm Haberlere Dön
                        </Link>
                    </div>
                </motion.div>
            </article>
            <Footer />
        </main>
    );
}
