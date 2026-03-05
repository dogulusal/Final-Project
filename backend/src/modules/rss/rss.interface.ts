export interface IRssSource {
    id: string;
    name: string;
    url: string;
    category: string;
}

export interface ParsedRssItem {
    title: string;
    link: string;
    pubDate: string;
    contentSnippet: string;
    source: string;
    category: string;
}

export interface IRssParserService {
    /**
     * Fetches and parses a single RSS feed.
     */
    fetchFeed(source: IRssSource): Promise<ParsedRssItem[]>;

    /**
     * Fetches multiple RSS feeds and aggregates the results.
     */
    fetchAllFeeds(sources: IRssSource[]): Promise<ParsedRssItem[]>;

    /**
     * Validates if an RSS feed URL is accessible and returns valid XML.
     */
    checkHealth(url: string): Promise<boolean>;
}
