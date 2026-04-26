import Parser from 'rss-parser';
import { IRssParserService, IRssSource, ParsedRssItem } from './rss.interface';

export class RssParserService implements IRssParserService {
    private parser: Parser;

    private normalizeText(value: unknown): string {
        if (typeof value === 'string') {
            return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }

        if (Array.isArray(value)) {
            return value.map((item) => this.normalizeText(item)).filter(Boolean).join(' ').trim();
        }

        if (value && typeof value === 'object') {
            const record = value as Record<string, unknown>;
            const preferred = record['#text'] ?? record._ ?? record.value ?? record.content;
            if (preferred !== undefined) {
                return this.normalizeText(preferred);
            }

            try {
                return JSON.stringify(record);
            } catch {
                return '';
            }
        }

        return '';
    }

    constructor() {
        this.parser = new Parser({
            timeout: 10000, // 10 saniye zaman aşımı
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AI-News-Agency-Bot',
            },
            customFields: {
                item: [
                    ['media:content', 'media'],
                    ['media:thumbnail', 'mediaThumbnail'],
                ],
            },
        });
    }

    private extractImageUrl(item: Record<string, any>): string | undefined {
        // 1. enclosure (most RSS feeds)
        const encUrl = item.enclosure?.url;
        if (encUrl && typeof encUrl === 'string' && /\.(jpg|jpeg|png|webp|gif)/i.test(encUrl)) {
            return encUrl;
        }
        // enclosure without extension but with image type
        if (encUrl && item.enclosure?.type?.startsWith('image/')) {
            return encUrl;
        }
        // 2. media:content
        const mediaUrl = item.media?.$?.url || item.media?.url;
        if (mediaUrl && typeof mediaUrl === 'string') {
            return mediaUrl;
        }
        // 3. media:thumbnail
        const thumbUrl = item.mediaThumbnail?.$?.url || item.mediaThumbnail?.url;
        if (thumbUrl && typeof thumbUrl === 'string') {
            return thumbUrl;
        }
        // 4. Parse from content HTML (img src)
        const content = item['content:encoded'] || item.content || '';
        if (typeof content === 'string') {
            const imgMatch = content.match(/<img[^>]+src=["']([^"']+\.(jpg|jpeg|png|webp))[^"']*["']/i);
            if (imgMatch) return imgMatch[1];
        }
        return undefined;
    }

    async fetchFeed(source: IRssSource): Promise<ParsedRssItem[]> {
        try {
            console.log(`[RSS] ${source.name} kaynağından veri çekiliyor... (${source.url})`);
            const feed = await this.parser.parseURL(source.url);

            const items: ParsedRssItem[] = feed.items.map((item) => ({
                title: this.normalizeText(item.title) || 'Başlıksız',
                link: this.normalizeText(item.link),
                pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
                contentSnippet: this.normalizeText(item.contentSnippet || item.content || (item as any).summary),
                source: source.name,
                category: source.category,
                imageUrl: this.extractImageUrl(item as Record<string, any>),
            }));

            console.log(`[RSS] ${source.name}: ${items.length} haber okundu.`);
            return items;
        } catch (error) {
            console.error(`[RSS Error] ${source.name} okunamadı:`, error instanceof Error ? error.message : error);
            // Hata durumunda boş dizi dönerek sistemin kırılmasını engelliyoruz
            return [];
        }
    }

    async fetchAllFeeds(sources: IRssSource[], concurrencyLimit = 5): Promise<ParsedRssItem[]> {
        const results: ParsedRssItem[][] = [];
        
        // Kaynakları belirtilen limit dahilinde parçalara (batch) bölerek işleyelim
        // Bu sayede 100+ kaynağı aynı anda tetikleyip sistemi yormayız.
        for (let i = 0; i < sources.length; i += concurrencyLimit) {
            const batch = sources.slice(i, i + concurrencyLimit);
            const batchResults = await Promise.all(
                batch.map((source) => this.fetchFeed(source))
            );
            results.push(...batchResults);
        }
        
        return results.flat();
    }

    async checkHealth(url: string): Promise<boolean> {
        try {
            await this.parser.parseURL(url);
            return true;
        } catch (error) {
            console.error(`[RSS Health] Kaynak hatalı (${url}):`, error instanceof Error ? error.message : error);
            return false;
        }
    }
}
