import { RssParserService } from '../modules/rss/rss.service';
import Parser from 'rss-parser';

// Mocking rss-parser
jest.mock('rss-parser');

describe('RssParserService', () => {
    let rssService: RssParserService;
    let mockParser: jest.Mocked<Parser>;

    beforeEach(() => {
        rssService = new RssParserService();
        mockParser = (rssService as any).parser;
    });

    it('should fetch and parse RSS feeds correctly', async () => {
        const mockFeed = {
            items: [
                { title: 'Test Haber', link: 'http://test.com', isoDate: '2024-03-20T10:00:00Z', contentSnippet: 'Test içerik' }
            ]
        };
        mockParser.parseURL.mockResolvedValue(mockFeed as any);

        const source = { id: 'test', name: 'Test Source', url: 'http://test.com/rss', category: 'Genel' };
        const result = await rssService.fetchFeed(source);

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Test Haber');
        expect(result[0].source).toBe('Test Source');
    });

    it('should handle errors gracefully and return an empty array', async () => {
        mockParser.parseURL.mockRejectedValue(new Error('Network Error'));

        const source = { id: 'test', name: 'Test Source', url: 'http://test.com/rss', category: 'Genel' };
        const result = await rssService.fetchFeed(source);

        expect(result).toEqual([]);
    });

    it('should aggregate results from multiple feeds with concurrency control', async () => {
        const mockFeed = { items: [{ title: 'Haber' }] };
        mockParser.parseURL.mockResolvedValue(mockFeed as any);

        const sources = [
            { id: '1', name: 'S1', url: 'u1', category: 'C1' },
            { id: '2', name: 'S2', url: 'u2', category: 'C2' },
            { id: '3', name: 'S3', url: 'u3', category: 'C3' }
        ];

        const result = await rssService.fetchAllFeeds(sources, 2);

        expect(result).toHaveLength(3);
        expect(mockParser.parseURL).toHaveBeenCalledTimes(3);
    });
});
