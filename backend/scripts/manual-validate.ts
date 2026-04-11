import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';
import * as crypto from 'crypto';

/**
 * Sprint 3: Manuel Validasyon CLI
 * Her kategoriden RANDOM 20 haber seç, terminal'de etiketle, backend'e batch gönder.
 * Confidence gösterilmez — sadece başlık + mevcut kategori + karar.
 *
 * Kullanım:
 *   npx ts-node scripts/manual-validate.ts [--batch-size 20] [--category Ekonomi]
 *   npx ts-node scripts/manual-validate.ts [--batch-size 20] [--source cumhuriyet]
 *   npx ts-node scripts/manual-validate.ts --correct --haber-id=123
 *
 * Kontroller:
 *   y        → Mevcut kategoriyi onayla (confirm)
 *   e/t/g/d/h/s/p → Kategoriyi düzelt (correct)
 *   k        → Atla (skip)
 *   q        → Çık ve mevcut batch'i kaydet
 *
 * Parametreler:
 *   --batch-size=N    : Her kategoriden/kaynaktan N haber seç (varsayılan: 20)
 *   --category=NAME   : Sadece belirtilen kategoriden haber seç (örn: Siyaset)
 *   --source=PATTERN  : Kaynak URL'de PATTERN içeren haberler (örn: cumhuriyet, gazeteduvar)
 *                        Not: source modunda ham/hazir/yayinda haberler birlikte listelenir.
 *   --correct         : Post-batch düzeltme modu (--haber-id ile kullan)
 *   --haber-id=ID     : Correction modunda düzeltilecek haber ID'si
 */

const prisma = new PrismaClient();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const BATCH_SIZE = parseInt(process.argv.find(a => a.startsWith('--batch-size='))?.split('=')[1] ?? '20');
const FILTER_CATEGORY = process.argv.find(a => a.startsWith('--category='))?.split('=')[1];
const FILTER_SOURCE = process.argv.find(a => a.startsWith('--source='))?.split('=')[1];
const CORRECT_MODE = process.argv.includes('--correct');
const CORRECT_HABER_ID = Number.parseInt(process.argv.find(a => a.startsWith('--haber-id='))?.split('=')[1] ?? '0', 10);
const CATEGORY_SHORTCUTS: Record<string, string> = {
  'e': 'Ekonomi',
  't': 'Teknoloji',
  'g': 'Genel',
  'd': 'Dünya',
  'h': 'Sağlık',
  's': 'Spor',
  'p': 'Siyaset',
};

type DecisionType = 'confirm' | 'correct' | 'skip';
type Decision = {
  haberId: number;
  eskiKategoriId: number;
  yeniKategoriId: number;
  kararTuru: DecisionType;
};

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function prompt(question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

function decisionLabel(decision: Decision, categoryById: Record<number, string>): string {
  const from = categoryById[decision.eskiKategoriId] ?? `#${decision.eskiKategoriId}`;
  const to = categoryById[decision.yeniKategoriId] ?? `#${decision.yeniKategoriId}`;

  if (decision.kararTuru === 'confirm') return `onay (${from})`;
  if (decision.kararTuru === 'skip') return 'atla';
  return `düzelt (${from} -> ${to})`;
}

function setDecision(decisions: Decision[], next: Decision): void {
  const idx = decisions.findIndex(d => d.haberId === next.haberId);
  if (idx >= 0) {
    decisions[idx] = next;
    return;
  }
  decisions.push(next);
}

function resolveSourcePattern(input?: string): string | null {
  if (!input) return null;

  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  const aliases: Record<string, string> = {
    cumhuriyet: 'cumhuriyet.com.tr',
    gazeteduvar: 'gazeteduvar.com',
    odatv: 'odatv.com',
    'aa-gundem': 'aa.com.tr',
    'aa-saglik': 'aa.com.tr',
    aa: 'aa.com.tr',
    trthaber: 'trthaber.com',
    'trthaber-saglik': 'trthaber.com',
    'trthaber-gundem': 'trthaber.com',
    ntv: 'ntv.com.tr',
    'ntv-saglik': 'ntv.com.tr',
    cnnturk: 'cnnturk.com',
    'cnnturk-saglik': 'cnnturk.com',
    ensonhaber: 'ensonhaber.com',
    'ensonhaber-saglik': 'ensonhaber.com',
    aksam: 'aksam.com.tr',
    'aksam-saglik': 'aksam.com.tr',
    takvim: 'takvim.com.tr',
    'takvim-saglik': 'takvim.com.tr',
    sabah: 'sabah.com.tr',
    'sabah-saglik': 'sabah.com.tr',
    haberturk: 'haberturk.com',
    'haberturk-saglik': 'haberturk.com',
  };

  return aliases[raw] ?? raw;
}

async function runCorrectionMode(
  categoryByName: Record<string, number>,
  categoryById: Record<number, string>
): Promise<void> {
  if (!Number.isInteger(CORRECT_HABER_ID) || CORRECT_HABER_ID <= 0) {
    console.error('❌ --correct modu için --haber-id=<id> zorunlu.');
    rl.close();
    await prisma.$disconnect();
    process.exit(1);
  }

  const haber = await prisma.haber.findUnique({
    where: { id: CORRECT_HABER_ID },
    select: { id: true, baslik: true, kategoriId: true, kategoriDogrulandi: true }
  });

  if (!haber) {
    console.error(`❌ Haber bulunamadı: ${CORRECT_HABER_ID}`);
    rl.close();
    await prisma.$disconnect();
    process.exit(1);
  }

  const mevcutKategori = categoryById[haber.kategoriId] ?? `#${haber.kategoriId}`;
  console.log('\n🛠️  [Correction Mode] Post-batch düzeltme');
  console.log(`📰 Haber ID: ${haber.id}`);
  console.log(`📂 Mevcut Kategori: ${mevcutKategori}`);
  console.log(`🧾 Başlık: ${haber.baslik}`);
  console.log('\ne=Ekonomi  t=Teknoloji  g=Genel  d=Dünya  h=Sağlık  s=Spor  p=Siyaset  q=iptal');

  const input = (await prompt('→ ')).trim().toLowerCase();
  if (input === 'q') {
    console.log('❌ İptal edildi.');
    rl.close();
    await prisma.$disconnect();
    process.exit(0);
  }

  const yeniKategoriAd = CATEGORY_SHORTCUTS[input];
  if (!yeniKategoriAd) {
    console.error('❌ Geçersiz kategori kısayolu.');
    rl.close();
    await prisma.$disconnect();
    process.exit(1);
  }

  const yeniKategoriId = categoryByName[yeniKategoriAd];
  const reason = (await prompt('Düzeltme nedeni (zorunlu): ')).trim();
  if (reason.length < 3) {
    console.error('❌ Düzeltme nedeni en az 3 karakter olmalı.');
    rl.close();
    await prisma.$disconnect();
    process.exit(1);
  }

  const correctionBatchId = `correction-${Date.now()}-${haber.id}`;
  await prisma.$transaction([
    prisma.haber.update({
      where: { id: haber.id },
      data: { kategoriId: yeniKategoriId, kategoriDogrulandi: true }
    }),
    (prisma as any).manuelValidasyon.create({
      data: {
        haberId: haber.id,
        eskiKategoriId: haber.kategoriId,
        yeniKategoriId,
        dogrulayanEmail: 'cli',
        kararTuru: 'correct',
        batchId: correctionBatchId,
        notlar: `post-batch-correction: ${reason}`
      }
    })
  ]);

  console.log(`\n✅ Düzeltme kaydedildi: ${mevcutKategori} → ${yeniKategoriAd}`);
  console.log(`🆔 Correction Batch: ${correctionBatchId}`);
  rl.close();
  await prisma.$disconnect();
  process.exit(0);
}

async function main() {
  const manuelValidasyonRepo = (prisma as any).manuelValidasyon;
  const manuallyValidatedRows: Array<{ haberId: number }> = manuelValidasyonRepo
    ? await manuelValidasyonRepo.findMany({ select: { haberId: true } })
    : [];
  const manuallyValidatedIds: number[] = Array.from(
    new Set(manuallyValidatedRows.map((r) => Number(r.haberId)).filter((id) => Number.isInteger(id)))
  );

  // Tüm kategorileri önceden çek (N+1 önlemi)
  const allCategories = await prisma.kategori.findMany();
  const categoryByName: Record<string, number> = {};
  const categoryById: Record<number, string> = {};
  allCategories.forEach(c => {
    categoryByName[c.ad] = c.id;
    categoryById[c.id] = c.ad;
  });

  if (CORRECT_MODE) {
    return runCorrectionMode(categoryByName, categoryById);
  }

  // Kategori veya Kaynak filtreleme
  let habersToValidate: Array<{ id: number; baslik: string; kategoriId: number }> = [];

  if (FILTER_SOURCE) {
    const sourcePattern = resolveSourcePattern(FILTER_SOURCE);
    if (!sourcePattern) {
      console.error('❌ --source parametresi boş olamaz.');
      process.exit(1);
    }

    console.log(`\n🔍 [Source Filter Mode] girdi='${FILTER_SOURCE}' => pattern='${sourcePattern}'\n`);

    const pool = await prisma.haber.findMany({
      where: {
        kaynakUrl: { contains: sourcePattern, mode: 'insensitive' },
        durum: { in: ['hazir', 'yayinda', 'ham'] },
        ...(manuallyValidatedIds.length > 0 ? { id: { notIn: manuallyValidatedIds } } : {}),
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE * 3,
      select: { id: true, baslik: true, kategoriId: true },
    });

    habersToValidate = shuffleArray(pool).slice(0, BATCH_SIZE);
    console.log(`  📊 ${pool.length} potansiyel → ${habersToValidate.length} seçildi\n`);
  } else {
    // Hedef kategorileri belirle
    const targetCategories = FILTER_CATEGORY
      ? allCategories.filter(c => c.ad === FILTER_CATEGORY)
      : allCategories;

    if (targetCategories.length === 0) {
      console.error(`❌ Kategori bulunamadı: ${FILTER_CATEGORY}`);
      process.exit(1);
    }

    // Her kategoriden RANDOM seçim: fazla al, shuffle'la, ilk N'i al
    for (const cat of targetCategories) {
      const pool = await prisma.haber.findMany({
        where: {
          kategoriId: cat.id,
          durum: { in: ['hazir', 'yayinda'] },
          kategoriDogrulandi: false, // yalnızca doğrulanmamışlar
          ...(manuallyValidatedIds.length > 0 ? { id: { notIn: manuallyValidatedIds } } : {}),
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE * 3, // fazla al, JS'de shuffle
        select: { id: true, baslik: true, kategoriId: true },
      });

      const shuffled = shuffleArray(pool).slice(0, BATCH_SIZE);
      habersToValidate.push(...shuffled);
      console.log(`  ${cat.ad}: ${pool.length} aday → ${shuffled.length} seçildi`);
    }
  }

  if (habersToValidate.length === 0) {
    console.log('\n✅ Doğrulanacak haber kalmadı. Sprint 3 tamamlandı!');
    process.exit(0);
  }

  const batchId = crypto.randomUUID();
  const haberById: Record<number, { baslik: string; kategoriId: number }> = {};
  habersToValidate.forEach(h => {
    haberById[h.id] = { baslik: h.baslik, kategoriId: h.kategoriId };
  });

  console.log(`\n📋 [Manuel Validasyon] Batch başladı`);
  console.log(`🆔 Batch ID: ${batchId}`);
  console.log(`📊 Toplam: ${habersToValidate.length} haber\n`);
  console.log(`Kısayollar: [y]=onayla  [e]=Ekonomi [t]=Teknoloji [g]=Genel`);
  console.log(`            [d]=Dünya   [h]=Sağlık  [s]=Spor     [p]=Siyaset`);
  console.log(`            [k]=atla    [q]=kaydet&çık\n`);
  console.log('─'.repeat(70));

  const decisions: Decision[] = [];
  let shouldQuit = false;

  for (let i = 0; i < habersToValidate.length; i++) {
    const haber = habersToValidate[i];
    const mevcutKategori = categoryById[haber.kategoriId] ?? 'Bilinmeyen';

    console.log(`\n[${i + 1}/${habersToValidate.length}] Mevcut: ${mevcutKategori}`);
    console.log(`📰 ${haber.baslik.substring(0, 90)}${haber.baslik.length > 90 ? '...' : ''}`);

    let validInput = false;
    while (!validInput) {
      const input = (await prompt('→ ')).toLowerCase().trim();

      if (input === 'q') {
        console.log('\n⏹  Erken çıkış — mevcut kararlar gönderilecek...');
        shouldQuit = true;
        validInput = true;
      } else if (input === 'y') {
        setDecision(decisions, {
          haberId: haber.id,
          eskiKategoriId: haber.kategoriId,
          yeniKategoriId: haber.kategoriId,
          kararTuru: 'confirm',
        });
        console.log(`  ✅ Onaylandı: ${mevcutKategori}`);
        validInput = true;
      } else if (CATEGORY_SHORTCUTS[input]) {
        const yeniKategori = CATEGORY_SHORTCUTS[input];
        const yeniKategoriId = categoryByName[yeniKategori];
        setDecision(decisions, {
          haberId: haber.id,
          eskiKategoriId: haber.kategoriId,
          yeniKategoriId,
          kararTuru: 'correct',
        });
        console.log(`  ✏️  Düzeltildi: ${mevcutKategori} → ${yeniKategori}`);
        validInput = true;
      } else if (input === 'k') {
        setDecision(decisions, {
          haberId: haber.id,
          eskiKategoriId: haber.kategoriId,
          yeniKategoriId: haber.kategoriId,
          kararTuru: 'skip',
        });
        console.log(`  ⏭️  Atlandı`);
        validInput = true;
      } else {
        console.log(`  ❌ Geçersiz giriş. Seçenekler: y / e t g d h s p / k / q`);
      }
    }

    if (shouldQuit) break;
  }

  while (true) {
    const confirmed = decisions.filter(d => d.kararTuru === 'confirm').length;
    const corrected = decisions.filter(d => d.kararTuru === 'correct').length;
    const skipped = decisions.filter(d => d.kararTuru === 'skip').length;

    console.log('\n' + '─'.repeat(70));
    console.log(`📊 Batch Özeti:`);
    console.log(`  ✅ Onaylandı:  ${confirmed}`);
    console.log(`  ✏️  Düzeltildi: ${corrected}`);
    console.log(`  ⏭️  Atlandı:    ${skipped}`);
    console.log(`  📤 Gönderilecek: ${confirmed + corrected}`);

    if (decisions.length > 0) {
      console.log('\n🧾 Karar Listesi:');
      decisions.forEach((d, i) => {
        const title = (haberById[d.haberId]?.baslik ?? '').slice(0, 65);
        console.log(`  ${i + 1}) [${d.haberId}] ${decisionLabel(d, categoryById)} | ${title}`);
      });
    }

    console.log('\nKomutlar: [enter]=onayla/gönder adımına geç | [sayı]=düzenle | r=sıfırla | q=iptal');
    const reviewInput = (await prompt('Review → ')).trim().toLowerCase();

    if (reviewInput === '') break;

    if (reviewInput === 'q') {
      console.log('❌ İptal edildi.');
      rl.close();
      await prisma.$disconnect();
      process.exit(0);
    }

    if (reviewInput === 'r') {
      decisions.length = 0;
      console.log('🧹 Tüm kararlar sıfırlandı.');
      continue;
    }

    const row = Number.parseInt(reviewInput, 10);
    if (!Number.isInteger(row) || row < 1 || row > decisions.length) {
      console.log('❌ Geçersiz seçim.');
      continue;
    }

    const target = decisions[row - 1];
    const haber = haberById[target.haberId];
    const mevcutKategori = categoryById[target.eskiKategoriId] ?? 'Bilinmeyen';
    console.log(`\nDüzenlenecek: [${target.haberId}] ${haber.baslik}`);
    console.log(`Mevcut karar: ${decisionLabel(target, categoryById)}`);
    console.log(`Mevcut kategori: ${mevcutKategori}`);
    console.log('Yeni karar: y/e/t/g/d/h/s/p/k');

    const nextInput = (await prompt('Yeni → ')).trim().toLowerCase();
    if (nextInput === 'y') {
      target.yeniKategoriId = target.eskiKategoriId;
      target.kararTuru = 'confirm';
    } else if (nextInput === 'k') {
      target.yeniKategoriId = target.eskiKategoriId;
      target.kararTuru = 'skip';
    } else if (CATEGORY_SHORTCUTS[nextInput]) {
      const yeniKategori = CATEGORY_SHORTCUTS[nextInput];
      target.yeniKategoriId = categoryByName[yeniKategori];
      target.kararTuru = target.yeniKategoriId === target.eskiKategoriId ? 'confirm' : 'correct';
    } else {
      console.log('❌ Geçersiz giriş, karar değişmedi.');
    }
  }

  const toSend = decisions.filter(d => d.kararTuru !== 'skip');
  if (toSend.length === 0) {
    console.log('\n⚠️  Gönderilecek karar yok, çıkılıyor.');
    rl.close();
    await prisma.$disconnect();
    process.exit(0);
  }

  const confirm = (await prompt('\nBatch\'i backend\'e gönder? [y/N]: ')).toLowerCase();
  if (confirm !== 'y') {
    console.log('❌ İptal edildi.');
    rl.close();
    await prisma.$disconnect();
    process.exit(0);
  }

  try {
    await prisma.$transaction([
      ...toSend.map(d =>
        prisma.haber.update({
          where: { id: d.haberId },
          data: { kategoriId: d.yeniKategoriId, kategoriDogrulandi: true, durum: 'hazir' },
        })
      ),
      ...toSend.map(d =>
        (prisma as any).manuelValidasyon.create({
          data: {
            haberId: d.haberId,
            eskiKategoriId: d.eskiKategoriId,
            yeniKategoriId: d.yeniKategoriId,
            dogrulayanEmail: 'cli',
            kararTuru: d.kararTuru,
            batchId,
            notlar: d.kararTuru === 'correct' ? 'Kategori düzeltildi' : 'Onaylandı',
          },
        })
      ),
    ]);
    console.log(`\n✅ [Batch ${batchId.slice(0, 8)}...] ${toSend.length} haber doğrulandı ve audit loguna kaydedildi!`);
  } catch (error) {
    console.error('\n❌ Veritabanı kayıt hatası:', error);
    process.exit(1);
  }

  rl.close();
  await prisma.$disconnect();
}

main().catch(async err => {
  console.error('❌ Hata:', err);
  rl.close();
  await prisma.$disconnect();
  process.exit(1);
});
