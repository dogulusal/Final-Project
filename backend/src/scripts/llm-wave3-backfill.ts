/**
 * LLM Wave3 Backfill -- Dispute Tiebreaker (Gemini 2/2 Consensus)
 *
 * Hedef: durum=ham AND nb_kategori_id != llm_kategori_id olan kayitlari
 *        Gemini'ye gonderir, 2/2 consensus kurali uygular.
 *
 * Consensus kurali:
 *   - Gemini == NB  => "2/2 consensus" => haber hazir yayinlanir (auto-resolve)
 *   - Gemini != NB  => cakisma onaylandi => dispute_queue'ya Gemini kategorisi +
 *                      llm_guven_skoru yazilir, admin karari bekler
 *
 * BACKFILL KOMUTLARI:
 *   docker compose exec backend npx ts-node src/scripts/llm-wave3-backfill.ts
 *   docker compose exec backend npx ts-node src/scripts/llm-wave3-backfill.ts --dry-run
 *   docker compose exec backend npx ts-node src/scripts/llm-wave3-backfill.ts --limit=100
 *   docker compose exec backend npx ts-node src/scripts/llm-wave3-backfill.ts --batch=4 --limit=100
 *   docker compose exec backend npx ts-node src/scripts/llm-wave3-backfill.ts --ids=2452,2459,2465
 *   docker compose exec backend npx ts-node src/scripts/llm-wave3-backfill.ts --reprocess
 */

import 'dotenv/config';
import { prisma } from '../config/database';
import { GeminiProvider, GeminiQuotaExhaustedError } from '../modules/llm/providers/gemini.provider';
import { LLM_API_KEYS } from '../config/constants';
import { VALID_LLM_CATEGORIES, LLMCategory } from '../modules/llm/llm-consensus-worker';

// CLI Argumanlar
const cliArgs = process.argv.slice(2);
const LIMIT = parseInt(cliArgs.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '50', 10);
const DRY_RUN = cliArgs.includes('--dry-run');
const parsedBatch = parseInt(cliArgs.find(a => a.startsWith('--batch='))?.split('=')[1] ?? '3', 10);
const BATCH_NUMBER = Number.isInteger(parsedBatch) && parsedBatch > 0 ? parsedBatch : 3;
const FORCE_IDS = cliArgs
    .find(a => a.startsWith('--ids='))
    ?.split('=')[1]
    ?.split(',')
    .map(Number)
    .filter(n => Number.isInteger(n) && n > 0) ?? [];

const DELAY_MS = 2000;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 8000;
// gemini-2.5-flash free tier: 20 req/gun/proje (6 key = 120 req/gun toplam)
// Diger eski modeller (1.5-flash, 2.0-flash) yeni hesaplara kapali (404)
const WAVE3_MODEL = 'gemini-2.5-flash';

const WAVE3_SYSTEM_PROMPT = `Sen deneyimli bir Turkce haber editorusun ve makine ogrenmesi dogrulayicisisin.
Sana bir haber basligi (ve varsa ozeti) verilecek. Haberi degerlendire ve su 7 kategoriden BIRINE ata:

Gecerli kategoriler: Spor, Ekonomi, Teknoloji, Siyaset, Dunya, Saglik, Genel

YANIT FORMATI (sadece gecerli JSON dondur, baska hicbir sey yazma):
{"kategori": "KategoriAdi", "guven": 0.95}

guven: 0.0 (cok belirsiz) ile 1.0 (tamamen emin) arasinda ondalik sayi.`;

function buildWave3Prompt(baslik: string, ozet?: string | null): string {
    const ozetPart = ozet?.trim() ? `\nOzet: ${ozet.slice(0, 300)}` : '';
    return `HABERI KATEGORIZE ET:\nBaslik: ${baslik}${ozetPart}`;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseGeminiResponse(raw: string): { kategori: string; guven: number } | null {
    try {
        const cleaned = raw.trim()
            .replace(/^```json?\s*/i, '')
            .replace(/\s*```$/, '')
            .trim();
        const parsed = JSON.parse(cleaned);
        if (typeof parsed.kategori === 'string' && typeof parsed.guven === 'number') {
            const guven = Math.min(1, Math.max(0, parsed.guven));
            return { kategori: parsed.kategori, guven };
        }
        return null;
    } catch {
        return null;
    }
}

// ASCII fallback haritasi: Gemini bazen Turkce harf icermeyen yanit dondurebilir
const ASCII_TO_TR: Record<string, string> = {
    'dunya': 'D\u00fcnya',   // Dünya
    'saglik': 'Sa\u011fl\u0131k', // Sağlık
    'siyaset': 'Siyaset',
    'spor': 'Spor',
    'ekonomi': 'Ekonomi',
    'teknoloji': 'Teknoloji',
    'genel': 'Genel',
};

function normalizeCategory(raw: string): LLMCategory | null {
    const trimmed = raw.trim().replace(/^["']|["']$/g, '');

    // 1. Dogrudan eslestirme (Turkce karakterli yanit icin)
    const direct = (VALID_LLM_CATEGORIES as readonly string[]).find(
        cat => cat.localeCompare(trimmed, 'tr', { sensitivity: 'base' }) === 0,
    ) as LLMCategory | undefined;
    if (direct) return direct;

    // 2. ASCII fallback: "Dunya" -> "Dunya", sonra VALID listesiyle karsilastir
    const key = trimmed.toLowerCase();
    const mapped = ASCII_TO_TR[key];
    if (mapped) {
        return (VALID_LLM_CATEGORIES as readonly string[]).find(
            cat => cat.localeCompare(mapped, 'tr', { sensitivity: 'base' }) === 0,
        ) as LLMCategory | undefined ?? null;
    }

    // 3. Case-insensitive ASCII karsilastirma
    return (VALID_LLM_CATEGORIES as readonly string[]).find(
        cat => cat.toLowerCase() === key
    ) as LLMCategory ?? null;
}

async function main() {
    console.log('\n======================================================');
    console.log('  LLM Wave3 Backfill -- Gemini Dispute Tiebreaker');
    console.log('======================================================');
    console.log(`Limit: ${LIMIT} | Dry-run: ${DRY_RUN} | Model: ${WAVE3_MODEL}`);
    console.log(`Batch: ${BATCH_NUMBER}`);
    console.log(`Force-IDs: ${FORCE_IDS.length > 0 ? FORCE_IDS.join(',') : 'yok'}\n`);

    const gemini = new GeminiProvider(WAVE3_MODEL);
    const numKeys = Math.max(1, LLM_API_KEYS.length);

    const kategoriler = await prisma.kategori.findMany({ select: { id: true, ad: true } });
    const kategoriMap = new Map<string, number>(kategoriler.map(k => [k.ad.toLowerCase(), k.id]));
    const kategoriIdToAd = new Map<number, string>(kategoriler.map(k => [k.id, k.ad]));

    const skipProcessed = !cliArgs.includes('--reprocess');

    const whereClause =
        FORCE_IDS.length > 0
            ? { id: { in: FORCE_IDS } }
            : {
                  durum: 'ham' as const,
                  nbKategoriId: { not: null },
                  llmKategoriId: { not: null },
                  ...(skipProcessed ? { llmProvider: { not: 'gemini-wave3' } } : {}),
              };

    const candidates = await prisma.haber.findMany({
        where: whereClause as any,
        select: {
            id: true,
            baslik: true,
            metaAciklama: true,
            nbKategoriId: true,
            llmKategoriId: true,
        },
        orderBy: { id: 'asc' },
        take: LIMIT,
    });

    const queue = FORCE_IDS.length > 0
        ? candidates
        : candidates.filter(r => r.nbKategoriId !== r.llmKategoriId);

    console.log(`Aday kayit sayisi: ${queue.length}\n`);

    if (queue.length === 0) {
        console.log('Islenecek kayit yok.');
        return;
    }

    let consensus = 0;
    let conflict = 0;
    let failed = 0;

    for (let i = 0; i < queue.length; i++) {
        const haber = queue[i];
        const nbAd = kategoriIdToAd.get(haber.nbKategoriId!) ?? '?';
        const llmAd = kategoriIdToAd.get(haber.llmKategoriId!) ?? '?';

        process.stdout.write(
            `[${i + 1}/${queue.length}] #${haber.id} NB=${nbAd} | oldLLM=${llmAd} => Gemini... `,
        );

        try {
            const prompt = buildWave3Prompt(haber.baslik, haber.metaAciklama);
            let parsed: { kategori: string; guven: number } | null = null;
            let lastErr = '';
            let quota429Count = 0;

            // Toplam deneme = MAX_RETRIES (503) + numKeys (429 key rotation)
            for (let attempt = 1; attempt <= MAX_RETRIES + numKeys; attempt++) {
                try {
                    const response = await gemini.generateContent(prompt, WAVE3_SYSTEM_PROMPT);
                    parsed = parseGeminiResponse(response.content);
                    if (parsed) break;
                    lastErr = `JSON parse hatasi (deneme ${attempt}): ${response.content.slice(0, 60)}`;
                    break; // JSON parse hatasi retry'dan fayda gormez
                } catch (apiErr: any) {
                    const msg: string = apiErr?.message ?? String(apiErr);

                    // 429 daily-quota exhausted: uzun bekleme YOK.
                    // GeminiProvider round-robin: her generateContent() cagrisi nextKey() ile
                    // bir sonraki API key'i kullanir. Farkli projelerden gelen keyler farkli kotaya sahip.
                    if (apiErr instanceof GeminiQuotaExhaustedError) {
                        quota429Count++;
                        process.stdout.write(` [429 key${quota429Count}/${numKeys}]`);
                        lastErr = `429 kota doldu (key ${quota429Count})`;
                        if (quota429Count >= numKeys) {
                            lastErr = `Tum ${numKeys} key 429 dondu (gunluk kota tukendi)`;
                            break;
                        }
                        await sleep(1000); // burst marji
                        continue;
                    }

                    // 503/502 gecici yuk: exponential backoff
                    const isTransient = msg.includes('503') || msg.includes('502') || msg.includes('overloaded');
                    lastErr = msg.slice(0, 80);
                    if (!isTransient || attempt > MAX_RETRIES) break;
                    const wait = RETRY_DELAY_BASE_MS * attempt;
                    process.stdout.write(` [503 retry ${attempt}/${MAX_RETRIES}, ${wait / 1000}s]... `);
                    await sleep(wait);
                }
            }

            if (!parsed) {
                console.log(`FAIL ${lastErr}`);
                failed++;
                await sleep(DELAY_MS);
                continue;
            }

            const geminiKat = normalizeCategory(parsed.kategori);
            if (!geminiKat) {
                console.log(`FAIL gecersiz kategori: "${parsed.kategori}"`);
                failed++;
                await sleep(DELAY_MS);
                continue;
            }

            const geminiKatId = kategoriMap.get(geminiKat.toLowerCase())!;
            const isConsensus = geminiKatId === haber.nbKategoriId;

            console.log(`${geminiKat} (guven: %${Math.round(parsed.guven * 100)}) => ${isConsensus ? 'KONSENSUS' : 'CAKISMA'}`);

            if (!DRY_RUN) {
                if (isConsensus) {
                    await prisma.$transaction([
                        prisma.haber.update({
                            where: { id: haber.id },
                            data: {
                                kategoriId: geminiKatId,
                                llmKategoriId: geminiKatId,
                                llmProvider: 'gemini-wave3',
                                kategoriDogrulandi: true,
                                durum: 'hazir',
                            },
                        }),
                        prisma.disputeQueue.upsert({
                            where: { haberId: haber.id },
                            create: {
                                haberId: haber.id,
                                nbKategoriId: haber.nbKategoriId,
                                llmKategoriId: geminiKatId,
                                nbGuvenSkoru: null,
                                llmGuvenSkoru: parsed.guven,
                                batchNumber: BATCH_NUMBER,
                                durum: 'cozuldu',
                                adminKararKategoriId: geminiKatId,
                                resolvedAt: new Date(),
                                resolvedBy: 'wave3-gemini-consensus',
                            },
                            update: {
                                llmKategoriId: geminiKatId,
                                llmGuvenSkoru: parsed.guven,
                                durum: 'cozuldu',
                                adminKararKategoriId: geminiKatId,
                                resolvedAt: new Date(),
                                resolvedBy: 'wave3-gemini-consensus',
                            },
                        }),
                    ]);
                    consensus++;
                } else {
                    await prisma.$transaction([
                        prisma.haber.update({
                            where: { id: haber.id },
                            data: {
                                llmKategoriId: geminiKatId,
                                llmProvider: 'gemini-wave3',
                                kategoriDogrulandi: false, // Admin karar bekliyor, drift koruma icin false
                            },
                        }),
                        prisma.disputeQueue.upsert({
                            where: { haberId: haber.id },
                            create: {
                                haberId: haber.id,
                                nbKategoriId: haber.nbKategoriId,
                                llmKategoriId: geminiKatId,
                                nbGuvenSkoru: null,
                                llmGuvenSkoru: parsed.guven,
                                batchNumber: BATCH_NUMBER,
                                durum: 'bekliyor',
                            },
                            update: {
                                llmKategoriId: geminiKatId,
                                llmGuvenSkoru: parsed.guven,
                                durum: 'bekliyor',
                                adminKararKategoriId: null,
                                resolvedAt: null,
                                resolvedBy: null,
                            },
                        }),
                    ]);
                    conflict++;
                }
            } else {
                if (isConsensus) consensus++;
                else conflict++;
            }
        } catch (err: any) {
            console.log(`FAIL ${err?.message?.slice(0, 80) ?? err}`);
            failed++;
        }

        await sleep(DELAY_MS);
    }

    console.log('\n======================================================');
    console.log('  Wave3 Ozet');
    console.log('======================================================');
    console.log(`  Auto-resolve (NB+Gemini consensus) : ${consensus}`);
    console.log(`  Onaylanmis cakisma (dispute_queue) : ${conflict}`);
    console.log(`  Basarisiz                          : ${failed}`);
    console.log(`  Toplam islenen                     : ${queue.length - failed}`);
    if (DRY_RUN) {
        console.log('\n  [DRY-RUN] Hicbir kayit degistirilmedi.');
    }
    console.log('');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());