"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NewsItem } from "@/types/news";
import Link from "next/link";
import Image from "next/image";

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
    <div className="relative w-full h-[500px] md:h-[600px] rounded-2xl overflow-hidden group">
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
            src="https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=1200&h=600&fit=crop"
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
                <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-bold uppercase tracking-wider">
                  {item.kategori?.ad || "Genel"}
                </span>
                {item.mlConfidence !== null && (
                  <span className="px-2 py-1 bg-white/10 backdrop-blur-sm rounded text-xs">
                    {Math.round((item.mlConfidence || 0) * 100)}% güven
                  </span>
                )}
              </div>

              {/* Başlık */}
              <h2 className="text-3xl md:text-5xl font-bold mb-4 leading-tight group-hover/card:text-yellow-300 transition-colors line-clamp-3">
                {item.baslik}
              </h2>

              {/* Meta Açıklama */}
              {item.metaAciklama && (
                <p className="text-lg md:text-xl text-white/90 mb-6 line-clamp-2">
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
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full transition-all transform hover:scale-110"
            aria-label="Önceki haber"
          >
            <ChevronLeft size={28} className="text-white" />
          </button>

          {/* Next Button */}
          <button
            onClick={goToNext}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full transition-all transform hover:scale-110"
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
                    ? "w-8 h-2 bg-white"
                    : "w-2 h-2 bg-white/50 hover:bg-white/80"
                } rounded-full`}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}

      {/* Play/Pause Indicator */}
      <div className="absolute top-4 right-4 z-20 text-xs text-white/70 font-medium">
        {isPaused ? "⏸ Durduruldu" : "▶ Otomatik"}
      </div>
    </div>
  );
}
