const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const verified = await prisma.haber.count({ where: { kategoriDogrulandi: true } });
    const states = await prisma.modelState.count();
    console.log(JSON.stringify({ verified, states }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
