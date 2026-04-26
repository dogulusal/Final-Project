const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.modelState.findMany({
      orderBy: { version: 'desc' },
      take: 3,
    });
    console.log(JSON.stringify(rows.map((r) => ({
      id: r.id,
      version: r.version,
      accuracy: r.accuracy,
      sampleCount: r.sampleCount,
      trainedAt: r.trainedAt,
      hasLr: Boolean(r.lrModelData),
    })), null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
