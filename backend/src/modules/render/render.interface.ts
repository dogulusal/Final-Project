/**
 * Render Module Interfaces
 * Haber görsellerini oluşturmak için gerekli yapılar
 */

export interface RenderOptions {
    width: number;
    height: number;
    backgroundColor: string;
    textColor: string;
    accentColor: string;
    fontFamily: string;
}

export interface NewsRenderInput {
    baslik: string;
    kategori: string;
    kaynak: string;
    tarih: string;
}

export interface RenderResult {
    buffer: Buffer;
    mimeType: string;
    width: number;
    height: number;
}

// Sosyal medya platformlarına göre hazır preset boyutlar
export enum RenderPreset {
    INSTAGRAM_POST = 'instagram_post',       // 1080x1080
    INSTAGRAM_STORY = 'instagram_story',     // 1080x1920
    TWITTER_POST = 'twitter_post',           // 1200x675
    FACEBOOK_POST = 'facebook_post',         // 1200x630
    THUMBNAIL = 'thumbnail',                 // 800x450
}

export const RENDER_PRESET_DIMENSIONS: Record<RenderPreset, { width: number; height: number }> = {
    [RenderPreset.INSTAGRAM_POST]: { width: 1080, height: 1080 },
    [RenderPreset.INSTAGRAM_STORY]: { width: 1080, height: 1920 },
    [RenderPreset.TWITTER_POST]: { width: 1200, height: 675 },
    [RenderPreset.FACEBOOK_POST]: { width: 1200, height: 630 },
    [RenderPreset.THUMBNAIL]: { width: 800, height: 450 },
};

export interface INewsRenderService {
    renderNewsImage(input: NewsRenderInput, preset: RenderPreset): Promise<RenderResult>;
}
