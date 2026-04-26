import { PrismaClient } from '@prisma/client';
import { ImageService } from '../modules/news/image.service';
import Parser from 'rss-parser';
import { RSS_SOURCES } from '../config/constants';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();
const PLACEHOLDER_URL = 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167';

async function main() {
  console.log('=== Haber Görseli Backfill (RSS enclosure match) ===\n');

  // Step 1: Fetch all RSS feeds with image data
  const parser = new Parser({
    timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AI-News-Agency-Bot' },
    customFields: {
      item: [
        ['media:content', 'media'],
        ['media:thumbnail', 'mediaThumbnail'],
      ],
    },
  });

  // Build a map: link URL → image URL from RSS feeds
  const linkToImage = new Map<string, string>();
  let feedCount = 0;

  for (let i = 0; i < RSS_SOURCES.length; i += 5) {
    const batch = RSS_SOURCES.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(async (source) => {
        try {
          const feed = await parser.parseURL(source.url);
          for (const item of feed.items) {
            const link = item.link?.trim();
            if (!link) continue;

            // Extract image from enclosure / media:content / media:thumbnail / content HTML
            const rawItem = item as Record<string, any>;
            const encUrl = rawItem.enclosure?.url;
            const mediaUrl = rawItem.media?.$?.url || rawItem.media?.url;
            const thumbUrl = rawItem.mediaThumbnail?.$?.url || rawItem.mediaThumbnail?.url;
            let contentImg: string | undefined;
            const content = rawItem['content:encoded'] || rawItem.content || '';
            if (typeof content === 'string') {
              const imgMatch = content.match(/<img[^>]+src=["']([^"']+\.(jpg|jpeg|png|webp))[^"']*["']/i);
              if (imgMatch) contentImg = imgMatch[1];
            }

            const imageUrl = encUrl || mediaUrl || thumbUrl || contentImg;
            if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
              linkToImage.set(link, imageUrl);
            }
          }
          feedCount++;
        } catch {
          // skip failed feed
        }
      })
    );
  }

  console.log(`${feedCount}/${RSS_SOURCES.length} RSS feed okundu, ${linkToImage.size} haber-görsel eşleşmesi bulundu.\n`);

  // Step 2: Find all news with placeholder/picsum images
  const items = await prisma.haber.findMany({
    where: {
      OR: [
        { gorselUrl: PLACEHOLDER_URL },
        { gorselUrl: { startsWith: 'https://picsum.photos/' } },
      ],
    },
    select: {
      id: true,
      kaynakUrl: true,
      baslik: true,
      slug: true,
      kategori: { select: { slug: true } },
    },
  });

  console.log(`${items.length} haber güncellenecek.\n`);

  let matched = 0;
  let fallback = 0;

  for (const item of items) {
    let imageUrl: string | null = null;

    // Try matching by kaynak_url
    if (item.kaynakUrl && linkToImage.has(item.kaynakUrl)) {
      imageUrl = linkToImage.get(item.kaynakUrl) || null;
    }

    const finalUrl = imageUrl || ImageService.getImageForNews(item.kategori.slug, item.baslik, item.slug);
    
    await prisma.haber.update({
      where: { id: item.id },
      data: { gorselUrl: finalUrl },
    });

    if (imageUrl) matched++;
    else fallback++;

    if ((matched + fallback) % 200 === 0) {
      console.log(`[${matched + fallback}/${items.length}] RSS match: ${matched}, picsum fallback: ${fallback}`);
    }
  }

  console.log(`\n=== Tamamlandı ===`);
  console.log(`Toplam: ${items.length} | RSS match: ${matched} | picsum fallback: ${fallback}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Hata:', err);
  process.exit(1);
});
