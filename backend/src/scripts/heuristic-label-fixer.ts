import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RULES = [
    { keywords: ['cumhurbaşkanı', 'akp', 'chp', 'meclis', 'seçim', 'bakan', 'diplomasi', 'siyasi', 'hükümet', 'politika', 'anayasa', 'parti'], category: 'Siyaset' },
    { keywords: ['nato', 'bm', 'abd', 'avrupa birliği', 'ukrayna', 'israil', 'iran', 'rusya', 'uluslararası', 'g7', 'g20'], category: 'Dünya' },
    { keywords: ['futbol', 'basketbol', 'cimbom', 'beşiktaş', 'fenerbahçe', 'gol', 'maç', 'stadyum', 'fikstür', 'transfer'], category: 'Spor' },
    { keywords: ['dolar', 'euro', 'faiz', 'merkez bankası', 'enflasyon', 'borsa', 'hisse', 'cari açık', 'ihracat', 'ithalat', 'tcmb', 'kredi', 'kur'], category: 'Ekonomi' },
    { keywords: ['yapay zeka', 'teknoloji', 'iphone', 'samsung', 'yazılım', 'donanım', 'siber', 'akıllı telefon', 'internet', 'çip', 'amd', 'nvidia', 'meta', 'google', 'apple', 'mikroçip'], category: 'Teknoloji' },
    { keywords: ['kanser', 'hastane', 'doktor', 'tedavi', 'grip', 'ilaç', 'sağlık', 'virüs', 'aşı', 'ameliyat'], category: 'Sağlık' },
    { keywords: ['trafik kazası', 'cinayet', 'yangın', 'gasp', 'hırsızlık', 'tutuklandı', 'gözaltına', 'itfaiye', 'deprem', 'sel felaketi', 'sele kapıldı', 'doğal afet', 'arama kurtarma', 'kuyumcu soygun', 'çarpıştı', 'devrildi', 'mahkemeye', 'cezaevine'], category: 'Genel' }
];

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    console.log("=== Heuristic Kategori Düzeltme Başlıyor ===");
    if (DRY_RUN) {
        console.log("[MODE] Dry-run etkin. Veritabanında güncelleme yapılmayacak.");
    }
    
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
            if (!DRY_RUN) {
                await prisma.haber.update({
                    where: { id: news.id },
                    data: {
                        kategori: {
                            connect: { id: catMap[targetCategory] }
                        },
                        mlConfidence: null,
                        kategoriDogrulandi: true
                    } as any
                });
            }
            fixCount++;
        }
    }

    console.log(`=== İşlem Tamamlandı. Toplam Etkilenen: ${fixCount} ===`);
}

main().finally(() => prisma.$disconnect());
