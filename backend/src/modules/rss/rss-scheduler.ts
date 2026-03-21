import Parser from 'rss-parser';
import { RSS_SOURCES, LLM_PIPELINE_ENABLED, LLM_DAILY_QUOTA, ML_CONFIDENCE_THRESHOLD } from '../../config/constants';
import { ContentQualityFilter } from '../news/content-quality-filter';
import { NewsService } from '../news/news.service';
import { mlService } from '../ml/ml.controller';
import { prisma } from '../../config/database';
import { ContentGenerationService } from '../llm/llm.service';
import { RawNewsInput } from '../llm/llm.interface';

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
    
    // LLM Pipeline: günlük kota takibi ve işlenen URL seti (duplicate LLM çağrısını önler)
    private llmDailyCount: number = 0;
    private llmLastResetDate: string = '';
    private llmProcessedUrls: Set<string> = new Set();
    private llmQuotaLoggedThisCycle: boolean = false;
    private llmService = new ContentGenerationService();

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

    /** Gemini 429 hataları için üstel geri çekilme (exponential backoff) ile LLM çağrısı */
    private async callLLMWithRetry(input: RawNewsInput): Promise<import('../llm/llm.interface').GeneratedNewsContent> {
        const delays = [0, 2000, 6000];
        let lastErr: any;
        for (let attempt = 0; attempt < delays.length; attempt++) {
            if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));
            try {
                return await this.llmService.generate(input);
            } catch (err: any) {
                lastErr = err;
                const is429 = err?.message?.includes('429') || err?.status === 429;
                if (!is429 || attempt === delays.length - 1) throw err;
                console.warn(`[Scheduler LLM] ⏳ 429 rate limit, ${delays[attempt + 1]}ms bekleniyor... (deneme ${attempt + 1}/${delays.length})`);
            }
        }
        throw lastErr;
    }

    private async runCycle() {
        console.log(`[Scheduler] Yeni döngü başladı. Toplam Kaynak: ${RSS_SOURCES.length}`);

        // Gün dönümünde LLM kotasını sıfırla
        const today = new Date().toDateString();
        if (this.llmLastResetDate !== today) {
            this.llmLastResetDate = today;
            this.llmDailyCount = 0;
            this.llmProcessedUrls.clear();
            if (LLM_PIPELINE_ENABLED) {
                console.log(`[Scheduler LLM] Günlük kota sıfırlandı (limit: ${LLM_DAILY_QUOTA})`);
            }
        }
        // Döngü başında kota uyarı bayrağını sıfırla (her döngüde sadece bir kez log)
        this.llmQuotaLoggedThisCycle = false;
        let cycleAdded = 0;

        // Kategori tablosunu bir kez çek — döngü içinde N+1 findFirst'i önler
        const allKategoriler = await prisma.kategori.findMany({ select: { id: true, ad: true } });
        const kategoriMap = new Map<string, number>(
            allKategoriler.map(k => [k.ad.toLowerCase(), k.id])
        );

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
                for (let i = 0; i < Math.min(feed.items.length, 15); i++) {
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

                    if (catRes && catRes.confidence > ML_CONFIDENCE_THRESHOLD) {
                        finalCatId = kategoriMap.get(catRes.kategori.toLowerCase()) ?? 1;
                    } else {
                        finalCatId = kategoriMap.get((source.category || '').toLowerCase()) ?? 1;
                    }

                    // 4. LLM Zenginleştirme (LLM_PIPELINE_ENABLED=true ile etkinleştirilir)
                    let llmBaslik = item.title;
                    let llmIcerik = contentFallback;
                    let llmMetaAciklama = contentFallback.substring(0, 150) + "...";
                    let llmSentiment = sentRes ? sentRes.label : "Nötr";
                    let newsdurum: 'ham' | 'hazir' = 'ham';
                    let llmProviderName = 'none';

                    const articleUrl = item.link || '';
                    const quotaAvailable = LLM_PIPELINE_ENABLED &&
                        this.llmDailyCount < LLM_DAILY_QUOTA &&
                        !this.llmProcessedUrls.has(articleUrl);

                    if (quotaAvailable) {
                        try {
                            const llmInput: RawNewsInput = {
                                baslik: item.title,
                                ozet: contentFallback,
                                kategori: catRes?.kategori || source.category || 'Genel',
                                kaynak_url: articleUrl
                            };
                            const llmResult = await this.callLLMWithRetry(llmInput);
                            llmBaslik = llmResult.baslik || item.title;
                            llmIcerik = llmResult.icerik || contentFallback;
                            llmMetaAciklama = llmResult.meta_aciklama || llmMetaAciklama;
                            if (llmResult.sentiment) llmSentiment = llmResult.sentiment as 'Pozitif' | 'Negatif' | 'Nötr';
                            newsdurum = 'hazir';
                            llmProviderName = 'gemini';
                            this.llmDailyCount++;
                            if (articleUrl) this.llmProcessedUrls.add(articleUrl);
                            console.log(`[Scheduler LLM] ✅ "${llmBaslik.substring(0, 50)}..." zenginleştirildi (kota: ${this.llmDailyCount}/${LLM_DAILY_QUOTA})`);
                        } catch (llmErr: any) {
                            console.warn(`[Scheduler LLM] ⚠️ LLM başarısız, ham kaydediliyor: ${llmErr.message}`);
                        }
                    } else if (LLM_PIPELINE_ENABLED && this.llmDailyCount >= LLM_DAILY_QUOTA && !this.llmQuotaLoggedThisCycle) {
                        this.llmQuotaLoggedThisCycle = true;
                        console.warn(`[Scheduler LLM] ⛔ Günlük kota doldu (${LLM_DAILY_QUOTA}). Bu döngüdeki kalan haberler ham kaydedilecek.`);
                    }

                    // 5. DB Kayıt
                    await this.newsService.createNews({
                        baslik: llmBaslik,
                        icerik: llmIcerik,
                        metaAciklama: llmMetaAciklama,
                        kategoriId: finalCatId,
                        sentiment: llmSentiment,
                        mlConfidence: catRes ? catRes.confidence : 0,
                        gorselUrl: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167",
                        kaynakUrl: item.link,
                        durum: newsdurum,
                        llmProvider: llmProviderName
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
