import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCategories() {
    const categories = [
        { ad: 'Spor', slug: 'spor', renkKodu: '#1a472a', ikon: '⚽' },
        { ad: 'Ekonomi', slug: 'ekonomi', renkKodu: '#1a2a47', ikon: '💰' },
        { ad: 'Teknoloji', slug: 'teknoloji', renkKodu: '#2d1a47', ikon: '💻' },
        { ad: 'Siyaset', slug: 'siyaset', renkKodu: '#471a1a', ikon: '🏛️' },
        { ad: 'Dünya', slug: 'dunya', renkKodu: '#1a3847', ikon: '🌍' },
        { ad: 'Sağlık', slug: 'saglik', renkKodu: '#47381a', ikon: '🏥' },
        { ad: 'Genel', slug: 'genel', renkKodu: '#2c3e50', ikon: '📰' },
    ];

    console.log('Kategoriler ekleniyor...');
    for (const cat of categories) {
        await prisma.kategori.upsert({
            where: { slug: cat.slug },
            update: {},
            create: cat,
        });
    }
    console.log('Kategoriler başarıyla eklendi!');
    await prisma.$disconnect();
}

seedCategories().catch(console.error);
