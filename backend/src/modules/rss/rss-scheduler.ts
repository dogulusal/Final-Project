import { RSS_SOURCES, LLM_PIPELINE_ENABLED, LLM_DAILY_QUOTA, ML_CONFIDENCE_THRESHOLD } from '../../config/constants';
import { ContentQualityFilter } from '../news/content-quality-filter';
import { NewsService } from '../news/news.service';
import { mlService } from '../ml/ml.controller';
import { prisma } from '../../config/database';
import { ContentGenerationService } from '../llm/llm.service';
import { RawNewsInput } from '../llm/llm.interface';
import { RssParserService } from './rss.service';

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
    private rssParserService = new RssParserService();
    private qualityFilter = new ContentQualityFilter();
    private newsService = new NewsService();

    private getValueType(value: unknown): string {
        if (Array.isArray(value)) return 'array';
        if (value === null) return 'null';
        return typeof value;
    }

    private getValueSample(value: unknown): string {
        if (typeof value === 'string') {
            return value.substring(0, 50);
        }

        try {
            return JSON.stringify(value).substring(0, 50);
        } catch {
            return String(value).substring(0, 50);
        }
    }

    private logParserFieldType(sourceId: string, fieldName: string, value: unknown): void {
        if (typeof value === 'string') return;

        console.error(
            `[Parser Error] source: ${sourceId} | field: ${fieldName} | actual_type: ${this.getValueType(value)} | value_sample: ${this.getValueSample(value)}`
        );
    }

    private normalizeCategoryKey(value: string): string {
        return value
            .toLowerCase()
            .trim()
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ı/g, 'i')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c');
    }

    private resolveCategoryId(categoryText: string, kategoriMap: Map<string, number>): number | null {
        const normalizedInput = this.normalizeCategoryKey(categoryText);
        if (!normalizedInput) return null;

        const aliases: Record<string, string> = {
            gundem: 'genel',
            yasam: 'genel',
            magazin: 'genel',
            politika: 'siyaset',
            dunya: 'dunya',
            spor: 'spor',
            ekonomi: 'ekonomi',
            saglik: 'saglik',
            teknoloji: 'teknoloji',
            genel: 'genel'
        };

        for (const [name, id] of kategoriMap.entries()) {
            const normalizedName = this.normalizeCategoryKey(name);
            if (normalizedName === normalizedInput) {
                return id;
            }
        }

        const aliasTarget = aliases[normalizedInput];
        if (!aliasTarget) return null;

        for (const [name, id] of kategoriMap.entries()) {
            if (this.normalizeCategoryKey(name) === aliasTarget) {
                return id;
            }
        }

        return null;
    }

    private normalizeText(value: unknown): string {
        if (typeof value === 'string') {
            return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }

        if (Array.isArray(value)) {
            return value.map((item) => this.normalizeText(item)).filter(Boolean).join(' ').trim();
        }

        if (value && typeof value === 'object') {
            const record = value as Record<string, unknown>;
            const preferred = record['#text'] ?? record._ ?? record.value ?? record.content;
            if (preferred !== undefined) {
                return this.normalizeText(preferred);
            }

            try {
                return JSON.stringify(record);
            } catch {
                return '';
            }
        }

        return '';
    }

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
                const feedItems = await this.rssParserService.fetchFeed(source);
                this.sourceFailures[source.id] = 0; // Başarılıysa sıfırla

                if (!feedItems || feedItems.length === 0) continue;

                // Hız kazandırmak için mevcut linkleri tek seferde çekelim (N+1 engelleme)
                const candidateLinks = feedItems
                    .map((item) => this.normalizeText(item.link))
                    .filter((link) => !!link);
                const existingLinks = await prisma.haber.findMany({
                    where: { kaynakUrl: { in: candidateLinks } },
                    select: { kaynakUrl: true }
                }).then(rows => new Set(rows.map(r => r.kaynakUrl)));

                // En yeni x tane habere bak
                for (let i = 0; i < Math.min(feedItems.length, 15); i++) {
                    try {
                        const item = feedItems[i];
                        this.logParserFieldType(source.id, 'title', item.title);
                        this.logParserFieldType(source.id, 'link', item.link);
                        this.logParserFieldType(source.id, 'contentSnippet', item.contentSnippet);

                        const safeTitle = this.normalizeText(item.title);
                        if (!safeTitle) continue;

                        const safeLink = this.normalizeText(item.link);

                        // 1. Kalite Filtresi
                        const contentFallback = this.normalizeText(item.contentSnippet);
                        const quality = this.qualityFilter.validateQuality(safeTitle, contentFallback);
                        if (!quality.isValid) continue;

                        // 2. Duplicate Kontrolü (Redis Optimized)
                        const duplicateCheck = await this.newsService.isDuplicate(safeTitle);
                        if (duplicateCheck.duplicate) continue;

                        // URL kontrolü (Batch üzerinden)
                        if (safeLink && existingLinks.has(safeLink)) continue;

                        // 3. ML Processing (Parallel) — başlık + özet ile daha güçlü kategorizasyon
                        const [catRes, sentRes] = await Promise.all([
                            mlService.categorize(safeTitle, contentFallback).catch(() => null),
                            mlService.analyzeSentiment(safeTitle + " " + contentFallback).catch(() => null)
                        ]);

                        const genelCatId = kategoriMap.get('genel') ?? 1;
                        const sourceCatId = this.resolveCategoryId(source.category, kategoriMap) ?? genelCatId;
                        const mlStrong = !!(catRes && catRes.confidence >= ML_CONFIDENCE_THRESHOLD);
                        const mlCatId = mlStrong
                            ? (this.resolveCategoryId(catRes!.kategori, kategoriMap) ?? null)
                            : null;
                        let finalCatId = sourceCatId;

                        // ML sadece çok güvenli olduğunda ya da kaynak kategorisiyle aynıysa override etsin.
                        if (mlStrong && mlCatId && (mlCatId === sourceCatId || catRes!.confidence >= 0.93)) {
                            finalCatId = mlCatId;
                        }

                        // 4. LLM Zenginleştirme (LLM_PIPELINE_ENABLED=true ile etkinleştirilir)
                        let llmBaslik = safeTitle;
                        let llmIcerik = contentFallback;
                        let llmMetaAciklama = contentFallback.substring(0, 150) + "...";
                        let llmSentiment = sentRes ? sentRes.label : "Nötr";
                        let newsdurum: 'ham' | 'hazir' = 'ham';
                        let llmProviderName = 'none';
                        let llmSucceeded = false;
                        let kategoriDogrulandi = false;

                        const articleUrl = safeLink || '';
                        const quotaAvailable = LLM_PIPELINE_ENABLED &&
                            this.llmDailyCount < LLM_DAILY_QUOTA &&
                            !this.llmProcessedUrls.has(articleUrl);

                        if (quotaAvailable) {
                            try {
                                const llmInput: RawNewsInput = {
                                    baslik: safeTitle,
                                    ozet: contentFallback,
                                    kategori: catRes?.kategori || source.category || 'Genel',
                                    kaynak_url: articleUrl
                                };
                                const llmResult = await this.callLLMWithRetry(llmInput);
                                llmBaslik = this.normalizeText(llmResult.baslik) || safeTitle;
                                llmIcerik = this.normalizeText(llmResult.icerik) || contentFallback;
                                llmMetaAciklama = this.normalizeText(llmResult.meta_aciklama) || llmMetaAciklama;

                                const normalizedSentiment = this.normalizeText(llmResult.sentiment);
                                if (normalizedSentiment === 'Pozitif' || normalizedSentiment === 'Negatif' || normalizedSentiment === 'Nötr') {
                                    llmSentiment = normalizedSentiment;
                                }

                                const normalizedKategori = this.normalizeText(llmResult.kategori);
                                if (normalizedKategori) {
                                    const llmCatId = this.resolveCategoryId(normalizedKategori, kategoriMap);
                                    if (llmCatId) {
                                        finalCatId = llmCatId;
                                    } else {
                                        console.warn(`[Scheduler LLM] Geçersiz kategori (${normalizedKategori}) source=${source.id}. Kaynak kategorisi korunuyor.`);
                                    }
                                }
                                llmSucceeded = true;
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

                        // LLM başarılıysa hazır kabul et. LLM yoksa sadece güçlü ML tahmini olanları hazıra al.
                        if (llmSucceeded || mlStrong) {
                            newsdurum = 'hazir';
                        }

                        // Kategori doğrulaması: LLM geçerli kategori üretmişse veya güçlü ML + kaynak uyumu varsa true.
                        if (
                            (llmSucceeded && finalCatId !== sourceCatId) ||
                            (mlStrong && mlCatId && mlCatId === finalCatId && mlCatId === sourceCatId)
                        ) {
                            kategoriDogrulandi = true;
                        }

                        // 5. DB Kayıt
                        await this.newsService.createNews({
                            baslik: llmBaslik,
                            icerik: llmIcerik,
                            metaAciklama: llmMetaAciklama,
                            kategoriId: finalCatId,
                            sentiment: llmSentiment,
                            mlConfidence: catRes ? catRes.confidence : undefined,
                            gorselUrl: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167",
                            kaynakUrl: safeLink,
                            durum: newsdurum,
                            llmProvider: llmProviderName,
                            kategoriDogrulandi,
                            augmentedAt: llmSucceeded ? new Date() : undefined
                        });

                        cycleAdded++;
                        this.todayCount++;
                    } catch (itemError: any) {
                        console.warn(`[Scheduler Warn] Haber atlandı (${source.id}): ${itemError?.message || itemError}`);
                        continue;
                    }
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
