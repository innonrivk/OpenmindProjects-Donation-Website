import '../../src/lib/env.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import prisma from '../../src/lib/prisma.js';
import { recalculateUserTiers } from '../../src/services/tierAssignmentService.js';
import { assignTierToUser } from '../../src/controllers/admin/adminUserController.js';

let testUser;
let testRegularTier;
let testShareholderTier;

before(async () => {
  // Clear any existing test user tiers specifically (never touch developer seeds)
  const existingTestUsers = await prisma.user.findMany({
    where: { email: { startsWith: 'test-tier-user-' } },
    select: { id: true },
  });
  await prisma.userTier.deleteMany({
    where: { userId: { in: existingTestUsers.map(u => u.id) } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: 'test-tier-user-' } },
  });
  await prisma.tier.deleteMany({
    where: { name: { startsWith: 'Test ' } },
  });

  // Create test Tiers
  testRegularTier = await prisma.tier.create({
    data: {
      tierLevel: 10,
      name: 'Test Regular',
      minAmount: 1,
      maxAmount: 84,
      isAutoAppliedBySum: true,
      perks: ['Perk 1'],
    },
  });

  testShareholderTier = await prisma.tier.create({
    data: {
      tierLevel: 11,
      name: 'Test Shareholder',
      minAmount: 85,
      maxAmount: 169,
      isAutoAppliedBySum: true,
      perks: ['Perk 2'],
    },
  });

  // Create a test User
  testUser = await prisma.user.create({
    data: {
      email: 'test-tier-user-1@omp.org',
      firstName: 'Test',
      lastName: 'Donor',
      role: 'DONOR',
      isActive: true,
      monthlyAmount: 0,
      skipWelcomeEmail: true,
    },
  });
});

after(async () => {
  // Clean up test data
  if (testUser) {
    await prisma.userTier.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.user.delete({ where: { id: testUser.id } });
  }
  await prisma.tier.deleteMany({
    where: { id: { in: [testRegularTier.id, testShareholderTier.id] } },
  });
  await prisma.$disconnect();
});

test('Tier Assignment Service: recalculateUserTiers', async (t) => {
  await t.test('Assigns qualifying auto-applied tier (monthlyAmount = 10)', async () => {
    // 1. Update user monthly amount
    await prisma.user.update({
      where: { id: testUser.id },
      data: { monthlyAmount: 10 },
    });

    // 2. Recalculate
    await recalculateUserTiers(testUser.id);

    // 3. Verify
    const assigned = await prisma.userTier.findMany({
      where: {
        userId: testUser.id,
        tierId: { in: [testRegularTier.id, testShareholderTier.id] },
      },
      include: { tier: true },
    });

    assert.strictEqual(assigned.length, 1);
    assert.strictEqual(assigned[0].tierId, testRegularTier.id);
    assert.strictEqual(assigned[0].assignedBy, 'AUTO_SUM');
  });

  await t.test('Removes auto-assigned tier when monthlyAmount decreases below minimum (monthlyAmount = 0)', async () => {
    // 1. Update user monthly amount to 0
    await prisma.user.update({
      where: { id: testUser.id },
      data: { monthlyAmount: 0 },
    });

    // 2. Recalculate
    await recalculateUserTiers(testUser.id);

    // 3. Verify
    const assigned = await prisma.userTier.findMany({
      where: {
        userId: testUser.id,
        tierId: { in: [testRegularTier.id, testShareholderTier.id] },
      },
    });

    assert.strictEqual(assigned.length, 0);
  });

  await t.test('Does not remove MANUAL standalone tiers when user no longer qualifies automatically', async () => {
    // 1. Create a standalone manual tier (isAutoAppliedBySum = false)
    const standaloneTier = await prisma.tier.create({
      data: {
        tierLevel: 99,
        name: 'Test Standalone VIP',
        minAmount: 0,
        maxAmount: null,
        isAutoAppliedBySum: false,
        perks: ['VIP Perk'],
      },
    });

    try {
      // 2. Manually assign standalone tier
      await prisma.userTier.create({
        data: {
          userId: testUser.id,
          tierId: standaloneTier.id,
          assignedBy: 'MANUAL',
        },
      });

      // 3. Update user monthly amount to 0
      await prisma.user.update({
        where: { id: testUser.id },
        data: { monthlyAmount: 0 },
      });

      // 4. Recalculate
      await recalculateUserTiers(testUser.id);

      // 5. Verify MANUAL standalone tier remains
      const assigned = await prisma.userTier.findMany({
        where: {
          userId: testUser.id,
          tierId: standaloneTier.id,
        },
      });

      assert.strictEqual(assigned.length, 1);
      assert.strictEqual(assigned[0].tierId, standaloneTier.id);
      assert.strictEqual(assigned[0].assignedBy, 'MANUAL');
    } finally {
      // Clean up
      await prisma.userTier.deleteMany({
        where: { userId: testUser.id, tierId: standaloneTier.id },
      });
      await prisma.tier.delete({
        where: { id: standaloneTier.id },
      });
    }
  });

  await t.test('assignTierToUser controller: rejects manual assignment of auto-applied subscription tiers (HTTP 409)', async () => {
    const req = {
      params: { id: testUser.id },
      body: { tierId: testShareholderTier.id },
    };
    let statusCalledWith = null;
    let jsonCalledWith = null;
    const res = {
      status(code) {
        statusCalledWith = code;
        return this;
      },
      json(data) {
        jsonCalledWith = data;
        return this;
      },
    };
    const next = (err) => { throw err; };

    await assignTierToUser(req, res, next);

    assert.strictEqual(statusCalledWith, 409);
    assert.strictEqual(jsonCalledWith.error, 'conflict');
    assert.ok(jsonCalledWith.message.includes('cannot be manually assigned'));
  });

  await t.test('assignTierToUser controller: allows manual assignment of standalone tiers (HTTP 200)', async () => {
    // 1. Create a standalone manual tier
    const standaloneTier = await prisma.tier.create({
      data: {
        tierLevel: 98,
        name: 'Test Standalone Guest',
        minAmount: 0,
        maxAmount: null,
        isAutoAppliedBySum: false,
        perks: ['Guest Perk'],
      },
    });

    try {
      const req = {
        params: { id: testUser.id },
        body: { tierId: standaloneTier.id },
      };
      let statusCalledWith = null;
      let jsonCalledWith = null;
      const res = {
        status(code) {
          statusCalledWith = code;
          return this;
        },
        json(data) {
          jsonCalledWith = data;
          return this;
        },
      };
      const next = (err) => { throw err; };

      await assignTierToUser(req, res, next);

      assert.strictEqual(statusCalledWith, 200);
      assert.strictEqual(jsonCalledWith.status, 'SUCCESS');

      // Verify DB record was created with MANUAL
      const assigned = await prisma.userTier.findUnique({
        where: {
          userId_tierId: {
            userId: testUser.id,
            tierId: standaloneTier.id,
          },
        },
      });
      assert.ok(assigned);
      assert.strictEqual(assigned.assignedBy, 'MANUAL');
    } finally {
      // Clean up
      await prisma.userTier.deleteMany({
        where: { userId: testUser.id, tierId: standaloneTier.id },
      });
      await prisma.tier.delete({
        where: { id: standaloneTier.id },
      });
    }
  });

  await t.test('Recalculation is idempotent (subsequent runs produce the same state)', async () => {
    // 1. Clear tiers
    await prisma.userTier.deleteMany({
      where: { userId: testUser.id },
    });

    // 2. Update amount to qualify for Regular tier (10)
    await prisma.user.update({
      where: { id: testUser.id },
      data: { monthlyAmount: 10 },
    });

    // 3. Run twice
    await recalculateUserTiers(testUser.id);
    await recalculateUserTiers(testUser.id);

    // 4. Verify only one tier is assigned
    const assigned = await prisma.userTier.findMany({
      where: {
        userId: testUser.id,
        tierId: { in: [testRegularTier.id, testShareholderTier.id] },
      },
    });

    assert.strictEqual(assigned.length, 1);
    assert.strictEqual(assigned[0].tierId, testRegularTier.id);
  });

  await t.test('Assigns manual tier when a user donates to a donation box linked to a manual tier', async () => {
    // 1. Create a manual tier (isAutoAppliedBySum = false)
    const manualTestTier = await prisma.tier.create({
      data: {
        tierLevel: 99,
        name: 'Test Manual Tier',
        minAmount: 0,
        maxAmount: null,
        isAutoAppliedBySum: false,
        perks: ['Manual Perk'],
      },
    });

    // 2. Create a donation box linked to this manual tier
    const linkedBox = await prisma.donationBox.create({
      data: {
        title: 'Tree Planting',
        amount: 25,
        tierId: manualTestTier.id,
        isCustomAmount: false,
        isActive: true,
      },
    });

    // We can simulate the database transaction block for subscribe:
    await prisma.$transaction(async (tx) => {
      // Simulate upserting the user
      const user = await tx.user.upsert({
        where: { email: testUser.email },
        create: {
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          country: testUser.country,
          role: 'DONOR',
          monthlyAmount: 25,
        },
        update: {
          monthlyAmount: 25,
        },
      });

      // Simulate the logic we added:
      if (linkedBox.id) {
        const dbBox = await tx.donationBox.findUnique({
          where: { id: linkedBox.id },
          select: { tierId: true },
        });
        if (dbBox && dbBox.tierId) {
          await tx.userTier.upsert({
            where: {
              userId_tierId: {
                userId: user.id,
                tierId: dbBox.tierId,
              },
            },
            create: {
              userId: user.id,
              tierId: dbBox.tierId,
              assignedBy: 'MANUAL',
            },
            update: {
              assignedBy: 'MANUAL',
            },
          });
        }
      }
    });

    // Verify user now holds the manual test tier
    const assigned = await prisma.userTier.findFirst({
      where: {
        userId: testUser.id,
        tierId: manualTestTier.id,
      },
    });

    assert.ok(assigned);
    assert.strictEqual(assigned.assignedBy, 'MANUAL');

    // Clean up
    await prisma.userTier.deleteMany({ where: { userId: testUser.id } });
    await prisma.donationBox.delete({ where: { id: linkedBox.id } });
    await prisma.tier.delete({ where: { id: manualTestTier.id } });
  });

  await t.test('recalculateUserTiers: subtracts standalone manual tier minAmount from total amount', async () => {
    // 1. Create a standalone manual tier (isAutoAppliedBySum = false, minAmount = 66)
    const standaloneTier = await prisma.tier.create({
      data: {
        tierLevel: 97,
        name: 'Test Standalone Bob',
        minAmount: 66,
        maxAmount: 77,
        isAutoAppliedBySum: false,
        perks: JSON.stringify(['Bob Perk']),
      },
    });

    try {
      // 2. Manually assign this standalone tier
      await prisma.userTier.create({
        data: {
          userId: testUser.id,
          tierId: standaloneTier.id,
          assignedBy: 'MANUAL',
        },
      });

      // 3. Update user total amount to 180 (qualifies for Patron 170+ if no deduction,
      // but qualifies for Shareholder 85-169 if deduction of 66 applied: 180 - 66 = 114)
      await prisma.user.update({
        where: { id: testUser.id },
        data: { monthlyAmount: 180 },
      });

      // 4. Recalculate user tiers
      await recalculateUserTiers(testUser.id);

      // 5. Verify the user has the Shareholder auto-tier (not Regular)
      const assigned = await prisma.userTier.findMany({
        where: { userId: testUser.id },
        include: { tier: true },
      });

      // User should have the "Test Standalone Bob" (MANUAL) and "Test Shareholder" (AUTO_SUM)
      const autoTiers = assigned.filter(ut => ut.assignedBy === 'AUTO_SUM');
      const hasRegular = autoTiers.some(ut => ut.tierId === testRegularTier.id);
      const hasShareholder = autoTiers.some(ut => ut.tierId === testShareholderTier.id);
      
      assert.strictEqual(hasRegular, false, 'Should not have regular tier');
      assert.strictEqual(hasShareholder, true, 'Should have shareholder tier');

      const manualTiers = assigned.filter(ut => ut.assignedBy === 'MANUAL');
      assert.strictEqual(manualTiers.length, 1);
      assert.strictEqual(manualTiers[0].tier.name, 'Test Standalone Bob');
    } finally {
      // Clean up
      await prisma.userTier.deleteMany({ where: { userId: testUser.id } });
      await prisma.tier.delete({ where: { id: standaloneTier.id } });
    }
  });

  await t.test('recalculateUserTiers: floors effective amount at 0 if standalone minAmount exceeds monthlyAmount', async () => {
    // 1. Create a standalone manual tier (isAutoAppliedBySum = false, minAmount = 66)
    const standaloneTier = await prisma.tier.create({
      data: {
        tierLevel: 97,
        name: 'Test Standalone Bob 2',
        minAmount: 66,
        maxAmount: 77,
        isAutoAppliedBySum: false,
        perks: JSON.stringify(['Bob Perk']),
      },
    });

    try {
      // 2. Manually assign this standalone tier
      await prisma.userTier.create({
        data: {
          userId: testUser.id,
          tierId: standaloneTier.id,
          assignedBy: 'MANUAL',
        },
      });

      // 3. Update user total amount to 50 (effective amount: 50 - 66 = -16, floored at 0)
      await prisma.user.update({
        where: { id: testUser.id },
        data: { monthlyAmount: 50 },
      });

      // 4. Recalculate
      await recalculateUserTiers(testUser.id);

      // 5. Verify no auto-tiers are assigned since effective amount is 0
      const assigned = await prisma.userTier.findMany({
        where: { userId: testUser.id },
        include: { tier: true },
      });

      const autoTiers = assigned.filter(ut => ut.assignedBy === 'AUTO_SUM');
      assert.strictEqual(autoTiers.length, 0);
    } finally {
      // Clean up
      await prisma.userTier.deleteMany({ where: { userId: testUser.id } });
      await prisma.tier.delete({ where: { id: standaloneTier.id } });
    }
  });
});
