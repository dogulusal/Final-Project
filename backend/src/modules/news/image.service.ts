const CATEGORY_IMAGES: Record<string, string[]> = {
  spor: [
    "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80",
    "https://images.unsplash.com/photo-1461896756970-f09c1b127b59?w=800&q=80",
    "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=80",
    "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&q=80",
  ],
  ekonomi: [
    "https://images.unsplash.com/photo-1611974714405-8c2056f4d5b1?w=800&q=80",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
    "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&q=80",
    "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&q=80",
  ],
  teknoloji: [
    "https://images.unsplash.com/photo-1518770660139-4aadc5af3cf9?w=800&q=80",
    "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&q=80",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80",
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80",
  ],
  siyaset: [
    "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=80",
    "https://images.unsplash.com/photo-1541872703-74c5e443d1fe?w=800&q=80",
    "https://images.unsplash.com/photo-1523995442307-d3ebf7b3996f?w=800&q=80",
    "https://images.unsplash.com/photo-1575318634028-6a0cfcb60c59?w=800&q=80",
  ],
  dunya: [
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80",
    "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?w=800&q=80",
    "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?w=800&q=80",
    "https://images.unsplash.com/photo-1501503069356-3c6b82a17d89?w=800&q=80",
  ],
  saglik: [
    "https://images.unsplash.com/photo-1505751172107-573220004ceb?w=800&q=80",
    "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=800&q=80",
    "https://images.unsplash.com/photo-1576091160550-217359f42f8c?w=800&q=80",
    "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80",
  ],
  genel: [
    "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800&q=80",
    "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80",
    "https://images.unsplash.com/photo-1476242484419-cf8ce7ec7c6b?w=800&q=80",
  ]
};

export class ImageService {
  static getImageForNews(categorySlug: string, newsTitle: string): string {
    const images = CATEGORY_IMAGES[categorySlug] || CATEGORY_IMAGES.genel;
    let hash = 0;
    for (let i = 0; i < newsTitle.length; i++) {
        hash = ((hash << 5) - hash) + newsTitle.charCodeAt(i);
        hash |= 0;
    }
    const index = Math.abs(hash) % images.length;
    return images[index];
  }
}
