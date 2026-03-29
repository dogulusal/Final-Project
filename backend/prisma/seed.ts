import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

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
}

async function seedUsers() {
    const adminEmail = 'admin@newsagency.com';
    const adminPassword = 'admin123456'; // Production'da güçlü şifre kullanılmalı
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    console.log('Admin kullanıcı ekleniyor...');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('⚠️  PRODUCTION\'DA ŞIFRE DEĞİŞTİRİN!');

    await prisma.kullanici.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            email: adminEmail,
            sifreHash: hashedPassword,
            ad: 'Admin Kullanıcı',
            tercihKategorileri: ['Spor', 'Teknoloji', 'Genel'],
        },
    });

    console.log('Admin kullanıcı başarıyla eklendi!');
}

async function main() {
    await seedCategories();
    await seedUsers();
    await prisma.$disconnect();
}

main().catch(console.error);
