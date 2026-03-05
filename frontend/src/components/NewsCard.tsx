"use client";

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
        <article className="glass-card p-6 flex flex-col h-full group cursor-pointer">
            {/* Header: Category + Time */}
            <div className="flex items-center justify-between mb-4">
                <span className={`${badgeClass} px-3 py-1 rounded-lg text-xs font-semibold`}>
                    {news.kategori?.ikon} {categoryName}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                    {timeAgo(news.yayinlanmaTarihi)}
                </span>
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold leading-snug mb-3 text-[var(--text-primary)] group-hover:text-[var(--accent-blue)] transition-colors duration-300 line-clamp-3">
                {news.baslik}
            </h3>

            {/* Description */}
            {news.metaAciklama && (
                <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2 flex-grow">
                    {news.metaAciklama}
                </p>
            )}

            {/* Footer: Stats */}
            <div className="flex items-center justify-between pt-4 mt-auto" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                    <span title="Görüntülenme">👁 {news.goruntulemeSayisi.toLocaleString("tr-TR")}</span>
                    <span title="Duygu Analizi">{sentimentIcon(news.sentiment)} {news.sentiment || "—"}</span>
                </div>

                {/* ML Confidence Bar */}
                {news.mlConfidence !== null && (
                    <div className="flex items-center gap-2" title={`ML Güven: %${(news.mlConfidence * 100).toFixed(0)}`}>
                        <span className="text-xs text-[var(--text-muted)]">AI</span>
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-primary)" }}>
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${news.mlConfidence * 100}%`,
                                    background: news.mlConfidence > 0.8 ? "var(--accent-emerald)" : news.mlConfidence > 0.6 ? "var(--accent-amber)" : "var(--accent-rose)",
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </article>
    );
}
