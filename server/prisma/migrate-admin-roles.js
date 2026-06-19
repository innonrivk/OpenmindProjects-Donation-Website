import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Querying existing ADMIN users for migration...');
  
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
  });

  if (admins.length === 0) {
    console.log('ℹ️ No ADMIN users found to migrate.');
    return;
  }

  console.log(`found ${admins.length} legacy ADMIN user(s). Migrating to SYSADMIN...`);

  const result = await prisma.user.updateMany({
    where: { role: 'ADMIN' },
    data: { role: 'SYSADMIN' },
  });

  console.log(`✅ Migration complete. ${result.count} admin user(s) migrated to SYSADMIN.`);
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
