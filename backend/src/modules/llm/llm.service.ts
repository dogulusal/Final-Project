import { IContentGenerationService, ILLMProvider, RawNewsInput, GeneratedNewsContent, ABTestResult } from './llm.interface';
import { OllamaProvider } from './providers/ollama.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { LLM_PROVIDER, LLM_FALLBACK_PROVIDER, LLMProviderType } from '../../config/constants';
import * as fs from 'fs';
import * as path from 'path';

export class ContentGenerationService implements IContentGenerationService {
    private activeProvider: ILLMProvider;
    private fallbackProvider: ILLMProvider | null = null;

    constructor() {
        this.activeProvider = this.createProvider(LLM_PROVIDER);

        // Eğer env değişkeninde fallback belirtilmişse, ve asıl provider'dan farklıysa kur
        if (LLM_FALLBACK_PROVIDER && LLM_FALLBACK_PROVIDER !== LLM_PROVIDER) {
            this.fallbackProvider = this.createProvider(LLM_FALLBACK_PROVIDER as LLMProviderType, true);
            console.log(`[LLM] Fallback Sağlayıcısı aktif edildi: ${this.fallbackProvider.name}`);
        }
    }

    private createProvider(providerType: LLMProviderType | string, isFallback = false): ILLMProvider {
        switch (providerType) {
            case LLMProviderType.GEMINI:
                return new GeminiProvider();
            case LLMProviderType.ANTHROPIC:
                // TODO: Anthropic Provider (ileride)
                return new OllamaProvider(isFallback);
            case LLMProviderType.OLLAMA:
            default:
                return new OllamaProvider(isFallback); // Varsayılan ücretsiz çözüm
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
     * Parsing helper for generation outputs
     */
    private parseRawOutput(rawContent: string, input: RawNewsInput): GeneratedNewsContent {
        let content = rawContent.trim();
        if (content.startsWith('```json')) {
            content = content.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (content.startsWith('```')) {
            content = content.replace(/^```/, '').replace(/```$/, '').trim();
        }
        
        try {
            return JSON.parse(content) as GeneratedNewsContent;
        } catch (e) {
            // Sona erdirici fallback (hiçbir şey çalışmazsa orijinali ver ki crawler çökmesin)
            return {
                baslik: input.baslik,
                icerik: `- ${input.ozet.split('. ').join('.\n- ')}`,
                meta_aciklama: `Bu haberin önemi: ${input.ozet.substring(0, 100)}...`,
                etiketler: [input.kategori],
                sentiment: "Nötr",
                confidence: 0.5,
                kategori: input.kategori
            };
        }
    }

    private getPrompts(input: RawNewsInput) {
        const systemPrompt = `
Sen 20 yıllık deneyimli bir baş editörsün ve "Smart Brevity" (Akıllı Kısalık) felsefesiyle haberler yazıyorsun.
Görevin, sana verilen ham veriyi tamamen ÖZGÜNLEŞTİREREK, okuyucunun vaktini çalmayan ama en kritik bilgiyi veren bir JSON raporuna dönüştürmektir.

KURALLAR:
1. meta_aciklama alanı mutlaka "Neden önemli?" sorusuna yanıt veren, 1-2 cümlelik, somut etki odaklı bir metin olmalıdır.
2. icerik alanı, haberi 3-5 adet kısa madde işaretine (bullet points) bölerek özetlemelidir.
3. sentiment alanı sadece "Pozitif", "Negatif" veya "Nötr" değerlerinden biri olmalıdır.
4. confidence alanı haberin doğruluğuna dair güven skorun olmalıdır (0.0-1.0 arası).
5. kategori alanı için SADECE aşağıdaki tanımlara bakarak karar ver — önerileni körü körüne kabul etme:

KATEGORİ TANIMLARI (kesin referans):
- Spor: Futbol, basketbol, tenis, olimpiyat, maç sonucu, transfer, sporcu, lig, turnuva
- Ekonomi: Borsa, faiz, enflasyon, dolar/euro, merkez bankası, şirket kazancı, ihracat, bütçe, vergi, kredi
- Teknoloji: Yapay zeka, yazılım, donanım, telefon, bilgisayar, siber güvenlik, uzay, robot, uygulama, oyun
- Siyaset: Meclis, bakan, cumhurbaşkanı, seçim, parti, kanun, yasa, hükümet kararı, anayasa
- Dünya: Yabancı ülke haberleri, savaş, uluslararası ilişkiler, NATO, BM, küresel olaylar, yabancı lider
- Sağlık: Hastalık, tedavi, aşı, hastane, doktor, ilaç, kanser, salgın, medikal araştırma
- Genel: Kaza, suç, cinayet, yangın, sel, deprem, sosyal olay, magazin, eğlence, yerel haber, insan ilgisi

SADECE AŞAĞIDAKİ JSON FORMATINDA YANIT VER:
{
  "baslik": "Vurucu haber başlığı (en fazla 70 karakter)",
  "meta_aciklama": "Bu haberin önemini açıklayan kısa cümle.",
  "icerik": "Madde 1. Madde 2. Madde 3.",
  "etiketler": ["etiket1", "etiket2"],
  "sentiment": "Pozitif|Negatif|Nötr",
  "confidence": 0.95,
  "kategori": "Spor|Ekonomi|Teknoloji|Siyaset|Dünya|Sağlık|Genel"
}
`;

        const userPrompt = `
LÜTFEN BU HABERİ YENİDEN YAZ (JSON OLARAK DÖN):
Önerilen Kategori (doğrula veya düzelt): ${input.kategori}
Kaynak URL: ${input.kaynak_url}

HAM BAŞLIK: 
${input.baslik}

HAM ÖZET/İÇERİK:
${input.ozet}
`;
        return { systemPrompt, userPrompt };
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

        const { systemPrompt, userPrompt } = this.getPrompts(input);

        try {
            const response = await currentProvider.generateContent(userPrompt, systemPrompt);
            console.log(`[LLM Info] ${currentProvider.name} ${response.tokensUsed} token kullandı.`);
            return this.parseRawOutput(response.content, input);
        } catch (error) {
            console.error(`[LLM Error] İşlem hatası:`, error instanceof Error ? error.message : error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`LLM provider failed: ${message}`);
        }
    }

    async abTestGenerate(input: RawNewsInput): Promise<ABTestResult> {
        if (!this.fallbackProvider) {
            throw new Error('A/B testi için fallback provider tanımlanması gereklidir. (.env içinde yapılandırın)');
        }
        
        const { systemPrompt, userPrompt } = this.getPrompts(input);
        
        console.log(`[LLM A/B Test] A/B Testi başlatılıyor. Base: ${this.fallbackProvider.name}, Fine-Tuned: ${this.activeProvider.name}`);
        
        const [fineTunedResponse, baseResponse] = await Promise.all([
            this.activeProvider.generateContent(userPrompt, systemPrompt).catch(e => {
                console.error('FineTuned API Hatası:', e);
                return { content: "", tokensUsed: 0, provider: this.activeProvider.name, model: 'unknown' };
            }),
            this.fallbackProvider.generateContent(userPrompt, systemPrompt).catch(e => {
                console.error('Base API Hatası:', e);
                return { content: "", tokensUsed: 0, provider: this.fallbackProvider!.name, model: 'unknown' };
            })
        ]);
        
        const fineTunedData = this.parseRawOutput(fineTunedResponse.content, input);
        const baseData = this.parseRawOutput(baseResponse.content, input);
        
        const result: ABTestResult = {
            base: baseData,
            fineTuned: fineTunedData,
            baseProvider: this.fallbackProvider.name,
            fineTunedProvider: this.activeProvider.name
        };
        
        // Çıktıları bir dosyaya kaydet
        try {
            const reportsDir = path.resolve(__dirname, '../../../../training/ab-tests');
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }
            const fileName = `ab-test-${new Date().getTime()}.json`;
            fs.writeFileSync(path.join(reportsDir, fileName), JSON.stringify({input, result}, null, 2), 'utf8');
            console.log(`[LLM A/B Test] Sonuçlar kaydedildi: ${fileName}`);
        } catch (e) {
            console.error('[LLM A/B Test Error] Sonuçlar dosyaya yazılamadı:', e);
        }
        
        return result;
    }
}
