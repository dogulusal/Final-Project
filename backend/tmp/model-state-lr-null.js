const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const row = await prisma.modelState.findFirst({
      orderBy: { version: 'desc' },
      select: { version: true, lrModelData: true },
    });

    if (!row) {
      console.log(JSON.stringify({ version: null, lr_null: null }));
      return;
    }

    console.log(JSON.stringify({
      version: row.version,
      lr_null: row.lrModelData == null,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
