import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();

/**
 * Extracts og:image (or twitter:image) from an HTML page.
 * Uses native fetch + regex to avoid heavy dependencies.
 */
async function extractOgImage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const html = await res.text();
    // Only search the head section
    const headEnd = html.indexOf('</head>');
    const headHtml = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 50000);

    // Try og:image first, then twitter:image
    const ogMatch = headHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || headHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch?.[1]) return ogMatch[1];

    const twMatch = headHtml.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      || headHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (twMatch?.[1]) return twMatch[1];

    return null;
  } catch {
    return null;
  }
}

function isValidImageUrl(url: string): boolean {
  if (!url || url.length < 10) return false;
  if (url.includes('placeholder')) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

async function main() {
  console.log('=== og:image Backfill — kaynak URL\'lerden görsel çekme ===\n');

  // Get all news with picsum images that have a kaynak_url
  const news = await prisma.$queryRaw<Array<{ id: number; kaynak_url: string }>>`
    SELECT id, kaynak_url FROM haberler 
    WHERE durum = 'hazir' 
      AND gorsel_url LIKE '%picsum%' 
      AND kaynak_url IS NOT NULL 
      AND kaynak_url != ''
    ORDER BY id DESC
  `;

  console.log(`Toplam ${news.length} haber işlenecek (picsum + kaynak_url var)\n`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const BATCH_SIZE = 10; // concurrent requests

  for (let i = 0; i < news.length; i += BATCH_SIZE) {
    const batch = news.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (item) => {
        const ogImage = await extractOgImage(item.kaynak_url);
        if (ogImage && isValidImageUrl(ogImage)) {
          await prisma.$executeRaw`
            UPDATE haberler SET gorsel_url = ${ogImage} WHERE id = ${item.id}
          `;
          return { id: item.id, status: 'updated' as const, url: ogImage };
        }
        return { id: item.id, status: 'no-image' as const };
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value.status === 'updated') updated++;
        else skipped++;
      } else {
        failed++;
      }
    }

    // Progress every 100
    if ((i + BATCH_SIZE) % 100 < BATCH_SIZE) {
      const pct = Math.round(((i + BATCH_SIZE) / news.length) * 100);
      console.log(`[${pct}%] ${i + BATCH_SIZE}/${news.length} — güncellenen: ${updated}, atlanan: ${skipped}, hata: ${failed}`);
    }
  }

  console.log('\n=== SONUÇ ===');
  console.log(`Güncellenen: ${updated}`);
  console.log(`Görsel bulunamayan: ${skipped}`);
  console.log(`Hata: ${failed}`);
  console.log(`Toplam: ${news.length}`);

  // Final counts
  const counts = await prisma.$queryRaw<Array<{ picsum: bigint; real_image: bigint }>>`
    SELECT 
      COUNT(*) FILTER (WHERE gorsel_url LIKE '%picsum%') AS picsum,
      COUNT(*) FILTER (WHERE gorsel_url NOT LIKE '%picsum%' AND gorsel_url IS NOT NULL) AS real_image
    FROM haberler WHERE durum = 'hazir'
  `;
  console.log('\nGüncel durumu:');
  console.log(`  picsum: ${counts[0].picsum}`);
  console.log(`  gerçek görsel: ${counts[0].real_image}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Hata:', e);
  prisma.$disconnect();
  process.exit(1);
});
