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
    if (hours < 24) return `${hours} saat önce`;
    const days = Math.floor(hours / 24);
    return `${days} gün önce`;
}

function sentimentIcon(sentiment: string | null): string {
    if (!sentiment) return "⚪";
    switch (sentiment) {
        case "Pozitif": return "🟢";
        case "Negatif": return "🔴";
        default: return "🟡";
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
            <article className="glass-card p-6 flex flex-col h-full group hover:shadow-2xl transition-all duration-300">
                {/* Header: Category + Time */}
                <div className="flex items-center justify-between mb-4">
                    <span className={`${badgeClass} px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase`}>
                        {categoryName}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] font-medium">
                        {timeAgo(news.yayinlanmaTarihi)}
                    </span>
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold leading-snug mb-3 text-[var(--text-primary)] group-hover:text-[var(--accent-blue)] transition-colors duration-300 line-clamp-3">
                    {news.baslik}
                </h3>

                {/* Description */}
                {news.metaAciklama && (
                    <p className="text-sm text-[var(--text-secondary)] mb-6 line-clamp-3 flex-grow leading-relaxed">
                        {news.metaAciklama}
                    </p>
                )}

                {/* Footer: Minimal Source/AI indicator */}
                <div className="flex items-center justify-between pt-4 mt-auto border-t border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded overflow-hidden flex items-center justify-center bg-[var(--bg-secondary)] text-[10px]">
                            {news.kaynakUrl ? "🔗" : "📰"}
                        </span>
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                            {news.kaynakUrl ? new URL(news.kaynakUrl).hostname.replace('www.', '') : "Ajans"}
                        </span>
                    </div>
                </div>
            </article>
        </Link>
    );
}
