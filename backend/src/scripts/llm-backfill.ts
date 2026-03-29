/**
 * LLM Backfill Script
 * 
 * seed-rss ve ham durumdaki haberleri LLM'den geçirerek zenginleştirir.
 * Gemini: günlük GEMINI_LIMIT kadar (hızlı, öncelikli)
 * Ollama: ek OLLAMA_LIMIT kadar (yavaş, arka plan)
 * 
 * Kullanım:
 *   npx ts-node src/scripts/llm-backfill.ts
 *   npx ts-node src/scripts/llm-backfill.ts --gemini-limit=50 --ollama-limit=20 --dry-run
 */

import 'dotenv/config';
import { prisma } from '../config/database';
import { ContentGenerationService } from '../modules/llm/llm.service';
import { GeminiProvider } from '../modules/llm/providers/gemini.provider';
import { OllamaProvider } from '../modules/llm/providers/ollama.provider';

// --- Argümanlar ---
const args = process.argv.slice(2);
const GEMINI_LIMIT = parseInt(args.find(a => a.startsWith('--gemini-limit='))?.split('=')[1] || '100');
const OLLAMA_LIMIT = parseInt(args.find(a => a.startsWith('--ollama-limit='))?.split('=')[1] || '25');
const DRY_RUN = args.includes('--dry-run');
const DELAY_MS = 1500; // İstekler arası bekleme (rate limit için)

console.log(`\n=== LLM Backfill Başladı ===`);
console.log(`Gemini limit: ${GEMINI_LIMIT} | Ollama limit: ${OLLAMA_LIMIT} | Dry-run: ${DRY_RUN}`);

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processWithProvider(
    haberId: number,
    baslik: string,
    icerik: string,
    kategoriAd: string,
    kaynakUrl: string,
    service: ContentGenerationService,
    providerName: string,
    kategoriMap: Map<string, number>
): Promise<boolean> {
    try {
        const result = await service.generate({
            baslik,
            ozet: icerik.slice(0, 800),
            kategori: kategoriAd,
            kaynak_url: kaynakUrl || ''
        });

        if (DRY_RUN) {
            console.log(`  [DRY-RUN] ${providerName} | [${haberId}] ${baslik.slice(0, 50)}`);
            console.log(`    → kategori: ${result.kategori} | sentiment: ${result.sentiment}`);
            return true;
        }

        // Ollama bazen string yerine array dönderebilir — normalize et
        const normalize = (val: unknown, fallback: string) => {
            if (Array.isArray(val)) return val.join('\n\n');
            if (typeof val === 'string' && val.trim()) return val.trim();
            return fallback;
        };

        const updateData: any = {
            baslik: normalize(result.baslik, baslik),
            icerik: normalize(result.icerik, icerik),
            metaAciklama: normalize(result.meta_aciklama, ''),
            sentiment: (result.sentiment || 'Nötr') as any,
            durum: 'hazir' as any,
            llmProvider: providerName
        };

        // LLM kategori override (güvenilir ise)
        if (result.kategori) {
            const llmCatId = kategoriMap.get(result.kategori.toLowerCase());
            if (llmCatId) updateData.kategoriId = llmCatId;
        }

        await prisma.haber.update({
            where: { id: haberId },
            data: updateData
        });

        return true;
    } catch (err: any) {
        console.warn(`  ⚠ ${providerName} başarısız [${haberId}]: ${err.message?.slice(0, 80)}`);
        return false;
    }
}

async function main() {
    // Kategori map
    const kategoriler = await prisma.kategori.findMany({ select: { id: true, ad: true } });
    const kategoriMap = new Map<string, number>(kategoriler.map(k => [k.ad.toLowerCase(), k.id]));

    // İşlenecek haberler: önce 'ham' (acil), sonra 'seed-rss' (sıralı)
    const hamHaberler = await prisma.haber.findMany({
        where: { OR: [{ llmProvider: null }, { llmProvider: 'none' }], durum: 'ham' },
        select: { id: true, baslik: true, icerik: true, kaynakUrl: true, kategoriId: true },
        orderBy: { id: 'asc' }
    });

    const seedHaberler = await prisma.haber.findMany({
        where: { llmProvider: 'seed-rss' },
        select: { id: true, baslik: true, icerik: true, kaynakUrl: true, kategoriId: true },
        orderBy: { id: 'asc' }  // En eskiden başla
    });

    // kategoriId → ad lookup
    const kategoriIdToAd = new Map<number, string>(kategoriler.map(k => [k.id, k.ad]));

    const queue = [...hamHaberler, ...seedHaberler];

    console.log(`\nKuyruk: ${hamHaberler.length} ham + ${seedHaberler.length} seed-rss = ${queue.length} toplam`);
    console.log(`Bu çalışmada işlenecek: Gemini max ${GEMINI_LIMIT} + Ollama max ${OLLAMA_LIMIT}\n`);

    // Provider'ları kur
    const geminiService = new ContentGenerationService();
    geminiService.setProvider(new GeminiProvider());

    const ollamaService = new ContentGenerationService();
    ollamaService.setProvider(new OllamaProvider(true)); // fallback model (qwen3:8b)

    // Ollama erişilebilir mi?
    const ollamaAvailable = await new OllamaProvider(true).isAvailable();
    console.log(`Ollama durumu: ${ollamaAvailable ? '✅ Erişilebilir' : '❌ Erişilemiyor'}`);

    let geminiDone = 0;
    let ollamaDone = 0;
    let failed = 0;
    const startedAt = Date.now();

    for (const haber of queue) {
        const totalDone = geminiDone + ollamaDone;
        const totalLimit = GEMINI_LIMIT + (ollamaAvailable ? OLLAMA_LIMIT : 0);

        if (totalDone >= totalLimit) break;

        const useGemini = geminiDone < GEMINI_LIMIT;
        const useOllama = ollamaAvailable && !useGemini && ollamaDone < OLLAMA_LIMIT;

        if (!useGemini && !useOllama) break;

        const provider = useGemini ? 'gemini' : 'ollama';
        const service = useGemini ? geminiService : ollamaService;

        process.stdout.write(`[${totalDone + 1}/${Math.min(queue.length, totalLimit)}] ${provider.toUpperCase()} | [${haber.id}] ${haber.baslik.slice(0, 45)}... `);

        const ok = await processWithProvider(
            haber.id,
            haber.baslik,
            haber.icerik || '',
            kategoriIdToAd.get(haber.kategoriId) || 'Genel',
            haber.kaynakUrl || '',
            service,
            provider,
            kategoriMap
        );

        if (ok) {
            if (useGemini) geminiDone++;
            else ollamaDone++;
            console.log('✅');
        } else {
            // Gemini başarısız → Ollama'ya düş
            if (useGemini && ollamaAvailable && ollamaDone < OLLAMA_LIMIT) {
                process.stdout.write('→ Ollama fallback... ');
                const fallbackOk = await processWithProvider(
                    haber.id, haber.baslik, haber.icerik || '',
                    kategoriIdToAd.get(haber.kategoriId) || 'Genel', haber.kaynakUrl || '',
                    ollamaService, 'ollama', kategoriMap
                );
                if (fallbackOk) { ollamaDone++; console.log('✅ (ollama)'); }
                else { failed++; console.log('❌'); }
            } else {
                failed++;
                console.log('❌');
            }
        }

        await sleep(DELAY_MS);
    }

    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const remaining = queue.length - (geminiDone + ollamaDone + failed);

    console.log(`\n=== Özet ===`);
    console.log(`Gemini ile işlenen: ${geminiDone}`);
    console.log(`Ollama ile işlenen: ${ollamaDone}`);
    console.log(`Başarısız: ${failed}`);
    console.log(`Kalan (yarın devam): ${remaining}`);
    console.log(`Toplam süre: ${elapsed} saniye`);
    console.log(`Tahmini bitiş: ~${Math.ceil(remaining / (GEMINI_LIMIT + OLLAMA_LIMIT))} gün`);
    console.log(`=== Tamamlandı ===\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
