import { NewsItem } from "@/types/news";
import NewsFeedCard from "./NewsFeedCard";

interface NewsFeedProps {
    newsItems: NewsItem[];
    loading?: boolean;
}

export default function NewsFeed({ newsItems, loading = false }: NewsFeedProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-6 w-full">
                {/* Hero Skeleton (Lider Haber) */}
                <div className="md:col-span-4 lg:col-span-8 glass-card p-5 h-[420px] relative overflow-hidden">
                    <div className="skeleton-premium absolute inset-0 opacity-40"></div>
                    <div className="relative z-10 space-y-4">
                        <div className="h-6 w-24 skeleton-premium rounded"></div>
                        <div className="h-10 w-3/4 skeleton-premium rounded"></div>
                        <div className="h-24 w-full skeleton-premium rounded"></div>
                    </div>
                </div>
                {/* Grid Skeletons (Diğer Haberler) */}
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="md:col-span-2 lg:col-span-4 glass-card p-5 h-72 relative overflow-hidden">
                        <div className="skeleton-premium absolute inset-0 opacity-30"></div>
                        <div className="relative z-10 space-y-3">
                            <div className="h-4 w-20 skeleton-premium rounded"></div>
                            <div className="h-6 w-full skeleton-premium rounded"></div>
                            <div className="h-16 w-full skeleton-premium rounded"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (!newsItems || newsItems.length === 0) {
        return (
            <div className="w-full text-center py-20 glass-card">
                <span className="text-4xl mb-4 block">🔍</span>
                <p className="text-[var(--text-secondary)] font-medium">Hepsini Okudun!</p>
                <p className="text-sm text-[var(--text-muted)]">Arama kriterlerine uygun yeni bir haber bulunamadı.</p>
            </div>
        );
    }

    // İlk haberi hero yap, diğerlerini listele
    const heroNews = newsItems[0];
    const restNews = newsItems.slice(1);

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-6 w-full">
            {/* Hero Section */}
            {heroNews && (
                <div className="md:col-span-4 lg:col-span-8 w-full">
                    <NewsFeedCard news={heroNews} layout="hero" />
                </div>
            )}

            {/* Standard Grid & Compact Mode Mix */}
            {restNews.map((item, index) => {
                // Sona doğru olanları Compact mode gösterebiliriz (Örn: İlk 6 sonrası)
                const isCompactList = index >= 6;
                return (
                    <div 
                        key={item.id} 
                        className={isCompactList ? "md:col-span-4 lg:col-span-8" : "md:col-span-2 lg:col-span-4"}
                    >
                        <NewsFeedCard news={item} layout={isCompactList ? "compact" : "standard"} />
                    </div>
                );
            })}
        </div>
    );
}
