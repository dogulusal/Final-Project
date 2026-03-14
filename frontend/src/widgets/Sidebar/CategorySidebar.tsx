import Link from "next/link";
import { prisma } from "@/shared/lib/prisma";

export default async function CategorySidebar() {
    // Kategori verilerini Prisma üzerinden doğrudan çekiyoruz
    const categories = await prisma.kategori.findMany({
        orderBy: {
            ad: 'asc'
        }
    });

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
