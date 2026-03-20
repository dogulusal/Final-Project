export class ImageService {
  static getImageForNews(categorySlug: string, newsTitle: string, slug: string): string {
    const rawToHash = slug + categorySlug + newsTitle;
    let hash = 0;
    for (let i = 0; i < rawToHash.length; i++) {
        hash = ((hash << 5) - hash) + rawToHash.charCodeAt(i);
        hash |= 0;
    }
    const seed = Math.abs(hash);
    return `https://picsum.photos/seed/${seed}/800/450`;
  }
}
