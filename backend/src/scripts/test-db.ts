
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing DB connection...');
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    console.log('Connection successful:', result);
    
    const categories = await prisma.kategori.findMany();
    console.log('Categories count:', categories.length);

    const newsCount = await prisma.haber.count();
    console.log('Total News count:', newsCount);

    const approvedCount = await prisma.haber.count({ where: { durum: { in: ['hazir', 'yayinda'] } } });
    console.log('Organic Dataset Size (Approved/Ready):', approvedCount);
  } catch (error) {
    console.error('Connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
