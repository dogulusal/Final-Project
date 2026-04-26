"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { NewsItem } from "@/types/news";
import { getNewsImage } from "@/utils/newsImage";
import { ChevronRight, ChevronLeft, Target, TrendingUp } from "lucide-react";

interface Props {
  newsItems: NewsItem[];
}

const SENTIMENT_CONFIG = {
  pozitif: {
    border: "border-green-500/40",
    glow: "shadow-green-500/20",
    blob1: "bg-green-400",
    blob2: "bg-emerald-300",
    badge: "bg-green-600 text-white",
    cta: "bg-green-600 hover:bg-green-700 text-white",
    label: "Pozitif",
  },
  negatif: {
    border: "border-red-500/40",
    glow: "shadow-red-500/20",
    blob1: "bg-red-400",
    blob2: "bg-orange-300",
    badge: "bg-red-600 text-white",
    cta: "bg-red-600 hover:bg-red-700 text-white",
    label: "Kritik",
  },
  nötr: {
    border: "border-blue-500/30",
    glow: "shadow-blue-500/15",
    blob1: "bg-blue-400",
    blob2: "bg-purple-300",
    badge: "bg-[var(--accent-primary)] text-[var(--text-inverse)] dark:bg-[var(--accent-warm)] dark:text-[var(--bg-primary)]",
    cta: "bg-[var(--accent-primary)] hover:bg-[var(--accent-warm)] dark:bg-[var(--accent-warm)] dark:hover:bg-[var(--accent-primary)] text-[var(--text-inverse)]",
    label: null,
  },
};

export default function PersonalizedHeroCarousel({ newsItems }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const navigate = useCallback((dir: 1 | -1) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev + dir + newsItems.length) % newsItems.length);
    setTimeout(() => setIsAnimating(false), 400);
  }, [isAnimating, newsItems.length]);

  // Auto-scroll
  useEffect(() => {
    if (newsItems.length <= 1) return;
    const interval = setInterval(() => navigate(1), 6000);
    return () => clearInterval(interval);
  }, [newsItems.length, navigate]);

  if (!newsItems || newsItems.length === 0) return null;

  const currentNews = newsItems[currentIndex];
  const sentimentKey = (currentNews.sentiment?.toLowerCase() || "nötr") as keyof typeof SENTIMENT_CONFIG;
  const cfg = SENTIMENT_CONFIG[sentimentKey] ?? SENTIMENT_CONFIG["nötr"];

  return (
    <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 mb-8 group" aria-roledescription="carousel">
      <div className="flex items-center gap-2 mb-4">
        <Target size={20} className="text-[var(--accent-warm)]" />
        <h2 className="headline-md font-bold text-[var(--accent-primary)] dark:text-white">
          Sizin İçin Seçilenler
        </h2>
        <span className="ml-auto text-xs text-[var(--text-muted)] flex items-center gap-1">
          <TrendingUp size={12} /> Kişiselleştirilmiş
        </span>
      </div>

      <div className={`relative h-[240px] md:h-[300px] w-full rounded-2xl overflow-hidden shadow-2xl ${cfg.glow} bg-[var(--bg-secondary)] border-2 ${cfg.border} transition-all duration-500`} aria-live="polite">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src={getNewsImage(currentNews)}
            alt=""
            fill
            className="object-cover transition-opacity duration-700"
            sizes="(max-width: 768px) 100vw, 1280px"
            unoptimized
            priority
          />
        </div>
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-card)] via-[var(--bg-card)]/95 to-[var(--bg-card)]/40 z-[1] transition-colors duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-card)]/80 via-transparent to-transparent z-[1]" />

        {/* Animated blobs — sentiment-aware */}
        <div className={`absolute top-[-50%] right-[-10%] w-[300px] h-[300px] rounded-full opacity-10 blur-3xl z-[2] transition-all duration-700 ${cfg.blob1}`} />
        <div className={`absolute bottom-[-50%] left-[-10%] w-[200px] h-[200px] rounded-full opacity-10 blur-3xl z-[2] transition-all duration-700 ${cfg.blob2}`} />

        {/* Progress bar across top */}
        <div className="absolute top-0 left-0 right-0 h-[3px] z-30 bg-transparent">
          <div
            key={currentIndex}
            className={`h-full ${cfg.blob1} opacity-80`}
            style={{ animation: "carousel-progress 6s linear forwards" }}
          />
        </div>

        {/* Content */}
        <div className="absolute inset-0 z-10 p-6 md:p-8 flex flex-col justify-center max-w-2xl">
          <div
            className={`transition-all duration-400 ${isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}
          >
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className={`px-3 py-1 text-xs font-bold tracking-widest rounded-full uppercase ${cfg.badge}`}>
                {currentNews.kategori?.ad || "Özel"}
              </span>
              {cfg.label && (
                <span className="px-2 py-0.5 text-[10px] font-bold tracking-widest rounded-full border border-current opacity-70" style={{ color: sentimentKey === "pozitif" ? "#16a34a" : "#dc2626" }}>
                  {cfg.label}
                </span>
              )}
            </div>

            <Link href={`/haber/${currentNews.slug}`} className="block group/title">
              <h3 className="headline-lg font-bold mb-3 line-clamp-2 text-[var(--text-primary)] group-hover/title:text-[var(--accent-warm)] transition-colors duration-200 leading-tight">
                {currentNews.baslik}
              </h3>
            </Link>

            {currentNews.metaAciklama && (
              <p className="text-[var(--text-secondary)] text-sm line-clamp-2 leading-relaxed max-w-xl hidden md:block">
                {currentNews.metaAciklama}
              </p>
            )}

            <Link
              href={`/haber/${currentNews.slug}`}
              className={`inline-flex items-center mt-5 text-sm font-bold tracking-wide px-6 py-2.5 rounded-full transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${cfg.cta}`}
            >
              Habere Git <ChevronRight size={16} className="ml-1" />
            </Link>
          </div>
        </div>

        {/* Nav buttons */}
        {newsItems.length > 1 && (
          <>
            <button
              onClick={() => navigate(-1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-[var(--bg-glass)] backdrop-blur-sm border border-[var(--border-subtle)] text-[var(--text-primary)] shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 hover:scale-110 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)]"
              aria-label="Önceki haber"
              type="button"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => navigate(1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-[var(--bg-glass)] backdrop-blur-sm border border-[var(--border-subtle)] text-[var(--text-primary)] shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 hover:scale-110 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)]"
              aria-label="Sonraki haber"
              type="button"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}

        {/* Dot indicators */}
        <div className="absolute bottom-4 right-4 sm:right-6 flex gap-1.5 z-20" role="tablist" aria-label="Carousel slaytları">
          {newsItems.map((_, idx) => (
            <button
              key={idx}
              onClick={() => { if (!isAnimating) { setIsAnimating(true); setCurrentIndex(idx); setTimeout(() => setIsAnimating(false), 400); } }}
              className={`rounded-full transition-all duration-300 ${idx === currentIndex ? "w-5 h-1.5 bg-[var(--accent-warm)]" : "w-1.5 h-1.5 bg-[var(--border-medium)] hover:bg-[var(--text-muted)]"}`}
              aria-label={`Slayt ${idx + 1}`}
              aria-selected={idx === currentIndex}
              role="tab"
              type="button"
            />
          ))}
        </div>
      </div>
    </div>
  );
}


interface Props {
  newsItems: NewsItem[];
}

