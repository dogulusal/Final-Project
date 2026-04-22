import { NewsItem } from "@/types/news";

const CATEGORY_QUERIES: Record<string, string> = {
  Teknoloji: "technology,computer,ai",
  Ekonomi: "economy,finance,stock-market",
  Siyaset: "politics,government,parliament",
  Spor: "sports,stadium,athlete",
  Dünya: "world,globe,international",
  Sağlık: "health,medicine,hospital",
  Genel: "news,newspaper,media",
};

function isValidImageUrl(url: string): boolean {
  if (!url || url.length < 10) return false;
  if (url.includes('placeholder')) return false;
  if (url.includes('bbc.co.uk')) return false;
  if (url === 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167') return false;
  return true;
}

export function getNewsImage(item: NewsItem): string {
  if (item.gorselUrl && isValidImageUrl(item.gorselUrl)) {
    return item.gorselUrl;
  }
  const category = item.kategori?.ad || 'Genel';
  const query = CATEGORY_QUERIES[category] || CATEGORY_QUERIES['Genel'];
  const seed = item.id % 1000;
  return `https://source.unsplash.com/800x450/?${query}&sig=${seed}`;
}

/**
 * Unsplash alternatifi — rate limit düşerse yedek olarak kullanılabilir.
 */
export function getNewsImageUnsplash(item: NewsItem): string {
  if (
    item.gorselUrl &&
    !item.gorselUrl.includes("placeholder") &&
    !item.gorselUrl.includes("unsplash.com")
  ) {
    return item.gorselUrl;
  }
  const query = CATEGORY_QUERIES[item.kategori?.ad] ?? "news";
  const seed = item.id;
  return `https://source.unsplash.com/800x450/?${query}&sig=${seed}`;
}
