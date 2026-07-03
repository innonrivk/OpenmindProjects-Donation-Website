import '../src/lib/env.js';
import prisma from '../src/lib/prisma.js';
import { recalculateUserTiers } from '../src/services/tierAssignmentService.js';

async function run() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`🧹 Starting Tiers Cleanup Script (${isDryRun ? 'DRY RUN' : 'LIVE RUN'})...\n`);

  try {
    // Find all manual assignments for auto-applied tiers
    const manualTiers = await prisma.userTier.findMany({
      where: {
        assignedBy: 'MANUAL',
        tier: {
          isAutoAppliedBySum: true,
        },
      },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            monthlyAmount: true,
          },
        },
        tier: {
          select: {
            name: true,
            minAmount: true,
          },
        },
      },
    });

    if (manualTiers.length === 0) {
      console.log('✅ No manual assignments for auto-applied tiers found.');
      return;
    }

    console.log(`Found ${manualTiers.length} manual assignments to clean up:`);
    for (const record of manualTiers) {
      console.log(`- User: ${record.user.firstName} ${record.user.lastName} (${record.user.email})`);
      console.log(`  Tier: ${record.tier.name} (min amount: $${record.tier.minAmount}/mo, user's current: $${record.user.monthlyAmount}/mo)`);
    }

    if (isDryRun) {
      console.log('\n[DRY RUN] No changes were made to the database.');
      return;
    }

    console.log('\nPurging manual assignments and creating audit logs...');
    
    // We process each deletion so we can create individual AuditLog entries and recalculate user tiers
    let deletedCount = 0;
    const affectedUserIds = new Set();

    for (const record of manualTiers) {
      await prisma.$transaction([
        prisma.userTier.delete({
          where: {
            userId_tierId: {
              userId: record.userId,
              tierId: record.tierId,
            },
          },
        }),
        prisma.auditLog.create({
          data: {
            actorId: 'SYSTEM',
            targetUserId: record.userId,
            action: 'TIER_MANUAL_CLEANUP',
            oldValue: `Manual assignment of auto-sum tier: "${record.tier.name}" (ID: ${record.tierId})`,
            newValue: `Deleted — tier is exclusively owned by subscription sum logic`,
          },
        }),
      ]);
      deletedCount++;
      affectedUserIds.add(record.userId);
    }

    console.log(`Deleted ${deletedCount} user tier records.`);

    console.log('\nRecalculating user tiers for affected users...');
    for (const userId of affectedUserIds) {
      await recalculateUserTiers(userId);
    }

    console.log('✅ Cleanup successfully completed.');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
