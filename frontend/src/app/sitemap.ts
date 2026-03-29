import type { MetadataRoute } from "next";

// Server-side sitemap fetch should prioritize Docker internal URL.
const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://backend:3000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const dynamic = "force-dynamic";

type SitemapNews = {
  slug?: string;
  yayinlanmaTarihi?: string;
};

type SitemapKategori = {
  slug?: string;
  ad?: string;
};

async function fetchNewsForSitemap(): Promise<SitemapNews[]> {
  try {
    const res = await fetch(`${API_BASE}/api/news?status=hazir&page=1&limit=1000`, {
      next: { revalidate: 1800 },
    });

    if (!res.ok) return [];

    const payload = await res.json();
    const news = Array.isArray(payload?.data) ? payload.data : [];
    return news;
  } catch (error) {
    console.warn("[sitemap] news fetch failed", error);
    return [];
  }
}

async function fetchCategoriesForSitemap(): Promise<SitemapKategori[]> {
  try {
    const res = await fetch(`${API_BASE}/api/news/categories`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) return [];

    const payload = await res.json();
    const categories = Array.isArray(payload?.data) ? payload.data : [];
    return categories;
  } catch (error) {
    console.warn("[sitemap] categories fetch failed", error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/kategoriler`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/hakkinda`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const [news, categories] = await Promise.all([
    fetchNewsForSitemap(),
    fetchCategoriesForSitemap(),
  ]);

  const newsPages: MetadataRoute.Sitemap = news
    .filter((item) => typeof item.slug === "string" && item.slug.length > 0)
    .map((item) => ({
      url: `${SITE_URL}/haber/${item.slug}`,
      lastModified: item.yayinlanmaTarihi ? new Date(item.yayinlanmaTarihi) : now,
      changeFrequency: "daily",
      priority: 0.7,
    }));

  const categoriPages: MetadataRoute.Sitemap = categories
    .filter((item) => typeof item.slug === "string" && item.slug.length > 0)
    .map((item) => ({
      url: `${SITE_URL}/kategoriler/${item.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

  return [...staticPages, ...categoriPages, ...newsPages];
}
