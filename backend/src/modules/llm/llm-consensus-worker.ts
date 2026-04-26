import { prisma } from '../../config/database';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { ILLMProvider } from './llm.interface';
import {
    LLM_CONSENSUS_ENABLED,
    LLM_CONSENSUS_BATCH_SIZE,
    LLM_CONSENSUS_INTERVAL_MS,
    LLM_CONSENSUS_MAX_RETRIES,
} from '../../config/constants';

export const VALID_LLM_CATEGORIES = [
    'Spor', 'Ekonomi', 'Teknoloji', 'Siyaset', 'Dünya', 'Sağlık', 'Genel'
] as const;

export type LLMCategory = typeof VALID_LLM_CATEGORIES[number];

const CATEGORY_SYSTEM_PROMPT = `Sen deneyimli bir Turkce haber editorusun ve makine ogrenmesi dogrulayicisisin.
Sana bir haber basligi (ve varsa ozeti) verilecek. Haberi degerlendire ve su 7 kategoriden BIRINE ata:

Gecerli kategoriler: Spor, Ekonomi, Teknoloji, Siyaset, Dunya, Saglik, Genel

KATEGORİ TANIMLARI:
- Spor: Futbol, basketbol, tenis, olimpiyat, maç sonucu, transfer, sporcu, lig, turnuva
- Ekonomi: Borsa, faiz, enflasyon, dolar/euro, merkez bankası, şirket kazancı, ihracat, bütçe, vergi, kredi
- Teknoloji: Yapay zeka, yazılım, donanım, telefon, bilgisayar, siber güvenlik, uzay, robot, uygulama, oyun
- Siyaset: Meclis, bakan, cumhurbaşkanı, seçim, parti, kanun, yasa, hükümet kararı, anayasa
- Dünya: Yabancı ülke haberleri, savaş, uluslararası ilişkiler, NATO, BM, küresel olaylar, yabancı lider
- Sağlık: Hastalık, tedavi, aşı, hastane, doktor, ilaç, kanser, salgın, medikal araştırma
- Genel: Kaza, suç, cinayet, yangın, sel, deprem, sosyal olay, magazin, eğlence, yerel haber, insan ilgisi

YANIT FORMATI (sadece gecerli JSON dondur, baska hicbir sey yazma):
{"kategori": "KategoriAdi", "guven": 0.95}

guven: 0.0 (cok belirsiz) ile 1.0 (tamamen emin) arasinda ondalik sayi.`;

function buildUserPrompt(baslik: string, ozet: string): string {
    return `HABERİ KATEGORİZE ET:\nBaşlık: ${baslik}\nÖzet: ${ozet}`;
}

export interface WorkerStats {
    isRunning: boolean;
    isProcessing: boolean;
    processedCount: number;
    consensusCount: number;
    conflictCount: number;
    failedCount: number;
}

class InvalidLLMCategoryError extends Error {
    constructor(rawCategory: string) {
        super(`Geçersiz LLM kategori yanıtı: "${rawCategory}"`);
        this.name = 'InvalidLLMCategoryError';
    }
}

interface PendingArticle {
    id: number;
    baslik: string;
    metaAciklama: string | null;
    nbKategoriId: number | null;
    llmRetryCount: number;
}

type KategoriMap = Map<string, number>;

export class LlmConsensusWorker {
    private isProcessing = false;
    private timer: NodeJS.Timeout | null = null;
    private isRunning = false;
    private geminiProvider: ILLMProvider;
    private ollamaProvider: ILLMProvider;

    private processedCount = 0;
    private consensusCount = 0;
    private conflictCount = 0;
    private failedCount = 0;

    constructor(gemini?: ILLMProvider, ollama?: ILLMProvider) {
        this.geminiProvider = gemini ?? new GeminiProvider();
        this.ollamaProvider = ollama ?? new OllamaProvider(true);
    }

    start(): void {
        if (!LLM_CONSENSUS_ENABLED || this.isRunning) return;
        this.isRunning = true;
        this.timer = setInterval(() => this.processNextBatch(), LLM_CONSENSUS_INTERVAL_MS);
        console.log(`[LLM Consensus] Worker başlatıldı (interval: ${LLM_CONSENSUS_INTERVAL_MS}ms, batch: ${LLM_CONSENSUS_BATCH_SIZE})`);
    }

    stop(): void {
        if (this.timer) clearInterval(this.timer);
        this.isRunning = false;
        console.log('[LLM Consensus] Worker durduruldu.');
    }

    async processNextBatch(): Promise<void> {
        if (this.isProcessing) return;
        this.isProcessing = true;
        try {
            await this._processBatch();
        } finally {
            this.isProcessing = false;
        }
    }

    protected async _processBatch(): Promise<void> {
        const articles = await prisma.haber.findMany({
            where: { llmProvider: 'pending' },
            take: LLM_CONSENSUS_BATCH_SIZE,
            orderBy: { id: 'asc' },
            select: {
                id: true,
                baslik: true,
                metaAciklama: true,
                nbKategoriId: true,
                llmRetryCount: true,
            },
        });

        const allKategoriler = await prisma.kategori.findMany({
            select: { id: true, ad: true },
        });
        const kategoriMap: KategoriMap = new Map(
            allKategoriler.map((kategori) => [kategori.ad.toLowerCase(), kategori.id]),
        );

        for (const article of articles) {
            await this._processArticle(article, kategoriMap);
        }
    }

    protected async _processArticle(article: PendingArticle, kategoriMap: KategoriMap): Promise<void> {
        try {
            const { category, provider, confidence } = await this._callLLM(
                article.baslik,
                article.metaAciklama ?? article.baslik,
            );

            const llmKategoriId = kategoriMap.get(category.toLowerCase());
            if (!llmKategoriId) throw new Error(`Bilinmeyen LLM kategorisi: "${category}"`);

            // LLM güven threshold: düşük güvenli LLM tahminleri dispute'a yönlendir
            const LLM_GUVEN_THRESHOLD = parseFloat(process.env.LLM_GUVEN_THRESHOLD || '0.50');
            const llmConfident = (confidence ?? 0) >= LLM_GUVEN_THRESHOLD;
            const isConsensus = llmConfident && article.nbKategoriId === llmKategoriId;

            // Store in dispute_queue as well for admin view
            const llmGuvenSkoru = confidence ?? null;
            
            // Create or update dispute_queue entry if mismatch
            if (!isConsensus) {
                await prisma.disputeQueue.upsert({
                    where: { haberId: article.id },
                    create: {
                        haberId: article.id,
                        nbKategoriId: article.nbKategoriId ?? null,
                        llmKategoriId,
                        nbGuvenSkoru: null,
                        llmGuvenSkoru,
                        batchNumber: 0,
                        durum: 'bekliyor',
                    },
                    update: {
                        llmKategoriId,
                        llmGuvenSkoru,
                        durum: 'bekliyor',
                        adminKararKategoriId: null,
                        resolvedAt: null,
                        resolvedBy: null,
                    },
                });
            }

            await prisma.haber.update({
                where: { id: article.id },
                data: {
                    llmKategoriId,
                    llmProvider: provider,
                    ...(isConsensus
                        ? {
                              kategoriId: llmKategoriId,
                              durum: 'hazir',
                              kategoriDogrulandi: true,
                          }
                        : {
                              kategoriDogrulandi: false,
                          }),
                },
            });

            this.processedCount++;
            if (isConsensus) this.consensusCount++;
            else this.conflictCount++;

            console.log(`[LLM Consensus] id=${article.id} → ${category} (${isConsensus ? 'konsensüs ✓' : 'çakışma ↔'})`);
        } catch (err) {
            if (err instanceof InvalidLLMCategoryError) {
                await prisma.haber.update({
                    where: { id: article.id },
                    data: {
                        llmKategoriId: null,
                        kategoriId: article.nbKategoriId ?? undefined,
                        durum: 'hazir',
                        kategoriDogrulandi: true,
                        llmProvider: 'none',
                    },
                });
                this.processedCount++;
                console.warn(`[LLM Consensus] Geçersiz kategori çıktısı id=${article.id}; NB final korundu: ${err.message}`);
                return;
            }

            const newRetryCount = article.llmRetryCount + 1;
            const isDead = newRetryCount >= LLM_CONSENSUS_MAX_RETRIES;
            await prisma.haber.update({
                where: { id: article.id },
                data: {
                    llmRetryCount: newRetryCount,
                    llmProvider: isDead ? 'dead' : 'failed',
                },
            });
            this.failedCount++;
            console.error(`[LLM Consensus] Hata id=${article.id} (retry=${newRetryCount}${isDead ? ', dead' : ''}): ${err instanceof Error ? err.message : err}`);
        }
    }

    protected async _callLLM(baslik: string, ozet: string): Promise<{ category: string; provider: 'gemini' | 'ollama'; confidence?: number }> {
        const userPrompt = buildUserPrompt(baslik, ozet);
        try {
            const response = await this.geminiProvider.generateContent(userPrompt, CATEGORY_SYSTEM_PROMPT);
            const { category, confidence } = this._parseJsonResponse(response.content);
            return { 
                category, 
                provider: 'gemini',
                confidence
            };
        } catch {
            const response = await this.ollamaProvider.generateContent(userPrompt, CATEGORY_SYSTEM_PROMPT);
            const { category, confidence } = this._parseJsonResponse(response.content);
            return { 
                category, 
                provider: 'ollama',
                confidence
            };
        }
    }

    protected _parseJsonResponse(raw: string): { category: string; confidence?: number } {
        try {
            const cleaned = raw.trim()
                .replace(/^```json?\s*/i, '')
                .replace(/\s*```$/, '')
                .trim();
            const parsed = JSON.parse(cleaned);
            
            if (typeof parsed.kategori === 'string' && typeof parsed.guven === 'number') {
                const category = this._validateCategory(parsed.kategori);
                const confidence = Math.min(1, Math.max(0, parsed.guven));
                return { category, confidence };
            }
            throw new Error('Yanıt JSON formatında ama kategori veya guven alanı eksik');
        } catch (err) {
            // Fallback: eski format (sadece kategori adı)
            try {
                const category = this._validateCategory(raw);
                return { category };
            } catch {
                throw new InvalidLLMCategoryError(raw);
            }
        }
    }

    protected _validateCategory(raw: string): string {
        const trimmed = raw.trim().replace(/^["']|["']$/g, '');
        const found = (VALID_LLM_CATEGORIES as readonly string[]).find(
            cat => cat.localeCompare(trimmed, 'tr', { sensitivity: 'base' }) === 0,
        );
        if (!found) throw new InvalidLLMCategoryError(trimmed);
        return found;
    }

    protected _parseCategory(raw: string): string {
        return this._validateCategory(raw);
    }

    getStatus(): WorkerStats {
        return {
            isRunning: this.isRunning,
            isProcessing: this.isProcessing,
            processedCount: this.processedCount,
            consensusCount: this.consensusCount,
            conflictCount: this.conflictCount,
            failedCount: this.failedCount,
        };
    }
}
