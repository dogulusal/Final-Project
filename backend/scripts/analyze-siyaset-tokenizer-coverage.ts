import { PrismaClient } from '@prisma/client';

type Row = {
  kategori: string;
  baslik: string;
  icerik: string | null;
};

const prisma = new PrismaClient();

const SIYASET_SIGNALS = [
  'secim',
  'seçim',
  'cumhurbaskani',
  'cumhurbaşkanı',
  'meclis',
  'milletvekili',
  'bakan',
  'kabine',
  'parti',
  'hukumet',
  'hükümet',
  'anayasa'
];

function tokenizeLegacy(text: string): string[] {
  return text.toLowerCase().trim().match(/\b\w+\b/g) || [];
}

function tokenizeUnicode(text: string): string[] {
  return text.toLowerCase().normalize('NFC').trim().match(/[\p{L}\p{N}]+/gu) || [];
}

function makeBigrams(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    out.push(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return out;
}

function bump(map: Map<string, number>, token: string): void {
  map.set(token, (map.get(token) || 0) + 1);
}

function topN(map: Map<string, number>, n: number): Array<[string, number]> {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

async function main() {
  try {
    const rows = (await prisma.$queryRaw`
      SELECT k.ad AS kategori, h.baslik, h.icerik
      FROM haberler h
      JOIN kategoriler k ON k.id = h.kategori_id
      WHERE h.kategori_dogrulandi = true
        AND h.durum IN ('hazir', 'yayinda')
    `) as Row[];

    const siyasetRows = rows.filter((r) => r.kategori === 'Siyaset');

    const uniLegacy = new Map<string, number>();
    const biLegacy = new Map<string, number>();
    const uniUnicode = new Map<string, number>();
    const biUnicode = new Map<string, number>();

    const signalLegacyDocHit = new Map<string, number>();
    const signalUnicodeDocHit = new Map<string, number>();
    const signalLossExamples = new Map<string, string>();

    for (const row of siyasetRows) {
      const text = `${row.baslik || ''} ${row.icerik || ''}`.trim();
      if (!text) continue;

      const legacyTokens = tokenizeLegacy(text);
      const unicodeTokens = tokenizeUnicode(text);

      for (const t of legacyTokens) bump(uniLegacy, t);
      for (const t of makeBigrams(legacyTokens)) bump(biLegacy, t);
      for (const t of unicodeTokens) bump(uniUnicode, t);
      for (const t of makeBigrams(unicodeTokens)) bump(biUnicode, t);

      const legacySet = new Set(legacyTokens);
      const unicodeSet = new Set(unicodeTokens);

      for (const signal of SIYASET_SIGNALS) {
        if (legacySet.has(signal)) {
          signalLegacyDocHit.set(signal, (signalLegacyDocHit.get(signal) || 0) + 1);
        }
        if (unicodeSet.has(signal)) {
          signalUnicodeDocHit.set(signal, (signalUnicodeDocHit.get(signal) || 0) + 1);
        }

        if (unicodeSet.has(signal) && !legacySet.has(signal) && !signalLossExamples.has(signal)) {
          signalLossExamples.set(signal, row.baslik);
        }
      }
    }

    console.log('=== TOKENIZER COVERAGE ANALYSIS (SIYASET) ===');
    console.log(`rows_total=${rows.length}`);
    console.log(`rows_siyaset=${siyasetRows.length}`);

    console.log('\n-- Signal Document Hit Comparison --');
    for (const signal of SIYASET_SIGNALS) {
      const legacy = signalLegacyDocHit.get(signal) || 0;
      const unicode = signalUnicodeDocHit.get(signal) || 0;
      const delta = unicode - legacy;
      const ex = signalLossExamples.get(signal);
      console.log(`${signal.padEnd(18)} legacy=${String(legacy).padStart(3)} unicode=${String(unicode).padStart(3)} delta=${String(delta).padStart(3)}${ex ? ` example=\"${ex}\"` : ''}`);
    }

    console.log('\n-- Top 25 Unicode Unigrams (Siyaset docs) --');
    for (const [token, count] of topN(uniUnicode, 25)) {
      console.log(`${token.padEnd(24)} ${count}`);
    }

    console.log('\n-- Top 25 Unicode Bigrams (Siyaset docs) --');
    for (const [token, count] of topN(biUnicode, 25)) {
      console.log(`${token.padEnd(32)} ${count}`);
    }

    console.log('\n-- Top 25 Legacy Unigrams (Siyaset docs) --');
    for (const [token, count] of topN(uniLegacy, 25)) {
      console.log(`${token.padEnd(24)} ${count}`);
    }

    console.log('\n-- Top 25 Legacy Bigrams (Siyaset docs) --');
    for (const [token, count] of topN(biLegacy, 25)) {
      console.log(`${token.padEnd(32)} ${count}`);
    }
  } catch (error) {
    console.error('Tokenizer coverage analysis failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
