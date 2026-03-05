import { IContentGenerationService, ILLMProvider, RawNewsInput, GeneratedNewsContent } from './llm.interface';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { LLM_PROVIDER, LLM_FALLBACK_PROVIDER, LLMProviderType } from '../../config/constants';

export class ContentGenerationService implements IContentGenerationService {
    private activeProvider: ILLMProvider;
    private fallbackProvider: ILLMProvider | null = null;

    constructor() {
        this.activeProvider = this.createProvider(LLM_PROVIDER);

        // Eğer env değişkeninde fallback belirtilmişse, ve asıl provider'dan farklıysa kur
        if (LLM_FALLBACK_PROVIDER && LLM_FALLBACK_PROVIDER !== LLM_PROVIDER) {
            this.fallbackProvider = this.createProvider(LLM_FALLBACK_PROVIDER as LLMProviderType);
            console.log(`[LLM] Fallback Sağlayıcısı aktif edildi: ${this.fallbackProvider.name}`);
        }
    }

    private createProvider(providerType: LLMProviderType | string): ILLMProvider {
        switch (providerType) {
            case LLMProviderType.OPENAI:
                return new OpenAiProvider();
            case LLMProviderType.GEMINI:
                return new GeminiProvider();
            case LLMProviderType.ANTHROPIC:
                // TODO: Anthropic Provider (ileride)
                return new OllamaProvider();
            case LLMProviderType.OLLAMA:
            default:
                return new OllamaProvider(); // Varsayılan ücretsiz çözüm
        }
    }

    setProvider(provider: ILLMProvider): void {
        this.activeProvider = provider;
    }

    setFallback(fallbackService: IContentGenerationService): void {
        // TODO: Tam feature set üzerinden devretmek için 
        // Şu an provider tabanlı basit fallback kullanıyoruz.
    }

    /**
     * Gazeteci/Editör personasıyla Haber metnini yeniden yaratır (Özgünleştirir)
     * Ayrıca bir JSON formatı beklediğimizi çok zorlayıcı şekilde LLM'e iletiyoruz.
     */
    async generate(input: RawNewsInput): Promise<GeneratedNewsContent> {
        const isAvailable = await this.activeProvider.isAvailable();
        let currentProvider = this.activeProvider;

        if (!isAvailable) {
            console.warn(`[LLM Warn] Ana sağlayıcı (${currentProvider.name}) kullanılamıyor!`);
            if (this.fallbackProvider) {
                console.log(`[LLM Info] Yedek (Fallback) sağlayıcıya geçiliyor: ${this.fallbackProvider.name}`);
                currentProvider = this.fallbackProvider;
            } else {
                throw new Error('Hiçbir LLM sağlayıcısına ulaşılamıyor (Ana ve Yedek başarısız).');
            }
        }

        const systemPrompt = `
Sen 20 yıllık deneyimli bir baş editörsün ve objektif ama ilgi çekici haberler yazıyorsun.
Sana ham bir haber verisi verilecek. Görevin bu haberi okuyucu için sıkıcı olmayacak, telif hakkı ihlali yapmayacak şekilde tamamen ÖZGÜNLEŞTİREREK yeniden yazmaktır.
Asla yorum katma, sadece gerçekleri gazetecilik etiğine uygun olarak aktar.

SADECE VE SADECE AŞAĞIDAKİ JSON FORMATINDA YANIT VER. EKSTRA HİÇBİR AÇIKLAMA YAZMA:
{
  "baslik": "İlgi çekici SEO uyumlu yeni haber başlığı (en fazla 70 karakter)",
  "meta_aciklama": "Arama motorları için 150 karakteri geçmeyen vurucu özet",
  "icerik": "Okunması kolay paragraflara bölünmüş, zenginleştirilmiş haber metni (HTML formatı OLMASIN, düz metin olsun)",
  "etiketler": ["etiket1", "etiket2", "kategoriyeUygunEtiket3"]
}
`;

        const userPrompt = `
LÜTFEN BU HABERİ YENİDEN YAZ (JSON OLARAK DÖN):
Kategori: ${input.kategori}
Kaynak URL: ${input.kaynak_url}

HAM BAŞLIK: 
${input.baslik}

HAM ÖZET/İÇERİK:
${input.ozet}
`;

        try {
            const response = await currentProvider.generateContent(userPrompt, systemPrompt);
            console.log(`[LLM Info] ${currentProvider.name} ${response.tokensUsed} token kullandı.`);

            // JSON Parse işlemindeki hataları engellemek için metin temizliği (markdown block vs.)
            let rawContent = response.content.trim();

            // Bazen LLM'ler json markdown bloguna alır: \`\`\`json { ... } \`\`\`
            if (rawContent.startsWith('```json')) {
                rawContent = rawContent.replace(/^```json/, '').replace(/```$/, '').trim();
            } else if (rawContent.startsWith('```')) {
                rawContent = rawContent.replace(/^```/, '').replace(/```$/, '').trim();
            }

            const generatedData: GeneratedNewsContent = JSON.parse(rawContent);

            return generatedData;

        } catch (error) {
            console.error(`[LLM Error] İşlem hatası veya JSON Parse hatası:`, error instanceof Error ? error.message : error);

            // Sona erdirici fallback (hiçbir şey çalışmazsa orijinali ver ki crawler çökmesin)
            return {
                baslik: input.baslik,
                icerik: input.ozet + `\n\n(Kaynak: ${input.kaynak_url})`,
                meta_aciklama: input.ozet.substring(0, 150),
                etiketler: [input.kategori]
            };
        }
    }
}
