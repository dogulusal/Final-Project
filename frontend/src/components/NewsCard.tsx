"use client";

import Link from "next/link";
import type { NewsItem } from "@/app/page";

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

    return (
        <Link href={`/haber/${news.slug}`} className="block h-full">
            <article className="glass-card p-5 flex flex-col h-full group">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <span className={`${badgeClass} px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase`}>
                        {categoryName}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                        {timeAgo(news.yayinlanmaTarihi)}
                    </span>
                </div>

                {/* Title */}
                <h3 className="text-base font-bold leading-snug mb-2 text-[var(--text-primary)] group-hover:text-[var(--accent-blue)] transition-colors duration-200 line-clamp-2">
                    {news.baslik}
                </h3>

                {/* Description */}
                {news.metaAciklama && (
                    <p className="text-xs text-[var(--text-secondary)] mb-4 line-clamp-2 flex-grow leading-relaxed">
                        {news.metaAciklama}
                    </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 mt-auto border-t border-[var(--border-subtle)]">
                    <span className="text-[11px] text-[var(--text-muted)]">
                        {getHostname(news.kaynakUrl)}
                    </span>
                    <span className="text-[11px] text-[var(--accent-blue)] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        Oku →
                    </span>
                </div>
            </article>
        </Link>
    );
}
