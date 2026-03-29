import { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import NewsCard from "@/components/NewsCard";
import Footer from "@/components/Footer";
import Link from "next/link";
import { NewsItem } from "@/types/news";

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://backend:3000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const dynamic = "force-dynamic";
export const dynamicParams = true;
export const revalidate = 300;

interface KateogriBilgisi {
  id: number;
  ad: string;
  slug: string;
  renkKodu: string;
  ikon: string | null;
}

interface Params {
  slug: string;
}

interface PageProps {
  params: Promise<Params>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  // Tüm kategorileri fetch et ve slug ile eşleştir
  try {
    const res = await fetch(`${API_BASE}/api/news/categories`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return {
        title: "Kategori Haberleri",
        description: "Kategori haberleri geçici olarak yüklenemedi.",
      };
    }

    const kategorilerData = await res.json();
    const categories = Array.isArray(kategorilerData?.data) ? kategorilerData.data : [];
    const kategori = categories.find((k: KateogriBilgisi) => k.slug === slug);

    if (!kategori) {
      return {
        title: "Kategori Bulunamadı",
        description: "Aradığınız kategori bulunamadı.",
      };
    }

    const title = `${kategori.ad} Haberleri`;
    const description = `${kategori.ad} kategorisinde en son haberler ve güncellemeler. Keşfet ve oku.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        url: `${SITE_URL}/kategoriler/${slug}`,
        siteName: "Haber Platformu",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
      alternates: {
        canonical: `${SITE_URL}/kategoriler/${slug}`,
      },
    };
  } catch {
    return {
      title: "Kategori Haberleri",
      description: "Kategori haberleri geçici olarak yüklenemedi.",
    };
  }
}

export async function generateStaticParams() {
  // Avoid build-time hard dependency to backend network.
  return [];
}

export default async function KategoriPage({ params }: PageProps) {
  const { slug } = await params;

  let kategori: KateogriBilgisi | null = null;
  let news: NewsItem[] = [];
  let fetchFailed = false;

  const dedupeNews = (items: NewsItem[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = (item.slug || "").toLowerCase().trim() || `${(item.baslik || "").toLowerCase().trim()}::${(item.kaynakUrl || "").toLowerCase().trim()}`;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  try {
    // Kategori bilgisini ve haberlerini paralel fetch et
    const [kategorilerRes, haberlerRes] = await Promise.all([
      fetch(`${API_BASE}/api/news/categories`, { next: { revalidate: 3600 } }),
      fetch(`${API_BASE}/api/news?category=${slug}&status=hazir&limit=100`, {
        next: { revalidate: 300 },
      }),
    ]);

    if (kategorilerRes.ok) {
      const kategorilerData = await kategorilerRes.json();
      const categories = Array.isArray(kategorilerData?.data) ? kategorilerData.data : [];
      kategori = categories.find((k: KateogriBilgisi) => k.slug === slug) || null;
    }

    if (haberlerRes.ok) {
      const haberData = await haberlerRes.json();
      news = Array.isArray(haberData?.data) ? dedupeNews(haberData.data) : [];
    }
  } catch (error) {
    fetchFailed = true;
    console.error(`[KategoriPage] Error fetching data for slug ${slug}:`, error);
  }

  if (!kategori) {
    if (fetchFailed) {
      return (
        <>
          <Navbar />
          <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12">
            <div className="container mx-auto px-4">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Kategori Geçici Olarak Ulaşılamıyor</h1>
                <p className="text-gray-600 mt-2">Birkaç saniye sonra sayfayı yenileyip tekrar deneyin.</p>
              </div>
              <Link href="/kategoriler" className="text-blue-600 hover:underline">
                ← Tüm Kategorilere Dön
              </Link>
            </div>
          </main>
          <Footer />
        </>
      );
    }

    return notFound();
  }

  const CATEGORY_ICONS: Record<string, string> = {
    Spor: "⚽",
    Ekonomi: "💰",
    Teknoloji: "💻",
    Siyaset: "🏛️",
    Dünya: "🌍",
    Sağlık: "🏥",
    Genel: "📰",
  };

  const displayIcon = kategori.ikon || CATEGORY_ICONS[kategori.ad] || "📌";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${kategori.ad} Haberleri`,
            description: `${kategori.ad} kategorisindeki haberler`,
            url: `${SITE_URL}/kategoriler/${slug}`,
            mainEntity: {
              "@type": "ItemList",
              itemListElement: news.slice(0, 10).map((item, idx) => ({
                "@type": "NewsArticle",
                position: idx + 1,
                headline: item.baslik,
                url: `${SITE_URL}/haber/${item.slug}`,
              })),
            },
          }),
        }}
      />

      <Navbar />

      <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12">
        <div className="container mx-auto px-4">
          {/* Kategori Başlığı */}
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-5xl">{displayIcon}</span>
              <h1 className="text-4xl font-bold text-gray-900">{kategori.ad} Haberleri</h1>
            </div>
            <Link href="/kategoriler" className="text-blue-600 hover:underline">
              ← Tüm Kategorilere Dön
            </Link>
          </div>

          {/* Haber Listesi */}
          {news.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {news.map((item) => (
                <NewsCard key={item.id} news={item} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-gray-600 text-lg">Bu kategoride henüz haber bulunmamaktadır.</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
