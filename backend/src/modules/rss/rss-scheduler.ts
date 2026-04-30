import { RSS_SOURCES, LLM_PIPELINE_ENABLED, LLM_DAILY_QUOTA, ML_CONFIDENCE_THRESHOLD, LLM_CONSENSUS_ENABLED } from '../../config/constants';
import { ContentQualityFilter } from '../news/content-quality-filter';
import { NewsService } from '../news/news.service';
import { mlService } from '../ml/ml.controller';
import { prisma } from '../../config/database';
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
    // Not: Consensus worker aktifken bu alanlar kullanılmaz; LLM_PIPELINE_ENABLED eski inline mod için korunur.
    private llmDailyCount: number = 0;
    private llmLastResetDate: string = '';
    private llmProcessedUrls: Set<string> = new Set();
    private llmQuotaLoggedThisCycle: boolean = false;
    // llmService kaldırıldı — inline LLM devreden çıkarıldı; consensus worker tarafından yönetilir

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

                        // 0. Köşe yazısı filtresi — opinion columns are not news
                        if (safeLink && /\/(yazarlar|yazar)\//i.test(safeLink)) {
                            continue;
                        }

                        // 1. Kalite Filtresi
                        const contentFallback = this.normalizeText(item.contentSnippet);
                        const quality = this.qualityFilter.validateQuality(safeTitle, contentFallback);
                        if (!quality.isValid) continue;

                        // 2. Duplicate Kontrolü (Redis Optimized)
                        const duplicateCheck = await this.newsService.isDuplicate(safeTitle);
                        if (duplicateCheck.duplicate) continue;

                        // URL kontrolü (Batch üzerinden)
                        if (safeLink && existingLinks.has(safeLink)) continue;

                        // 3. ML Processing (Parallel) — Combined NB+LR ensemble + sentiment
                        const combinedText = `${safeTitle} ${contentFallback}`.trim();
                        const [catRes, sentRes] = await Promise.all([
                            mlService.predictCombinedCategory(combinedText).catch(() => null),
                            mlService.analyzeSentiment(safeTitle + " " + contentFallback).catch(() => null)
                        ]);

                        const genelCatId = kategoriMap.get('genel') ?? 1;
                        const sourceCatId = this.resolveCategoryId(source.category, kategoriMap) ?? genelCatId;

                        // 3-Tier karar ağacı (combined confidence'a göre)
                        const COMBINED_HIGH = parseFloat(process.env.COMBINED_HIGH_THRESHOLD || '0.80');
                        const COMBINED_LOW = parseFloat(process.env.COMBINED_LOW_THRESHOLD || '0.55');

                        const mlCatId = catRes
                            ? (this.resolveCategoryId(catRes.kategori, kategoriMap) ?? null)
                            : null;
                        let finalCatId = mlCatId ?? sourceCatId;

                        // Tier kararı: HIGH → direkt yayınla, MID → LLM consensus, LOW → inceleme
                        let durum: 'ham' | 'hazir' | 'yayinda' | 'inceleme';
                        let llmProviderValue: string;
                        let kategoriDogrulandi: boolean;

                        if (catRes && catRes.confidence >= COMBINED_HIGH) {
                            // HIGH: Direkt yayınla — %92.6 doğruluk
                            durum = 'hazir';
                            llmProviderValue = 'combined-high';
                            kategoriDogrulandi = true;
                        } else if (catRes && catRes.confidence >= COMBINED_LOW) {
                            // MID: LLM consensus gerekli
                            durum = 'ham';
                            llmProviderValue = LLM_CONSENSUS_ENABLED ? 'pending' : 'none';
                            kategoriDogrulandi = false;
                        } else {
                            // LOW: İnceleme kuyruğu (conf < 0.55 veya ML başarısız)
                            durum = 'inceleme';
                            llmProviderValue = 'low-confidence';
                            kategoriDogrulandi = false;
                            finalCatId = mlCatId ?? sourceCatId; // En iyi tahmin ama onaylanmamış
                        }

                        // 4. DB Kayıt
                        await this.newsService.createNews({
                            baslik: safeTitle,
                            icerik: contentFallback,
                            metaAciklama: contentFallback.substring(0, 150) + "...",
                            kategoriId: finalCatId,          // Combined tahmin (provisional)
                            nbKategoriId: finalCatId,        // Combined tahmin (frozen)
                            llmKategoriId: null,             // Worker dolduracak (MID tier)
                            sentiment: sentRes ? sentRes.label : 'Nötr',
                            mlConfidence: catRes ? catRes.confidence : undefined,
                            gorselUrl: item.imageUrl || undefined,
                            kaynakUrl: safeLink,
                            durum,
                            llmProvider: llmProviderValue,
                            kategoriDogrulandi,
                            augmentedAt: undefined
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
