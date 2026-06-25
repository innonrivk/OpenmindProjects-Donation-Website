import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const monthlyCutoff = new Date('2025-06-01T00:00:00.000Z');
    
    const resultWithDate = await prisma.$queryRaw`
      SELECT 
        strftime('%Y-%m', created_at / 1000, 'unixepoch') as period, 
        SUM(amount) as total
      FROM transactions 
      WHERE status = 'SUCCEEDED' AND created_at >= ${monthlyCutoff}
      GROUP BY period
    `;
    console.log('Result with Date object:', resultWithDate.length, resultWithDate[0]);

    const resultWithMs = await prisma.$queryRaw`
      SELECT 
        strftime('%Y-%m', created_at / 1000, 'unixepoch') as period, 
        SUM(amount) as total
      FROM transactions 
      WHERE status = 'SUCCEEDED' AND created_at >= ${monthlyCutoff.getTime()}
      GROUP BY period
    `;
    console.log('Result with ms number:', resultWithMs.length, resultWithMs[0]);
  } catch (error) {
    console.error('Error running test query:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
