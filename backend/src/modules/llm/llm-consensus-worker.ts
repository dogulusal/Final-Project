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

const CATEGORY_SYSTEM_PROMPT = `Sen bir haber kategorizasyon sistemisinin. Sana bir haber başlığı ve özeti verilecek.
Sadece aşağıdaki 7 kategoriden birini döndür. Başka hiçbir şey yazma.
Geçerli kategoriler: Spor, Ekonomi, Teknoloji, Siyaset, Dünya, Sağlık, Genel

KATEGORİ TANIMLARI:
- Spor: Futbol, basketbol, tenis, olimpiyat, maç sonucu, transfer, sporcu, lig, turnuva
- Ekonomi: Borsa, faiz, enflasyon, dolar/euro, merkez bankası, şirket kazancı, ihracat, bütçe, vergi, kredi
- Teknoloji: Yapay zeka, yazılım, donanım, telefon, bilgisayar, siber güvenlik, uzay, robot, uygulama, oyun
- Siyaset: Meclis, bakan, cumhurbaşkanı, seçim, parti, kanun, yasa, hükümet kararı, anayasa
- Dünya: Yabancı ülke haberleri, savaş, uluslararası ilişkiler, NATO, BM, küresel olaylar, yabancı lider
- Sağlık: Hastalık, tedavi, aşı, hastane, doktor, ilaç, kanser, salgın, medikal araştırma
- Genel: Kaza, suç, cinayet, yangın, sel, deprem, sosyal olay, magazin, eğlence, yerel haber, insan ilgisi

SADECE BİR KELİME YAZ. Örnek: "Spor"`;

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

interface PendingArticle {
    id: number;
    baslik: string;
    metaAciklama: string | null;
    nbKategoriId: number | null;
    llmRetryCount: number;
}

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

        for (const article of articles) {
            await this._processArticle(article);
        }
    }

    protected async _processArticle(article: PendingArticle): Promise<void> {
        try {
            const { category, provider } = await this._callLLM(
                article.baslik,
                article.metaAciklama ?? article.baslik,
            );

            const llmKategori = await prisma.kategori.findFirst({ where: { ad: category } });
            if (!llmKategori) throw new Error(`Bilinmeyen LLM kategorisi: "${category}"`);

            const isConsensus = article.nbKategoriId === llmKategori.id;

            await prisma.haber.update({
                where: { id: article.id },
                data: {
                    llmKategoriId: llmKategori.id,
                    llmProvider: provider,
                    ...(isConsensus
                        ? {
                              kategoriId: llmKategori.id,
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

    protected async _callLLM(baslik: string, ozet: string): Promise<{ category: string; provider: 'gemini' | 'ollama' }> {
        const userPrompt = buildUserPrompt(baslik, ozet);
        try {
            const response = await this.geminiProvider.generateContent(userPrompt, CATEGORY_SYSTEM_PROMPT);
            return { category: this._parseCategory(response.content), provider: 'gemini' };
        } catch {
            const response = await this.ollamaProvider.generateContent(userPrompt, CATEGORY_SYSTEM_PROMPT);
            return { category: this._parseCategory(response.content), provider: 'ollama' };
        }
    }

    protected _parseCategory(raw: string): string {
        const trimmed = raw.trim().replace(/^["']|["']$/g, '');
        const found = (VALID_LLM_CATEGORIES as readonly string[]).find(
            cat => cat.localeCompare(trimmed, 'tr', { sensitivity: 'base' }) === 0,
        );
        if (!found) throw new Error(`Geçersiz LLM kategori yanıtı: "${trimmed}"`);
        return found;
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
