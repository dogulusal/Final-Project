import Parser from 'rss-parser';
import { RSS_SOURCES } from '../../config/constants';
import { ContentQualityFilter } from '../news/content-quality-filter';
import { NewsService } from '../news/news.service';
import { mlService } from '../ml/ml.controller';
import { prisma } from '../../config/database';

export interface SchedulerStatus {
    isRunning: boolean;
    lastRun: Date | string | null;
    nextRun: Date | string | null;
    todayCount: number;
    failedSources: string[];
}

export class RssScheduler {
    private isRunning: boolean = false;
    private timer: NodeJS.Timeout | null = null;
    private lastRun: Date | null = null;
    private nextRun: Date | null = null;
    private todayCount: number = 0;
    
    // Sağlık takibi
    private sourceFailures: Record<string, number> = {};
    private readonly MAX_FAILURES = 5;
    
    // Dependencies
    private parser = new Parser({ timeout: 15000 });
    private qualityFilter = new ContentQualityFilter();
    private newsService = new NewsService();

    constructor(private intervalMinutes: number = 10) {}

    public getStatus(): SchedulerStatus {
        const failed = Object.entries(this.sourceFailures)
            .filter(([_, count]) => count >= this.MAX_FAILURES)
            .map(([id]) => id);

        return {
            isRunning: this.isRunning,
            lastRun: this.lastRun,
            nextRun: this.nextRun,
            todayCount: this.todayCount,
            failedSources: failed
        };
    }

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.sourceFailures = {};
        this.todayCount = 0;
        
        console.log(`[Scheduler] RSS toplayıcı başlatılıyor. Periyot: ${this.intervalMinutes} dk`);

        const tick = async () => {
            this.lastRun = new Date();
            this.nextRun = new Date(this.lastRun.getTime() + this.intervalMinutes * 60000);
            
            try {
                // Gün dönümü sıfırlaması
                if (this.lastRun.getHours() === 0 && this.lastRun.getMinutes() <= this.intervalMinutes) {
                    this.todayCount = 0;
                }
                
                await this.runCycle();
            } catch (err) {
                console.error("[Scheduler Error] Döngü hatası:", err);
            }
        };

        // Hemen başlat ve sonra periyodik et
        setImmediate(tick);
        this.timer = setInterval(tick, this.intervalMinutes * 60000);
    }

    public stop() {
        if (this.timer) clearInterval(this.timer);
        this.isRunning = false;
        console.log(`[Scheduler] RSS toplayıcı durduruldu.`);
    }

    private async runCycle() {
        console.log(`[Scheduler] Yeni döngü başladı. Toplam Kaynak: ${RSS_SOURCES.length}`);
        let cycleAdded = 0;

        for (const source of RSS_SOURCES) {
            // Unhealthy ise atla veya uyarı ver
            if ((this.sourceFailures[source.id] || 0) >= this.MAX_FAILURES) {
                console.warn(`[Scheduler Warn] Kaynak sağlıksız, atlanıyor: ${source.id}`);
                continue;
            }

            try {
                const feed = await this.parser.parseURL(source.url);
                this.sourceFailures[source.id] = 0; // Başarılıysa sıfırla

                if (!feed.items || feed.items.length === 0) continue;

                // Hız kazandırmak için mevcut linkleri tek seferde çekelim (N+1 engelleme)
                const candidateLinks = feed.items.filter(item => item.link).map(item => item.link!);
                const existingLinks = await prisma.haber.findMany({
                    where: { kaynakUrl: { in: candidateLinks } },
                    select: { kaynakUrl: true }
                }).then(rows => new Set(rows.map(r => r.kaynakUrl)));

                // En yeni x tane habere bak
                for (let i = 0; i < Math.min(feed.items.length, 5); i++) {
                    const item = feed.items[i];
                    if (!item.title) continue;

                    // 1. Kalite Filtresi
                    const contentFallback = item.contentSnippet || item.content || item.summary || "";
                    const quality = this.qualityFilter.validateQuality(item.title, contentFallback);
                    if (!quality.isValid) continue;

                    // 2. Duplicate Kontrolü (Redis Optimized)
                    const duplicateCheck = await this.newsService.isDuplicate(item.title);
                    if (duplicateCheck.duplicate) continue;

                    // URL kontrolü (Batch üzerinden)
                    if (item.link && existingLinks.has(item.link)) continue;

                    // 3. ML Processing (Parallel)
                    const [catRes, sentRes] = await Promise.all([
                        mlService.categorize(item.title).catch(() => null),
                        mlService.analyzeSentiment(item.title + " " + contentFallback).catch(() => null)
                    ]);

                    let finalCatId = 1; // Default
                    const ML_THRESHOLD_CONFIDENCE = 0.4;
                    
                    if (catRes && catRes.confidence > ML_THRESHOLD_CONFIDENCE) {
                        const dbCat = await prisma.kategori.findFirst({
                            where: { ad: { equals: catRes.kategori, mode: 'insensitive' }}
                        });
                        if (dbCat) finalCatId = dbCat.id;
                    } else {
                        const defaultCat = await prisma.kategori.findFirst({
                             where: { ad: { equals: source.category, mode: 'insensitive' }}
                        });
                        if (defaultCat) finalCatId = defaultCat.id;
                    }

                    // 4. DB Kayıt
                    await this.newsService.createNews({
                        baslik: item.title,
                        icerik: contentFallback,
                        metaAciklama: contentFallback.substring(0, 150) + "...",
                        kategoriId: finalCatId,
                        sentiment: sentRes ? sentRes.label : "Nötr",
                        mlConfidence: catRes ? catRes.confidence : 0,
                        gorselUrl: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167", // Default
                        kaynakUrl: item.link,
                        durum: 'ham', // LLM işlemesinden geçmesine izin vermek için n8n veya başka mekanizmayı tetikleyecekse
                                     // Fakat şu an doğrudan hazır yapılabilir. N8n'in yerine geçiyor.
                        llmProvider: "ollama"
                    });
                    
                    cycleAdded++;
                    this.todayCount++;
                }

            } catch (error: any) {
                console.error(`[Scheduler Error] Kaynak çekilemedi: ${source.id} - ${error.message}`);
                this.sourceFailures[source.id] = (this.sourceFailures[source.id] || 0) + 1;
            }
        }
        
        console.log(`[Scheduler] Döngü bitti. Bu döngüde eklenen: ${cycleAdded}. Bugün eklenen: ${this.todayCount}`);
    }
}

// Singleton export
export const rssScheduler = new RssScheduler(10); // 10 minutes default
