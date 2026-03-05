/**
 * Sosyal Medya Adapter Interface + Mock Adapter
 * Demo'da gerçek API yerine mock kullanılır, paylaşımlar DB'ye loglanır.
 */

export interface SocialPost {
    baslik: string;
    ozet: string;
    gorsel_url: string;
    haber_url: string;
    etiketler: string[];
}

export interface PublishResult {
    success: boolean;
    platform: string;
    postId?: string;
    error?: string;
    publishedAt: Date;
}

export interface FailedPost extends SocialPost {
    platform: string;
    retryCount: number;
    lastError: string;
}

export interface ISocialMediaAdapter {
    readonly platform: string;
    publish(content: SocialPost): Promise<PublishResult>;
    retry(failedPost: FailedPost): Promise<PublishResult>;
}

/**
 * MockSocialAdapter — Risk Azaltma
 * Sosyal medya API'leri hazır olmadan demo yapabilmek için
 */
export class MockSocialAdapter implements ISocialMediaAdapter {
    readonly platform: string;

    constructor(platform: string) {
        this.platform = platform;
    }

    async publish(content: SocialPost): Promise<PublishResult> {
        const startTime = Date.now();
        // Simüle edilmiş gecikme (500-1500ms)
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
        const duration = Date.now() - startTime;

        console.log(`[MockSocial][${this.platform}] Paylaşım simüle edildi (${duration}ms): ${content.baslik}`);

        return {
            success: true,
            platform: this.platform,
            postId: `mock_${this.platform}_${Date.now()}`,
            publishedAt: new Date(),
        };
    }

    async retry(failedPost: FailedPost): Promise<PublishResult> {
        console.log(`[MockSocial][${this.platform}] Retry #${failedPost.retryCount + 1}: ${failedPost.baslik}`);
        return this.publish(failedPost);
    }
}
