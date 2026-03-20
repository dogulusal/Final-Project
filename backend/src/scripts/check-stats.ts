import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const counts = await prisma.haber.groupBy({
        by: ['durum'],
        _count: { id: true }
    });
    console.log('Status Counts:', JSON.stringify(counts, null, 2));
    
    const mlStats = await prisma.haber.aggregate({
        _avg: { mlConfidence: true },
        _count: { id: true },
        where: { mlConfidence: { not: null } }
    });
    console.log('ML Stats:', JSON.stringify(mlStats, null, 2));
}
main().finally(() => prisma.$disconnect());
