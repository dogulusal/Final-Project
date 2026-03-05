import { PrismaClient } from '@prisma/client';

// Node.js Best Practice: Prisma Client Singleton
// Avoid creating multiple instances of Prisma Client in development when hot-reloading
export const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export async function connectDB() {
    try {
        await prisma.$connect();
        console.log('[Database] PostgreSQL bağlantısı başarılı.');
    } catch (error) {
        console.error('[Database Error] Veritabanı bağlantı hatası:', error);
        process.exit(1);
    }
}

export async function disconnectDB() {
    await prisma.$disconnect();
}
