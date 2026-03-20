import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RULES = [
    { keywords: ['nato', 'cumhurbaşkanı', 'akp', 'chp', 'meclis', 'seçim', 'bakan', 'diplomasi', 'siyasi', 'hükümet', 'politika'], category: 'Siyaset' },
    { keywords: ['futbol', 'basketbol', 'cimbom', 'beşiktaş', 'fenerbahçe', 'gol', 'maç', 'stadyum', 'fikstür', 'transfer'], category: 'Spor' },
    { keywords: ['dolar', 'euro', 'faiz', 'merkez bankası', 'enflasyon', 'borsa', 'hisse', 'cari açık', 'ihracat', 'ithalat', 'tcmb'], category: 'Ekonomi' },
    { keywords: ['yapay zeka', 'teknoloji', 'iphone', 'samsung', 'yazılım', 'donanım', 'siber', 'akıllı telefon', 'internet', 'çip'], category: 'Teknoloji' },
    { keywords: ['kanser', 'hastane', 'doktor', 'tedavi', 'grip', 'ilaç', 'sağlık', 'virüs', 'aşı', 'ameliyat'], category: 'Sağlık' }
];

async function main() {
    console.log("=== Heuristic Kategori Düzeltme Başlıyor ===");
    
    const cats = await prisma.kategori.findMany();
    const catMap = cats.reduce((acc, c) => ({ ...acc, [c.ad]: c.id }), {} as any);

    const allNews = await prisma.haber.findMany({
        where: { durum: { in: ['hazir', 'yayinda'] } }
    });

    let fixCount = 0;

    for (const news of allNews) {
        const text = `${news.baslik} ${news.metaAciklama || ''}`.toLowerCase();
        
        let targetCategory = null;
        for (const rule of RULES) {
            if (rule.keywords.some(kw => text.includes(kw))) {
                targetCategory = rule.category;
                break;
            }
        }

        if (targetCategory && catMap[targetCategory] && news.kategoriId !== catMap[targetCategory]) {
            console.log(`[FIX] ID ${news.id}: "${news.baslik.substring(0, 30)}..." -> ${targetCategory} (Eski: ${news.kategoriId})`);
            await prisma.haber.update({
                where: { id: news.id },
                data: { kategoriId: catMap[targetCategory] }
            });
            fixCount++;
        }
    }

    console.log(`=== İşlem Tamamlandı. Toplam Düzeltilen: ${fixCount} ===`);
}

main().finally(() => prisma.$disconnect());
