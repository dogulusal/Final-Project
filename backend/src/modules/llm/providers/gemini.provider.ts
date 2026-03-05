import { ILLMProvider, LLMResponse } from '../llm.interface';
import { LLM_API_KEY, LLM_MODEL_NAME } from '../../../config/constants';

export class GeminiProvider implements ILLMProvider {
    name = 'Gemini (Google)';
    private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

    constructor() {
        if (!LLM_API_KEY) {
            console.warn('[Gemini] LLM_API_KEY (Gemini API Key) bulunamadı!');
        }
    }

    async isAvailable(): Promise<boolean> {
        if (!LLM_API_KEY) return false;
        return true;
    }

    estimateCost(tokenCount: number): number {
        // Gemini API'nin ücretsiz versiyonunda maliyet yoktur, ücretli versiyon için hesaplama buraya eklenebilir.
        // Şimdilik 0.0 dönüyoruz
        return 0.0;
    }

    async generateContent(userPrompt: string, systemPrompt?: string): Promise<LLMResponse> {
        if (!LLM_API_KEY) {
            throw new Error('Gemini API anahtarı eksik!');
        }

        const modelName = LLM_MODEL_NAME || 'gemini-1.5-flash';
        const url = `${this.baseUrl}/${modelName}:generateContent?key=${LLM_API_KEY}`;

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

            let tokensUsed = 0;
            if (data.usageMetadata) {
                tokensUsed = data.usageMetadata.totalTokenCount || 0;
            } else {
                tokensUsed = Math.ceil(textResponse.split(' ').length * 1.5);
            }

            return {
                content: textResponse,
                tokensUsed: tokensUsed,
                provider: 'Gemini',
                model: modelName
            };

        } catch (error) {
            console.error('[Gemini] İstek atılırken kritik hata:', error);
            throw error;
        }
    }
}
