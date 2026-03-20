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

/**
 * Haberin görselini döner.
 * - gorselUrl varsa ve placeholder değilse onu kullanır.
 * - Yoksa picsum.photos üzerinden deterministik, her haber için farklı ama tutarlı bir görsel üretir.
 */
export function getNewsImage(item: NewsItem): string {
  if (
    item.gorselUrl &&
    !item.gorselUrl.includes("placeholder") &&
    !item.gorselUrl.includes("bbc.co.uk/images/") && // BBC genel placeholder'ı
    !item.gorselUrl.includes("unsplash.com") // Backend'in eski hardcoded URL'leri
  ) {
    return item.gorselUrl;
  }
  // Picsum: API key gerektirmez, rate limit sorunu çok düşük, her seed için sabit görsel döner
  const seed = item.id;
  return `https://picsum.photos/seed/${seed}/800/450`;
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
