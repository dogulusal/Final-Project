"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { NewsItem } from "@/types/news";
import { ChevronRight, ChevronLeft, Target } from "lucide-react";

interface Props {
  newsItems: NewsItem[];
}

export default function PersonalizedHeroCarousel({ newsItems }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-scroll logic
  useEffect(() => {
    if (newsItems.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % newsItems.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [newsItems.length]);

  if (!newsItems || newsItems.length === 0) return null;

  const currentNews = newsItems[currentIndex];

  const goNext = () => setCurrentIndex((prev) => (prev + 1) % newsItems.length);
  const goPrev = () => setCurrentIndex((prev) => (prev - 1 + newsItems.length) % newsItems.length);

  return (
    <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 mb-8 group">
      <div className="flex items-center gap-2 mb-4">
        <Target size={20} className="text-[var(--accent-warm)]" />
        <h2 className="headline-md font-bold text-[var(--accent-primary)] dark:text-white">
          Sizin İçin Seçilenler
        </h2>
      </div>

      <div className="relative h-[240px] md:h-[300px] w-full rounded-2xl overflow-hidden shadow-2xl bg-[var(--bg-secondary)] border border-[var(--border-medium)]">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-card)] via-[var(--bg-card)] to-transparent z-0 opacity-90 dark:opacity-80"></div>
        
        {/* Decorative elements */}
        <div className="absolute top-[-50%] right-[-10%] w-[300px] h-[300px] rounded-full bg-[var(--accent-warm)] opacity-10 blur-3xl z-0"></div>
        <div className="absolute bottom-[-50%] left-[-10%] w-[200px] h-[200px] rounded-full bg-[var(--accent-blue)] opacity-10 blur-3xl z-0"></div>

        {/* Content Container */}
        <div className="absolute inset-0 z-10 p-8 flex flex-col justify-center max-w-2xl">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700" key={currentNews.id}>
            <span className="inline-block px-3 py-1 mb-4 text-xs font-bold tracking-widest text-[var(--accent-primary)] dark:text-[var(--bg-primary)] bg-[var(--accent-warm)] rounded-full uppercase">
              {currentNews.kategori?.ad || "Özel"}
            </span>
            
            <Link href={`/haber/${currentNews.slug}`} className="block group/title">
              <h3 className="headline-lg font-bold mb-4 line-clamp-2 text-[var(--text-primary)] group-hover/title:text-[var(--accent-warm)] transition-colors">
                {currentNews.baslik}
              </h3>
            </Link>

            {currentNews.metaAciklama && (
              <p className="text-[var(--text-secondary)] text-sm md:text-base line-clamp-2 md:line-clamp-3 leading-relaxed max-w-xl">
                {currentNews.metaAciklama}
              </p>
            )}

            <Link 
              href={`/haber/${currentNews.slug}`}
              className="inline-flex items-center mt-6 text-sm font-bold tracking-wide text-[var(--text-inverse)] bg-[var(--accent-primary)] hover:bg-[var(--accent-warm)] dark:bg-[var(--accent-warm)] dark:text-[var(--bg-primary)] px-6 py-2.5 rounded-full transition-all duration-300 transform hover:scale-105"
            >
              Habere Git <ChevronRight size={16} className="ml-1" />
            </Link>
          </div>
        </div>

        {/* Navigation Buttons */}
        {newsItems.length > 1 && (
          <>
            <button 
              onClick={goPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[var(--text-primary)] shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-[var(--bg-card-hover)] hover:scale-110"
              aria-label="Önceki haber"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={goNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-[var(--text-primary)] shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-[var(--bg-card-hover)] hover:scale-110"
              aria-label="Sonraki haber"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {/* Indicators */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {newsItems.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-6 bg-[var(--accent-warm)]' : 'w-2 bg-[var(--border-medium)] hover:bg-[var(--text-muted)]'}`}
              aria-label={`Slayt ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
