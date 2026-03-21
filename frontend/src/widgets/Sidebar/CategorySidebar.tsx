import Link from "next/link";

const FALLBACK_CATEGORIES = [
    { id: 1, ad: "Spor", slug: "spor", renkKodu: "#1a472a", ikon: "⚽" },
    { id: 2, ad: "Ekonomi", slug: "ekonomi", renkKodu: "#1a2a47", ikon: "📈" },
    { id: 3, ad: "Teknoloji", slug: "teknoloji", renkKodu: "#2d1a47", ikon: "💻" },
    { id: 4, ad: "Siyaset", slug: "siyaset", renkKodu: "#471a1a", ikon: "🏛️" },
    { id: 5, ad: "Dünya", slug: "dunya", renkKodu: "#1a3847", ikon: "🌍" },
    { id: 6, ad: "Sağlık", slug: "saglik", renkKodu: "#47381a", ikon: "🏥" },
    { id: 7, ad: "Genel", slug: "genel", renkKodu: "#2c3e50", ikon: "📰" },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default async function CategorySidebar() {
    let categories = FALLBACK_CATEGORIES;
    try {
        const res = await fetch(`${API_BASE}/api/news/categories`, { next: { revalidate: 300 } });
        if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                categories = json.data;
            }
        }
    } catch (e) {
        console.error("[CategorySidebar] API isteği başarısız, fallback kullanılıyor:", e);
    }

    return (
        <aside className="w-full h-full flex flex-col gap-6 sticky top-24 pt-4">
            <h2 className="text-xl font-bold border-b border-[var(--border-subtle)] pb-2 mb-2 text-[var(--accent-purple)]">
                Kategoriler
            </h2>
            <nav className="flex flex-col gap-2">
                <Link 
                    href="/kategoriler" 
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[var(--bg-card-hover)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
                >
                    <span className="text-lg">🔥</span> 
                    <span>Tümü</span>
                </Link>
                {categories.map((kategori: { id: number; ad: string; slug: string; renkKodu: string; ikon: string | null; }) => (
                    <Link 
                        key={kategori.id}
                        href={`/kategoriler/${kategori.slug}`}
                        className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[var(--bg-card-hover)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
                    >
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: kategori.renkKodu || 'var(--accent-blue)' }}></span>
                        <span>{kategori.ad}</span>
                    </Link>
                ))}
            </nav>
            
            <div className="mt-auto pt-6 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
                &copy; 2026 AI Haber Ajansı
            </div>
        </aside>
    );
}

