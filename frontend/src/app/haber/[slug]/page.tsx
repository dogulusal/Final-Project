import type { Metadata } from "next";
import HaberDetayClient from "./HaberDetayClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

interface Props {
    params: Promise<{ slug: string }>;
}

/**
 * generateMetadata: Next.js sunucu tarafında çalışır.
 * Her haber sayfası için tam Open Graph + Twitter Card + canonical meta tag üretir.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;

    try {
        const res = await fetch(`${API_BASE}/api/news/${slug}`, {
            next: { revalidate: 600 }, // 10 dakika cache
        });

        if (!res.ok) {
            return {
                title: "Haber Bulunamadı — AI Haber Ajansı",
                robots: { index: false },
            };
        }

        const data = await res.json();
        const news = data?.data;

        if (!news) return { title: "AI Haber Ajansı" };

        const description = (news.metaAciklama || news.icerik?.substring(0, 155) || "").substring(0, 155);
        const imageUrl = news.gorselUrl || `${SITE_URL}/og-default.jpg`;
        const canonical = `${SITE_URL}/haber/${slug}`;

        return {
            title: `${news.baslik} — AI Haber Ajansı`,
            description,
            alternates: {
                canonical,
            },
            openGraph: {
                type: "article",
                url: canonical,
                title: news.baslik,
                description,
                images: [{ url: imageUrl, width: 800, height: 450, alt: news.baslik }],
                publishedTime: news.yayinlanmaTarihi,
                section: news.kategori?.ad,
                locale: "tr_TR",
                siteName: "AI Haber Ajansı",
            },
            twitter: {
                card: "summary_large_image",
                title: news.baslik,
                description,
                images: [imageUrl],
            },
        };
    } catch {
        return { title: "AI Haber Ajansı" };
    }
}

export default function HaberDetayPage({ params }: Props) {
    return <HaberDetayClient params={params} />;
}
