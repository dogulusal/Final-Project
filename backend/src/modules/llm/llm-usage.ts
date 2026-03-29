import { prisma } from '../../config/database';

/**
 * LLM Usage Tracking Service
 * Logs token consumption for billing and analytics
 */

export interface LLMUsageLogInput {
    saglayici: string; // gemini, anthropic, etc
    girisTokenSayisi: number;
    cikisTokenSayisi: number;
    tahminiMaliyet?: number; // USD
    durum?: 'basarili' | 'hata' | 'zaman_asimi';
    hataMesaji?: string;
}

export interface LLMCostEstimate {
    saglayici: string;
    modelName?: string;
    girisTokenPrice: number; // USD per 1M tokens
    cikisTokenPrice: number; // USD per 1M tokens
}

/**
 * Pricing: As of 2026-03-28
 * Gemini: 0.075/1M input, 0.30/1M output (Flash 2.5)
 * Cost = (input_tokens * 0.075 + output_tokens * 0.30) / 1,000,000
 */
const PRICING_TABLE: { [key: string]: LLMCostEstimate } = {
    gemini: {
        saglayici: 'gemini',
        modelName: 'gemini-2.5-flash',
        girisTokenPrice: 0.075,
        cikisTokenPrice: 0.30
    },
    ollama: {
        saglayici: 'ollama',
        modelName: 'qwen3:8b',
        girisTokenPrice: 0, // Free (local)
        cikisTokenPrice: 0
    }
};

class LLMUsageService {
    /**
     * Calculate estimated cost in USD
     */
    static calculateCost(provider: string, inputTokens: number, outputTokens: number): number {
        const pricing = PRICING_TABLE[provider.toLowerCase()];
        if (!pricing) {
            console.warn(`[LLM Usage] Unknown provider for pricing: ${provider}`);
            return 0;
        }

        const inputCost = (inputTokens * pricing.girisTokenPrice) / 1_000_000;
        const outputCost = (outputTokens * pricing.cikisTokenPrice) / 1_000_000;
        return inputCost + outputCost;
    }

    /**
     * Log LLM usage to database
     */
    static async logUsage(input: LLMUsageLogInput): Promise<void> {
        try {
            // Calculate cost if not provided
            const tahminiMaliyet = input.tahminiMaliyet ?? this.calculateCost(
                input.saglayici,
                input.girisTokenSayisi,
                input.cikisTokenSayisi
            );

            const totalTokens = input.girisTokenSayisi + input.cikisTokenSayisi;

            await prisma.llmKullanim.create({
                data: {
                    saglayici: input.saglayici.toLowerCase(),
                    girisTokenSayisi: input.girisTokenSayisi,
                    cikisTokenSayisi: input.cikisTokenSayisi,
                    tahminiMaliyet,
                    durum: input.durum || 'basarili',
                    hataMesaji: input.hataMesaji
                }
            });

            console.log(
                `[LLM Usage] ${input.saglayici.toUpperCase()}: ` +
                `input=${input.girisTokenSayisi} output=${input.cikisTokenSayisi} ` +
                `total=${totalTokens} cost=$${tahminiMaliyet.toFixed(6)}`
            );
        } catch (error) {
            console.error('[LLM Usage] Veritabanı yazma hatası:', error);
            // Don't throw - don't interrupt the actual LLM call
        }
    }

    /**
     * Get usage statistics for admin dashboard
     */
    static async getStats(days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const usageByProvider = await prisma.llmKullanim.groupBy({
            by: ['saglayici'],
            where: {
                tarih: { gte: startDate }
            },
            _sum: {
                girisTokenSayisi: true,
                cikisTokenSayisi: true,
                tahminiMaliyet: true
            },
            _count: {
                id: true
            }
        });

        const dailyUsage = await prisma.llmKullanim.groupBy({
            by: ['tarih', 'saglayici'],
            where: {
                tarih: { gte: startDate }
            },
            _sum: {
                girisTokenSayisi: true,
                cikisTokenSayisi: true,
                tahminiMaliyet: true
            },
            orderBy: {
                tarih: 'desc'
            }
        });

        const errorStats = await prisma.llmKullanim.groupBy({
            by: ['durum'],
            where: {
                tarih: { gte: startDate }
            },
            _count: {
                id: true
            }
        });

        const totalCost = await prisma.llmKullanim.aggregate({
            where: {
                tarih: { gte: startDate }
            },
            _sum: {
                tahminiMaliyet: true
            }
        });

        return {
            period: {
                days,
                startDate: startDate.toISOString(),
                endDate: new Date().toISOString()
            },
            byProvider: usageByProvider.map(p => ({
                provider: p.saglayici,
                callCount: p._count.id,
                totalInputTokens: p._sum.girisTokenSayisi || 0,
                totalOutputTokens: p._sum.cikisTokenSayisi || 0,
                estimatedCost: p._sum.tahminiMaliyet || 0
            })),
            dailyUsage,
            errorStats,
            totalCost: totalCost._sum.tahminiMaliyet || 0
        };
    }

    /**
     * Get cost estimate for a single call
     */
    static getPricing(provider: string) {
        return PRICING_TABLE[provider.toLowerCase()] || null;
    }
}

export const llmUsageService = LLMUsageService;
