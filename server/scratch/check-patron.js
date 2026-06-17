import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const boxes = await prisma.donationBox.findMany({
    include: { tier: true }
  });
  console.log(JSON.stringify(boxes, null, 2));
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
