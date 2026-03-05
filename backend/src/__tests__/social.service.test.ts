import { SocialService } from '../modules/social/social.service';

describe('SocialService', () => {
    let service: SocialService;

    beforeEach(() => {
        service = new SocialService();
    });

    describe('publishAll', () => {
        it('should publish to all mock adapters', async () => {
            const results = await service.publishAll({
                baslik: 'Test Haber Başlığı',
                ozet: 'Bu bir test özetidir.',
                gorsel_url: 'https://example.com/image.png',
                haber_url: 'https://example.com/haber/test',
                etiketler: ['test', 'haber']
            });

            expect(results.length).toBe(3); // Telegram, Twitter, LinkedIn
            results.forEach(r => {
                expect(r.success).toBe(true);
                expect(r.postId).toBeDefined();
                expect(r.publishedAt).toBeInstanceOf(Date);
            });
        });

        it('should return results with correct platform names', async () => {
            const results = await service.publishAll({
                baslik: 'Platform Test',
                ozet: 'Test',
                gorsel_url: '',
                haber_url: 'https://example.com',
                etiketler: []
            });

            const platforms = results.map(r => r.platform);
            expect(platforms).toContain('Telegram');
            expect(platforms).toContain('Twitter');
            expect(platforms).toContain('LinkedIn');
        });
    });
});
