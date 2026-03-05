import { ILLMProvider, LLMResponse } from '../llm.interface';
import { LLM_API_KEY, LLM_MODEL_NAME } from '../../../config/constants';

export class OpenAiProvider implements ILLMProvider {
    readonly name = 'openai';
    private apiKey: string;
    private model: string;

    constructor() {
        this.apiKey = LLM_API_KEY;
        this.model = LLM_MODEL_NAME || 'gpt-3.5-turbo';
    }

    async isAvailable(): Promise<boolean> {
        return !!this.apiKey;
    }

    estimateCost(tokenCount: number): number {
        // GPT-3.5 varsayımı: ~ $0.0015 / 1K token
        return (tokenCount / 1000) * 0.0015;
    }

    async generateContent(prompt: string, systemPrompt: string): Promise<LLMResponse> {
        console.log(`[OpenAI] İçerik üretiliyor... (Model: ${this.model})`);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const errorData: any = await response.json().catch(() => ({}));
            throw new Error(`OpenAI API Hatası: HTTP ${response.status} - ${errorData?.error?.message || 'Bilinmeyen hata'}`);
        }

        const data: any = await response.json();

        return {
            content: data.choices[0]?.message?.content || '',
            tokensUsed: data.usage?.total_tokens || 0,
            provider: this.name,
            model: this.model,
        };
    }
}
