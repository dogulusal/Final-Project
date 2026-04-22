"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NewsItem } from "@/types/news";
import Link from "next/link";
import Image from "next/image";
import { getNewsImage } from "@/utils/newsImage";

interface HeroCarouselProps {
  news: NewsItem[];
  autoPlayInterval?: number;
}

export default function HeroCarousel({ news, autoPlayInterval = 5000 }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const displayNews = news.slice(0, 5); // Top 5 haberler
  if (displayNews.length === 0) return null;

  const current = displayNews[currentIndex];

  // Auto-play
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayNews.length);
    }, autoPlayInterval);
    return () => clearInterval(timer);
  }, [isPaused, displayNews.length, autoPlayInterval]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + displayNews.length) % displayNews.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % displayNews.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  // Kategoriye göre gradient
  const getCategoryGradient = (categoryName?: string) => {
    const gradients: Record<string, string> = {
      "Spor": "from-blue-600/90 to-blue-900/90",
      "Ekonomi": "from-emerald-600/90 to-emerald-900/90",
      "Teknoloji": "from-purple-600/90 to-purple-900/90",
      "Siyaset": "from-red-600/90 to-red-900/90",
      "Dünya": "from-orange-600/90 to-orange-900/90",
      "Sağlık": "from-pink-600/90 to-pink-900/90",
      "Genel": "from-gray-600/90 to-gray-900/90"
    };
    return gradients[categoryName || "Genel"] || "from-gray-600/90 to-gray-900/90";
  };

  return (
    <div className="relative w-full h-[85vh] md:h-screen rounded-2xl overflow-hidden group">
      {/* Mesh gradient blobs */}
      <div className="absolute top-8 right-12 w-32 h-32 rounded-full opacity-20 blur-3xl pointer-events-none z-10"
           style={{ background: 'radial-gradient(circle, var(--neon-purple), transparent)' }} />
      <div className="absolute bottom-16 left-8 w-24 h-24 rounded-full opacity-15 blur-2xl pointer-events-none z-10"
           style={{ background: 'radial-gradient(circle, var(--neon-cyan), transparent)' }} />

      {/* Animated gradient orb */}
      <div className="absolute right-[-5%] top-[10%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] pointer-events-none z-10">
        <div className="w-full h-full rounded-full animate-orb-float"
          style={{
            background: `
              radial-gradient(circle at 30% 30%, var(--neon-purple), transparent 60%),
              radial-gradient(circle at 70% 70%, var(--neon-cyan), transparent 60%),
              radial-gradient(circle at 50% 50%, rgba(124,58,237,0.3), transparent 70%)
            `,
            filter: 'blur(40px)',
          }} />
      </div>
      {/* Slides */}
      {displayNews.map((item, idx) => (
        <div
          key={idx}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            idx === currentIndex ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Optimized Next.js Image */}
          <Image
            src={getNewsImage(item)}
            unoptimized
            alt={item.baslik}
            fill
            priority={idx === currentIndex}
            className="object-cover"
            sizes="(max-width: 768px) 500px, 600px"
          />

          {/* Gradient Overlay */}
          <div className={`absolute inset-0 bg-gradient-to-t ${getCategoryGradient(item.kategori?.ad)}`} />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12 text-white">
            <Link href={`/haber/${item.slug}`} className="group/card">
              {/* Kategori Badge */}
              <div className="flex items-center gap-3 mb-4">
                <span className="neon-badge animate-pulse">
                  {item.kategori?.ad || "Genel"}
                </span>
                {item.mlConfidence !== null && (
                  <span className="mono text-sm px-3 py-1 glass-card">
                    %{Math.round((item.mlConfidence || 0) * 100)}
                  </span>
                )}
              </div>

              {/* Başlık */}
              <h2 className="font-serif text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold leading-tight tracking-tight line-clamp-3 md:line-clamp-2 group-hover/card:text-yellow-300 transition-colors">
                {item.baslik}
              </h2>

              {/* Meta Açıklama */}
              {item.metaAciklama && (
                <p className="text-base md:text-lg text-white/60 mt-4 max-w-2xl line-clamp-2">
                  {item.metaAciklama}
                </p>
              )}

              {/* CTA */}
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-yellow-300 transition-all transform group-hover/card:scale-105">
                Haberi Oku
                <ChevronRight size={20} />
              </div>
            </Link>
          </div>
        </div>
      ))}

      {/* Navigation Controls */}
      {displayNews.length > 1 && (
        <>
          {/* Previous Button */}
          <button
            onClick={goToPrevious}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 glass-card p-2 rounded-full border border-[var(--neon-purple)] hover:bg-[var(--neon-glow-purple)] transition-colors"
            aria-label="Önceki haber"
          >
            <ChevronLeft size={28} className="text-white" />
          </button>

          {/* Next Button */}
          <button
            onClick={goToNext}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 glass-card p-2 rounded-full border border-[var(--neon-purple)] hover:bg-[var(--neon-glow-purple)] transition-colors"
            aria-label="Sonraki haber"
          >
            <ChevronRight size={28} className="text-white" />
          </button>

          {/* Dot Indicators */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {displayNews.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goToSlide(idx)}
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                className={`transition-all ${
                  idx === currentIndex
                    ? "w-8 h-2.5 bg-[var(--neon-purple)] scale-125"
                    : "w-2.5 h-2.5 bg-white/30 hover:bg-white/50"
                } rounded-full`}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}

      {/* Play/Pause Indicator */}
      <div className="absolute top-4 right-4 z-20">
        <span className="glass-card px-3 py-1 text-xs flex items-center gap-1.5 text-white/70">
          {isPaused ? "⏸ Durduruldu" : (<><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Otomatik</>)}
        </span>
      </div>
    </div>
  );
}
