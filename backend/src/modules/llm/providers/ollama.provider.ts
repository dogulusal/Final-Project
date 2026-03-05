import { ILLMProvider, LLMResponse } from '../llm.interface';
import { LLM_BASE_URL, LLM_MODEL_NAME } from '../../../config/constants';

export class OllamaProvider implements ILLMProvider {
    readonly name = 'ollama';
    private baseUrl: string;
    private model: string;

    constructor() {
        this.baseUrl = LLM_BASE_URL; // varsayılan: http://localhost:11434 VEYA http://host.docker.internal:11434
        // Eğer env değişkeninde model tanımlanmamışsa, varsayılan olarak "llama3" kullanalım 
        // Daha çok Türkçe desteği olan "gemma" veya "mixtral" da olabilir. "llama3" şimdilik ideal.
        this.model = LLM_MODEL_NAME || 'llama3';
    }

    async isAvailable(): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 sn bekle

            const response = await fetch(`${this.baseUrl}/api/tags`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            return response.ok;
        } catch (error) {
            console.warn(`[Ollama] Servis ulaşılamaz durumda (${this.baseUrl}):`, error instanceof Error ? error.message : error);
            return false;
        }
    }

    estimateCost(tokenCount: number): number {
        // Ollama (lokal) LLM olduğu için maliyet $0.00
        return 0;
    }

    async generateContent(prompt: string, systemPrompt: string): Promise<LLMResponse> {
        console.log(`[Ollama] İçerik üretiliyor... (Model: ${this.model})`);
        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.model,
                    prompt: prompt,
                    system: systemPrompt,
                    stream: false, // Bekleyip toplu sonuç alma
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama API hatası: HTTP ${response.status}`);
            }

            const data: any = await response.json();

            return {
                content: data.response || '',
                tokensUsed: data.eval_count || 0, // Ollama hesaplama jargonu
                provider: this.name,
                model: this.model,
            };
        } catch (error) {
            console.error(`[Ollama Error] İçerik üretilemedi:`, error instanceof Error ? error.message : error);
            throw error;
        }
    }
}
