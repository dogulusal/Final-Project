"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { NewsItem } from "@/types/news";
import { Share2 } from "lucide-react";
import ReadingProgressBar from "@/components/ReadingProgressBar";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function HaberDetayPage({ params }: { params: Promise<{ slug: string }> }) {
    const [slug, setSlug] = useState<string>("");
    const [news, setNews] = useState<NewsItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        params.then((p) => setSlug(p.slug));
    }, [params]);

    useEffect(() => {
        if (!slug) return;
        const fetchNews = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/news/${slug}`);
                if (!res.ok) {
                    setNotFound(true);
                    setLoading(false);
                    return;
                }
                const data = await res.json();
                if (data.success && data.data) {
                    setNews(data.data);
                } else {
                    setNotFound(true);
                }
            } catch {
                setNotFound(true);
            } finally {
                setLoading(false);
            }
        };
        fetchNews();
    }, [slug]);

    // Share functionality
    const handleShare = async () => {
        if (!news) return;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: news.baslik,
                    text: news.metaAciklama || news.icerik?.substring(0, 50),
                    url: window.location.href,
                });
            } catch (error) {
                console.log('Share canceled or failed', error);
            }
        } else {
            // Fallback
            navigator.clipboard.writeText(window.location.href);
            alert("Bağlantı panoya kopyalandı!");
        }
    };

    // Loading skeleton
    if (loading) {
        return (
            <main className="min-h-screen">
                <Navbar />
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-pulse">
                    <div className="h-3 w-32 rounded mb-8" style={{ background: "var(--bg-card-hover)" }} />
                    <div className="h-8 w-3/4 rounded mb-4" style={{ background: "var(--bg-card-hover)" }} />
                    <div className="h-4 w-1/2 rounded mb-10" style={{ background: "var(--bg-card-hover)" }} />
                    <div className="space-y-3">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-3 w-full rounded" style={{ background: "var(--bg-card-hover)" }} />
                        ))}
                    </div>
                </div>
            </main>
        );
    }

    // 404
    if (notFound || !news) {
        return (
            <main className="min-h-screen">
                <Navbar />
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
                    <span className="text-5xl block mb-4">🔍</span>
                    <h1 className="text-2xl font-bold mb-2">Haber bulunamadı</h1>
                    <p className="text-sm text-[var(--text-secondary)] mb-6">Bu haber kaldırılmış veya henüz yayınlanmamış olabilir.</p>
                    <Link href="/" className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
                        style={{ background: "var(--gradient-hero)" }}>
                        Ana Sayfaya Dön
                    </Link>
                </div>
                <Footer />
            </main>
        );
    }

    const categoryName = news.kategori?.ad || "Genel";

    return (
        <main className="min-h-screen">
            <ReadingProgressBar />
            <Navbar />
            <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                    {/* Breadcrumb */}
                    <nav className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)] mb-6">
                        <div className="flex items-center gap-2">
                            <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">Ana Sayfa</Link>
                            <span>›</span>
                            <Link href="/kategoriler" className="hover:text-[var(--text-primary)] transition-colors">{categoryName}</Link>
                            <span>›</span>
                            <span className="text-[var(--text-secondary)] truncate max-w-[200px] sm:max-w-sm">{news.baslik}</span>
                        </div>
                        <button 
                            onClick={handleShare}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] transition-colors text-[var(--accent-blue)]"
                        >
                            <Share2 size={14} />
                            <span className="font-medium hidden sm:inline">Paylaş</span>
                        </button>
                    </nav>

                    {/* Header */}
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight mb-4">
                        {news.baslik}
                    </h1>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)] mb-8 pb-6 border-b border-[var(--border-subtle)]">
                        <span>{new Date(news.yayinlanmaTarihi).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        {news.okumaSuresiDakika && news.okumaSuresiDakika > 1 && (
                            <>
                                <span>·</span>
                                <span>{news.okumaSuresiDakika} dk okuma</span>
                            </>
                        )}
                        <span>·</span>
                        <span>{news.goruntulemeSayisi} görüntülenme</span>
                        {news.kaynakUrl && (
                            <>
                                <span>·</span>
                                <a href={news.kaynakUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-blue)] hover:underline">
                                    Kaynak
                                </a>
                            </>
                        )}
                    </div>

                    {/* Content */}
                    {news.icerik ? (
                        <div className="prose prose-sm max-w-none text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap text-[15px]">
                            {news.icerik}
                        </div>
                    ) : news.metaAciklama ? (
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                            {news.metaAciklama}
                        </p>
                    ) : (
                        <p className="text-sm text-[var(--text-muted)] italic">İçerik henüz oluşturulmamış.</p>
                    )}

                    {/* Share Button Bottom */}
                    <div className="flex justify-center mt-12 mb-6">
                        <button 
                            onClick={handleShare}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105"
                            style={{ background: "var(--gradient-hero)" }}
                        >
                            <Share2 size={18} />
                            Haberi Sosyal Medyada Paylaş
                        </button>
                    </div>

                    {/* Back */}
                    <div className="pt-6 border-t border-[var(--border-subtle)] text-center">
                        <Link href="/" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors font-medium">
                            ← Tüm haberlere dön
                        </Link>
                    </div>
                </motion.div>
            </article>
            <Footer />
        </main>
    );
}
