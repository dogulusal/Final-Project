import Parser from 'rss-parser';
import { IRssParserService, IRssSource, ParsedRssItem } from './rss.interface';

export class RssParserService implements IRssParserService {
    private parser: Parser;

    constructor() {
        this.parser = new Parser({
            timeout: 10000, // 10 saniye zaman aşımı
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AI-News-Agency-Bot',
            },
        });
    }

    async fetchFeed(source: IRssSource): Promise<ParsedRssItem[]> {
        try {
            console.log(`[RSS] ${source.name} kaynağından veri çekiliyor... (${source.url})`);
            const feed = await this.parser.parseURL(source.url);

            const items: ParsedRssItem[] = feed.items.map((item) => ({
                title: item.title || 'Başlıksız',
                link: item.link || '',
                pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
                contentSnippet: item.contentSnippet || item.content || '',
                source: source.name,
                category: source.category,
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
