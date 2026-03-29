import type { Metadata } from "next";
import HaberDetayClient from "./HaberDetayClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

interface Props {
    params: Promise<{ slug: string }>;
}

type NewsDetail = {
    baslik: string;
    metaAciklama: string | null;
    icerik: string | null;
    gorselUrl: string | null;
    yayinlanmaTarihi: string;
    kategori?: {
        ad?: string;
    };
    kaynakUrl?: string | null;
};

async function fetchNewsBySlug(slug: string): Promise<NewsDetail | null> {
    try {
        const res = await fetch(`${API_BASE}/api/news/${slug}`, {
            next: { revalidate: 600 },
        });

        if (!res.ok) return null;

        const data = await res.json();
        return data?.data ?? null;
    } catch {
        return null;
    }
}

/**
 * generateMetadata: Next.js sunucu tarafında çalışır.
 * Her haber sayfası için tam Open Graph + Twitter Card + canonical meta tag üretir.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const news = await fetchNewsBySlug(slug);

    if (!news) {
        return {
            title: "Haber Bulunamadı — AI Haber Ajansı",
            robots: { index: false },
        };
    }

    const description = (news.metaAciklama || news.icerik?.substring(0, 155) || "").substring(0, 155);
    const imageUrl = news.gorselUrl || `${SITE_URL}/next.svg`;
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
}

export default async function HaberDetayPage({ params }: Props) {
    const { slug } = await params;
    const news = await fetchNewsBySlug(slug);

    const description = (news?.metaAciklama || news?.icerik?.substring(0, 155) || "").substring(0, 155);
    const imageUrl = news?.gorselUrl || `${SITE_URL}/next.svg`;
    const canonical = `${SITE_URL}/haber/${slug}`;

    const jsonLd = news
        ? {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: news.baslik,
            datePublished: news.yayinlanmaTarihi,
            dateModified: news.yayinlanmaTarihi,
            articleSection: news.kategori?.ad || "Genel",
            description,
            image: [imageUrl],
            mainEntityOfPage: canonical,
            publisher: {
                "@type": "Organization",
                name: "AI Haber Ajansı",
            },
            isBasedOn: news.kaynakUrl || undefined,
        }
        : null;

    return (
        <>
            {jsonLd ? (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            ) : null}
            <HaberDetayClient params={Promise.resolve({ slug })} />
        </>
    );
}
