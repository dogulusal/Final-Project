/**
 * LLM Provider Interface — Sağlayıcıdan bağımsız
 * OpenAI, Gemini, Anthropic, Ollama arasında .env ile geçiş yapılabilir
 */

export interface LLMResponse {
    content: string;
    tokensUsed: number;
    provider: string;
    model: string;
}

export interface ILLMProvider {
    readonly name: string;
    generateContent(prompt: string, systemPrompt: string): Promise<LLMResponse>;
    isAvailable(): Promise<boolean>;
    estimateCost(tokenCount: number): number;
}

export interface GeneratedNewsContent {
    baslik: string;
    meta_aciklama: string; // "Neden Önemli?" alanı için de kullanılabilir
    icerik: string;
    etiketler: string[];
    sentiment?: string;    // "Pozitif" | "Negatif" | "Nötr"
    confidence?: number;   // 0.0 - 1.0
}

export interface ABTestResult {
    base: GeneratedNewsContent;
    fineTuned: GeneratedNewsContent;
    baseProvider: string;
    fineTunedProvider: string;
}

export interface IContentGenerationService {
    generate(input: RawNewsInput): Promise<GeneratedNewsContent>;
    abTestGenerate(input: RawNewsInput): Promise<ABTestResult>;
    setProvider(provider: ILLMProvider): void;
    setFallback(fallbackService: IContentGenerationService): void;
}

export interface RawNewsInput {
    baslik: string;
    ozet: string;
    kategori: string;
    kaynak_url: string;
}
