import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export interface NewsFeedCardProps {
    news: any;
    layout?: "hero" | "standard" | "compact";
}

export default function NewsFeedCard({ news, layout = "standard" }: NewsFeedCardProps) {
    const isHero = layout === "hero";
    const isCompact = layout === "compact";

    // Smart Brevity - İçeriği madde işaretlerine bölüyoruz (AI özet maddeleri için simülasyon)
    const bulletPoints = news.icerik 
        ? news.icerik.split('. ').filter(Boolean).slice(0, isHero ? 3 : 2).map((s: string) => s + '.') 
        : [];

    return (
        <article className={`glass-card p-5 flex ${isCompact ? 'flex-row gap-4 items-center' : 'flex-col'} group relative h-full`}>
            {/* Optimize Edilmiş Thumbnail (next/image) */}
            {news.gorselUrl && !isCompact && (
                <div className={`relative w-full ${isHero ? 'h-64' : 'h-40'} mb-4 rounded-lg overflow-hidden shrink-0`}>
                    <Image 
                        src={news.gorselUrl} 
                        alt={news.baslik}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        priority={isHero}
                    />
                </div>
            )}
            {news.gorselUrl && isCompact && (
                <div className="relative w-20 h-20 shrink-0 rounded-md overflow-hidden">
                    <Image 
                        src={news.gorselUrl} 
                        alt={news.baslik}
                        fill
                        className="object-cover"
                        sizes="80px"
                    />
                </div>
            )}

            <div className="flex flex-col flex-grow">
                {/* Kategori ve Tarih (Meta) */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: news.kategori?.renkKodu || 'var(--accent-purple)' }}>
                            {news.kategori?.ad || "Genel"}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                            {new Date(news.yayinlanmaTarihi).toLocaleDateString("tr-TR", { day: 'numeric', month: 'short' })}
                        </span>
                    </div>
                    {news.mlConfidence && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]" title="AI Güven Skoru">
                            %{news.mlConfidence}
                        </span>
                    )}
                </div>

                {/* Başlık */}
                <h3 className={`${isHero ? 'text-2xl' : isCompact ? 'text-sm' : 'text-lg'} font-serif font-bold leading-tight mb-3 text-[var(--text-primary)] group-hover:text-[var(--accent-purple)] transition-colors`}>
                    <Link href={`/haber/${news.slug}`} scroll={false} className="before:absolute before:inset-0 z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-purple)] rounded" aria-label={`${news.baslik} haberinin AI özetini oku`}>
                        {news.baslik}
                    </Link>
                </h3>

                {/* Smart Brevity: Neden Önemli (Axiom) */}
                {!isCompact && news.metaAciklama && (
                    <div className="mb-3">
                        <span className="font-bold text-[var(--text-primary)] text-sm">Neden önemli: </span>
                        <span className="text-sm text-[var(--text-secondary)]">{news.metaAciklama}</span>
                    </div>
                )}

                {/* Madde İşaretleri */}
                {!isCompact && bulletPoints.length > 0 && (
                    <ul className="list-disc pl-5 mb-4 space-y-1">
                        {bulletPoints.map((pt: string, idx: number) => (
                            <li key={idx} className="text-sm text-[var(--text-secondary)] leading-relaxed marker:text-[var(--accent-purple)]">{pt}</li>
                        ))}
                    </ul>
                )}

                {/* AI Aksiyon Butonu (Kademeli Açıklama / Progressive Disclosure) */}
                <div className="mt-auto pt-4 flex justify-between items-center relative z-20">
                    <span className="text-xs text-[var(--text-muted)] font-medium">1 dk</span>
                    <button 
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--accent-purple)] text-[var(--accent-blue)] hover:text-white transition-colors text-xs font-semibold shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
                        tabIndex={-1} 
                        aria-hidden="true"
                    >
                        <Sparkles size={14} /> AI Özeti
                    </button>
                </div>
            </div>
        </article>
    );
}
