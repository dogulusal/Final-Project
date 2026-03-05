import { createCanvas, CanvasRenderingContext2D } from 'canvas';
import {
    INewsRenderService,
    NewsRenderInput,
    RenderPreset,
    RenderResult,
    RENDER_PRESET_DIMENSIONS,
} from './render.interface';

// Kategori → Renk eşleştirmesi (Magic string yerine enum/map)
const CATEGORY_COLORS: Record<string, { bg: string; accent: string }> = {
    Spor: { bg: '#1a472a', accent: '#2ecc71' },
    Ekonomi: { bg: '#1a2a47', accent: '#3498db' },
    Teknoloji: { bg: '#2d1a47', accent: '#9b59b6' },
    Siyaset: { bg: '#471a1a', accent: '#e74c3c' },
    Dünya: { bg: '#1a3847', accent: '#1abc9c' },
    Sağlık: { bg: '#47381a', accent: '#e67e22' },
    Genel: { bg: '#2c3e50', accent: '#ecf0f1' },
};

const DEFAULT_COLORS = { bg: '#2c3e50', accent: '#ecf0f1' };

export class NewsRenderService implements INewsRenderService {

    async renderNewsImage(input: NewsRenderInput, preset: RenderPreset): Promise<RenderResult> {
        const startTime = Date.now();
        const dimensions = RENDER_PRESET_DIMENSIONS[preset];
        const { width, height } = dimensions;
        const colors = CATEGORY_COLORS[input.kategori] || DEFAULT_COLORS;

        console.log(`[Render] Görsel oluşturuluyor: ${preset} (${width}x${height})`);

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // 1. Arka plan gradient
        this.drawGradientBackground(ctx, width, height, colors.bg);

        // 2. Süsleme: Dekoratif şekiller
        this.drawDecorations(ctx, width, height, colors.accent);

        // 3. Kategori badge
        this.drawCategoryBadge(ctx, input.kategori, colors.accent, width);

        // 4. Başlık metni
        this.drawTitle(ctx, input.baslik, width, height);

        // 5. Alt bilgi (kaynak + tarih)
        this.drawFooter(ctx, input.kaynak, input.tarih, width, height);

        // 6. Logo / Branding
        this.drawBranding(ctx, width, height);

        const buffer = canvas.toBuffer('image/png');
        const elapsed = Date.now() - startTime;
        console.log(`[Render] Görsel oluşturuldu (${elapsed}ms, ${(buffer.length / 1024).toFixed(1)} KB)`);

        return {
            buffer,
            mimeType: 'image/png',
            width,
            height,
        };
    }

    private drawGradientBackground(ctx: CanvasRenderingContext2D, w: number, h: number, baseColor: string): void {
        const gradient = ctx.createLinearGradient(0, 0, w, h);
        gradient.addColorStop(0, baseColor);
        gradient.addColorStop(1, this.darkenColor(baseColor, 30));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
    }

    private drawDecorations(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string): void {
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = accent;

        // Büyük dekoratif daire (sağ üst)
        ctx.beginPath();
        ctx.arc(w * 0.85, h * 0.15, w * 0.25, 0, Math.PI * 2);
        ctx.fill();

        // Küçük dekoratif daire (sol alt)
        ctx.beginPath();
        ctx.arc(w * 0.1, h * 0.85, w * 0.15, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
    }

    private drawCategoryBadge(ctx: CanvasRenderingContext2D, category: string, accent: string, canvasWidth: number): void {
        const padding = 16;
        const badgeHeight = 36;
        const fontSize = 16;
        const x = 40;
        const y = 40;

        ctx.font = `bold ${fontSize}px sans-serif`;
        const textWidth = ctx.measureText(category.toUpperCase()).width;
        const badgeWidth = textWidth + padding * 2;

        // Badge arka planı
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.roundRect(x, y, badgeWidth, badgeHeight, 8);
        ctx.fill();

        // Badge metni
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(category.toUpperCase(), x + padding, y + badgeHeight / 2);
    }

    private drawTitle(ctx: CanvasRenderingContext2D, title: string, w: number, h: number): void {
        const maxWidth = w - 80; // 40px padding her taraftan
        const fontSize = Math.min(Math.floor(w / 18), 48);
        const lineHeight = fontSize * 1.4;
        const startY = h * 0.35;

        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Kelime sarmalama (word wrap)
        const words = title.split(' ');
        let line = '';
        let y = startY;

        for (const word of words) {
            const testLine = line + (line ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && line) {
                ctx.fillText(line, 40, y);
                line = word;
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, 40, y);
    }

    private drawFooter(ctx: CanvasRenderingContext2D, source: string, date: string, w: number, h: number): void {
        const y = h - 50;
        const fontSize = 14;

        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';

        // Kaynak (sol)
        ctx.textAlign = 'left';
        ctx.fillText(`📰 ${source}`, 40, y);

        // Tarih (sağ)
        ctx.textAlign = 'right';
        ctx.fillText(date, w - 40, y);
    }

    private drawBranding(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        const brandText = 'AI HABER AJANSI';
        const fontSize = 12;
        const y = h - 20;

        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.textAlign = 'center';
        ctx.fillText(brandText, w / 2, y);
    }

    /**
     * Basit renk koyulaştırma (hex → daha koyu hex)
     */
    private darkenColor(hex: string, percent: number): string {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.max(0, (num >> 16) - percent);
        const g = Math.max(0, ((num >> 8) & 0x00ff) - percent);
        const b = Math.max(0, (num & 0x0000ff) - percent);
        return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
    }
}
