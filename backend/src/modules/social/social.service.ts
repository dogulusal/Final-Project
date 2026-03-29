import { MockSocialAdapter, SocialPost, PublishResult } from './social.interface';

/**
 * ⚠️ MOCK IMPLEMENTATION
 * Bu servis şu anda tamamen simüle edilmiş sosyal medya yayınları yapmaktadır.
 * Gerçek API entegrasyonları (Telegram, Twitter, LinkedIn) henüz yapılmadı.
 * 
 * Production için real adapter'lar implementasyonu gerektirir:
 * - TelegramAdapter (Bot API)
 * - TwitterAdapter (Twitter API v2)
 * - LinkedInAdapter (LinkedIn Share API)
 */
export class SocialService {
    private adapters: Map<string, MockSocialAdapter>;

    constructor() {
        this.adapters = new Map();
        // ⚠️ MOCK: Varsayılan mock adaptörler ekleniyor
        this.adapters.set('telegram', new MockSocialAdapter('Telegram'));
        this.adapters.set('twitter', new MockSocialAdapter('Twitter'));
        this.adapters.set('linkedin', new MockSocialAdapter('LinkedIn'));
    }

    async publishAll(content: SocialPost): Promise<PublishResult[]> {
        const results: PublishResult[] = [];
        for (const [platform, adapter] of this.adapters.entries()) {
            try {
                const res = await adapter.publish(content);
                results.push(res);
            } catch (err: any) {
                results.push({
                    success: false,
                    platform,
                    error: err.message,
                    publishedAt: new Date()
                });
            }
        }
        return results;
    }
}
