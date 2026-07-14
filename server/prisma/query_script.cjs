const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: 'file:./dev.db' } } });

async function main() {
  const blocks = await prisma.donationBox.findMany({ include: { tier: true }, orderBy: { displayOrder: 'asc' } });
  const tiers = await prisma.tier.findMany({ orderBy: { tierLevel: 'asc' } });
  const objectives = await prisma.donationMilestone.findMany({ orderBy: { amountUsd: 'asc' } });
  
  console.log('\n=== DONATION BLOCKS ===');
  console.table(blocks.map(b => ({ ID: b.id, Title: b.title, Amount: '$'+b.amount, Tier: b.tier?.name || 'None' })));
  
  console.log('\n=== TIERS ===');
  console.table(tiers.map(t => ({ Level: t.tierLevel, Name: t.name, Min: '$'+t.minAmount })));
  
  console.log('\n=== OBJECTIVES ===');
  console.table(objectives.map(o => ({ Amount: '$'+o.amountUsd, Label: o.label, Repeatable: o.isRepeatable })));
}

main().finally(() => prisma.$disconnect());
