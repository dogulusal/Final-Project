"use client";

import Link from "next/link";
import { NewsItem } from "@/types/news";

const BADGE_MAP: Record<string, string> = {
    Spor: "badge-spor",
    Ekonomi: "badge-ekonomi",
    Teknoloji: "badge-teknoloji",
    Siyaset: "badge-siyaset",
    Dünya: "badge-dunya",
    Sağlık: "badge-saglik",
    Genel: "badge-genel",
};

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} dk önce`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} sa önce`;
    const days = Math.floor(hours / 24);
    return `${days} gün önce`;
}

function getHostname(url: string | null): string {
    if (!url) return "Ajans";
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return "Ajans";
    }
}

interface Props {
    news: NewsItem;
}

export default function NewsCard({ news }: Props) {
    const categoryName = news.kategori?.ad || "Genel";
    const badgeClass = BADGE_MAP[categoryName] || "badge-genel";

    // Sentiment Glow Class Mapping
    const sentiment = news.sentiment?.toLowerCase() || "nötr";
    let glowClass = "sentiment-glow-notr";
    if (sentiment === "pozitif") glowClass = "sentiment-glow-pozitif";
    else if (sentiment === "negatif") glowClass = "sentiment-glow-negatif";

    // Bullet points parsing for Smart Card hover
    let bullets: string[] = [];
    if (news.icerik) {
        bullets = news.icerik
            .split('\n')
            .filter(line => line.trim().startsWith('-'))
            .map(line => line.replace(/^-\s*/, '').trim())
            .slice(0, 2); // Get first 2 bullets
    }

    return (
        <Link href={`/haber/${news.slug}`} className="block h-full cursor-pointer">
            <article className={`news-card p-5 flex flex-col h-full group ${glowClass} relative overflow-hidden transition-all duration-300`}>
                {/* Header */}
                <div className="flex items-center justify-between mb-3 relative z-10">
                    <span className={`${badgeClass} px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase`}>
                        {categoryName}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                        {timeAgo(news.yayinlanmaTarihi)}
                    </span>
                </div>

                {/* Title */}
                <h3 className="headline-sm mb-2 text-[var(--text-primary)] group-hover:text-[var(--accent-warn)] transition-colors duration-300 line-clamp-3 relative z-10">
                    {news.baslik}
                </h3>

                {/* Description & Bullets Container */}
                <div className="relative flex-grow mt-2">
                    {/* Desktop: Hover'da kaybolur, Mobile: Hep görünür (Opacity 0 logic is conditional) */}
                    {news.metaAciklama && (
                        <p className={`text-sm text-[var(--text-secondary)] line-clamp-3 leading-relaxed transition-all duration-500 ease-in-out 
                            ${bullets.length > 0 ? 'md:group-hover:opacity-0 md:group-hover:translate-y-[-10px]' : ''}`}>
                            {news.metaAciklama}
                        </p>
                    )}
                    
                    {/* Hover Bullets: Desktop: Sadece hover'da, Mobile: Description altında direkt görünür */}
                    {bullets.length > 0 && (
                        <ul className="md:absolute md:inset-0 md:opacity-0 md:translate-y-[10px] md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-500 ease-in-out pointer-events-none flex flex-col gap-2 pt-1 md:mt-0 mt-3">
                            {bullets.map((bullet, idx) => (
                                <li key={idx} className="text-sm text-[var(--text-primary)] font-medium flex gap-2">
                                    <span className={`text-[var(--accent-warn)] flex-shrink-0 mt-0.5`}>•</span>
                                    <span className="line-clamp-2 md:line-clamp-3">{bullet}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 mt-8 border-t border-[var(--border-subtle)] relative z-10">
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">
                        {getHostname(news.kaynakUrl)}
                    </span>
                    <span className="text-[11px] text-[var(--accent-warm)] font-bold md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 tracking-wider">
                        HABERİ OKU →
                    </span>
                </div>
            </article>
        </Link>
    );
}
