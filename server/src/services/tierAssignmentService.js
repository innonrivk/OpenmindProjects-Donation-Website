import prisma from '../lib/prisma.js';

/**
 * Recalculates and updates the auto-applied tiers for a user based on their current monthly subscription amount.
 *
 * Why? Ensures that users are automatically assigned to tiers they qualify for based on their monthly rate,
 * while leaving manually assigned tiers unaffected.
 *
 * @param {string} userId - The ID of the user.
 * @param {object} [tx=prisma] - Optional Prisma client or transaction instance.
 * @param {Array} [preFetchedTiers=null] - Optional pre-fetched tiers to avoid N+1 DB hits.
 */
export async function recalculateUserTiers(userId, tx = prisma, preFetchedTiers = null) {
  try {
    // 1. Retrieve the user's current monthly subscription amount and manual tiers
    // Why? We need to calculate the effective auto-tier amount by deducting standalone manual tier costs.
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        monthlyAmount: true,
        userTiers: {
          where: { assignedBy: 'MANUAL' },
          include: { tier: { select: { id: true, minAmount: true, isAutoAppliedBySum: true } } },
        },
      },
    });
    if (!user) return;

    // Deduct standalone manual tier minAmounts from the monthly total.
    // Why? A user who pays $80 base + holds a $66-minAmount standalone tier
    // has a total monthlyAmount of $180, but only $80 of that is "auto-tier qualifying".
    const standaloneTierDeduction = user.userTiers
      .filter(ut => !ut.tier.isAutoAppliedBySum)
      .reduce((sum, ut) => sum + ut.tier.minAmount, 0);

    const effectiveAmount = Math.max(0, user.monthlyAmount - standaloneTierDeduction);

    // 2. Fetch all tiers (use pre-fetched tiers if provided to prevent N+1 queries)
    const tiers = preFetchedTiers || await tx.tier.findMany();

    // 3. Filter auto-applied tiers
    const autoAppliedTiers = tiers.filter(t => t.isAutoAppliedBySum);

    // 4. Find which auto-applied tiers the user qualifies for
    const qualifyingTiers = autoAppliedTiers.filter(t => {
      const meetsMin = effectiveAmount >= t.minAmount;
      const meetsMax = t.maxAmount === null || effectiveAmount <= t.maxAmount;
      return meetsMin && meetsMax;
    });

    // Fetch existing user tiers to avoid querying within a loop
    const existingUserTiers = await tx.userTier.findMany({
      where: { userId },
    });

    // 5. Assign qualifying auto-applied tiers if not already assigned
    for (const tier of qualifyingTiers) {
      const existing = existingUserTiers.find(ut => ut.tierId === tier.id);

      if (!existing) {
        await tx.userTier.create({
          data: {
            userId,
            tierId: tier.id,
            assignedBy: 'AUTO_SUM',
          },
        });
      }
    }

    // 6. Remove auto-assigned tiers that the user no longer qualifies for
    const nonQualifyingTiers = autoAppliedTiers.filter(
      t => !qualifyingTiers.some(q => q.id === t.id)
    );

    if (nonQualifyingTiers.length > 0) {
      await tx.userTier.deleteMany({
        where: {
          userId,
          tierId: { in: nonQualifyingTiers.map(t => t.id) },
          assignedBy: 'AUTO_SUM',
        },
      });
    }
  } catch (error) {
    console.error(`Error recalculating tiers for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Recalculates auto-applied tiers for all users in optimized batches.
 *
 * Why? Useful when tier definitions (thresholds, auto-apply flag) are created, updated, or deleted
 * to keep the database in sync. Uses batching to prevent database thread starvation.
 */
export async function recalculateAllUsersTiers() {
  try {
    const tiers = await prisma.tier.findMany();
    const users = await prisma.user.findMany({
      select: { id: true },
    });

    const batchSize = 20;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      // Note: do NOT pre-fetch userTiers here because userTiers must be queried
      // per-user to accurately fetch and process manual tier deductions.
      await Promise.all(
        batch.map(user => recalculateUserTiers(user.id, prisma, tiers))
      );
    }
    console.log(`✅ Finished recalculating tiers for all ${users.length} users.`);
  } catch (error) {
    console.error('Error recalculating tiers for all users:', error);
  }
}

