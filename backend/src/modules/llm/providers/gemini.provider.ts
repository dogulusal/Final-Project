import { ILLMProvider, LLMResponse } from '../llm.interface';
import { LLM_API_KEY, LLM_API_KEYS, LLM_MODEL_NAME } from '../../../config/constants';
import { llmUsageService } from '../llm-usage';

export class GeminiProvider implements ILLMProvider {
    name = 'Gemini (Google)';
    private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    private keyIndex = 0;

    constructor() {
        if (LLM_API_KEYS.length === 0) {
            console.warn('[Gemini] LLM_API_KEY (Gemini API Key) bulunamadı!');
        } else if (LLM_API_KEYS.length > 1) {
            console.log(`[Gemini] ${LLM_API_KEYS.length} API key yüklendi, round-robin rotasyon aktif.`);
        }
    }

    private nextKey(): string {
        const key = LLM_API_KEYS[this.keyIndex % LLM_API_KEYS.length];
        this.keyIndex++;
        return key;
    }

    async isAvailable(): Promise<boolean> {
        if (LLM_API_KEYS.length === 0) return false;
        return true;
    }

    estimateCost(tokenCount: number): number {
        // Gemini API'nin ücretsiz versiyonunda maliyet yoktur, ücretli versiyon için hesaplama buraya eklenebilir.
        // Şimdilik 0.0 dönüyoruz
        return 0.0;
    }

    async generateContent(userPrompt: string, systemPrompt?: string): Promise<LLMResponse> {
        if (LLM_API_KEYS.length === 0) {
            throw new Error('Gemini API anahtarı eksik!');
        }

        const apiKey = this.nextKey();
        const modelName = LLM_MODEL_NAME || 'gemini-1.5-flash';
        const url = `${this.baseUrl}/${modelName}:generateContent?key=${apiKey}`;

        const combinedPrompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;

        const body = {
            contents: [{
                parts: [{ text: combinedPrompt }]
            }],
            generationConfig: {
                temperature: 0.7,
                responseMimeType: "application/json"
            }
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Gemini API Hatası: ${response.status} ${response.statusText} - ${errorData}`);
            }

            const data = await response.json() as any;

            if (!data.candidates || data.candidates.length === 0) {
                throw new Error('Gemini yanıt vermedi veya içerik boş.');
            }

            const textResponse = data.candidates[0].content.parts[0].text;

            // Extract token usage from API response
            let inputTokens = 0;
            let outputTokens = 0;
            
            if (data.usageMetadata) {
                inputTokens = data.usageMetadata.promptTokenCount || 0;
                outputTokens = data.usageMetadata.candidatesTokenCount || 0;
            } else {
                // Fallback estimate if metadata not available
                inputTokens = Math.ceil(combinedPrompt.split(' ').length * 1.3);
                outputTokens = Math.ceil(textResponse.split(' ').length * 1.5);
            }

            const tokensUsed = inputTokens + outputTokens;

            // Log usage for billing tracking
            await llmUsageService.logUsage({
                saglayici: 'gemini',
                girisTokenSayisi: inputTokens,
                cikisTokenSayisi: outputTokens,
                durum: 'basarili'
            });

            return {
                content: textResponse,
                tokensUsed: tokensUsed,
                provider: 'Gemini',
                model: modelName
            };

        } catch (error) {
            // Log error usage
            await llmUsageService.logUsage({
                saglayici: 'gemini',
                girisTokenSayisi: 0,
                cikisTokenSayisi: 0,
                durum: 'hata',
                hataMesaji: error instanceof Error ? error.message : String(error)
            }).catch(err => console.error('[Gemini] Usage logging failed:', err));
            
            console.error('[Gemini] İstek atılırken kritik hata:', error);
            throw error;
        }
    }
}
