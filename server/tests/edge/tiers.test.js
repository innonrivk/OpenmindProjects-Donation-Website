import '../../src/lib/env.js';
import { test } from 'node:test';
import assert from 'node:assert';
import prisma from '../../src/lib/prisma.js';

const TEST_PORT = process.env.TEST_PORT || '3002';
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

test('Integration & Edge: Tier Calculation Isolation, Self-Cancellation, and Cancellation Cascade', async (t) => {
  const email = `tier.tester.${Math.random().toString(36).substring(7)}@omp.org`;
  let cookieHeader = '';
  let userId = '';
  let standaloneTierId = 0;
  let manualUserTierRelationId = 0;

  await t.test('1. Setup: Sign up a new user', async () => {
    const res = await fetch(`${BASE_URL}/public/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Tier',
        lastName: 'Tester',
        email,
        password: 'securepassword123',
      }),
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.status, 'CREATED');

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Expected set-cookie header on successful signup');
    cookieHeader = setCookie.split(';')[0];

    // Get user id from database directly to set up test case
    const dbUser = await prisma.user.findUnique({
      where: { email },
    });
    assert.ok(dbUser);
    userId = dbUser.id;

    // Perform initial subscription of $10 to assign stripeCustomerId and monthlyAmount
    const checkoutRes = await fetch(`${BASE_URL}/public/donations/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        firstName: 'Tier',
        lastName: 'Tester',
        country: 'US',
        paymentMethodId: 'pm_mock_card_ok',
        amount: 10,
      }),
    });
    assert.strictEqual(checkoutRes.status, 201);
  });

  await t.test('2. Setup: Create a standalone manual tier and assign to user', async () => {
    const tier = await prisma.tier.create({
      data: {
        tierLevel: 98,
        name: 'Test Integration Standalone',
        minAmount: 66,
        maxAmount: null,
        isAutoAppliedBySum: false,
        perks: JSON.stringify(['Integration standalone perks']),
      },
    });
    standaloneTierId = tier.id;

    const userTier = await prisma.userTier.create({
      data: {
        userId,
        tierId: standaloneTierId,
        assignedBy: 'MANUAL',
      },
    });
    manualUserTierRelationId = userTier.id;

    assert.ok(userTier);
  });

  await t.test('3. Update subscription and roll over (Effective Amount Deduction Test)', async () => {
    // 1. Update subscription to $180/mo (mock mode routes write immediately but schedule rollover)
    const updateRes = await fetch(`${BASE_URL}/public/subscriptions/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ amount: 114 }),
    });
    assert.strictEqual(updateRes.status, 200);

    // 2. Simulate billing rollover to commit $180/mo as active and trigger recalculation
    const rolloverRes = await fetch(`${BASE_URL}/public/subscriptions/simulate-rollover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
    });
    assert.strictEqual(rolloverRes.status, 200);

    // 3. Verify user active tiers via profile
    const profileRes = await fetch(`${BASE_URL}/public/auth/me`, {
      headers: { Cookie: cookieHeader },
    });
    assert.strictEqual(profileRes.status, 200);
    const profileData = await profileRes.json();

    // The user has a subscription of $180/mo. But holds a manual standalone tier with minAmount of $66.
    // Effective auto-tier qualifying amount: 180 - 66 = 114.
    // Tiers qualification:
    // - Regular ($1 - $84): No (114 is above maxAmount 84)
    // - Shareholder ($85 - $169): Yes (114 is in range)
    // - Patron ($170+): No (114 is below minAmount 170)
    // Therefore, the user must qualify for Shareholder auto-tier, NOT Patron.
    // Therefore, the user must qualify for Shareholder auto-tier, NOT Patron.
    const activeTiers = profileData.user?.tiers;
    assert.ok(activeTiers);

    const autoTiers = activeTiers.filter((t) => t.assignedBy === 'AUTO_SUM');
    const manualTiers = activeTiers.filter((t) => t.assignedBy === 'MANUAL');

    assert.strictEqual(manualTiers.length, 1);
    assert.strictEqual(manualTiers[0].id, standaloneTierId);

    // Assert the auto-tier is Shareholder (not Patron, which is >= 170)
    const shareholderAutoTier = autoTiers.find((t) => t.name === 'Shareholder');
    assert.ok(shareholderAutoTier, 'User should have auto-assigned Shareholder tier');
    assert.strictEqual(autoTiers.some((t) => t.name === 'Patron'), false, 'User should NOT have Patron auto-tier');
  });

  await t.test('4. Self-cancel manual standalone tier (Recalculation and endpoint test)', async () => {
    // 1. Self-cancel the manual standalone tier
    const cancelRes = await fetch(`${BASE_URL}/public/subscriptions/tiers/${standaloneTierId}`, {
      method: 'DELETE',
      headers: { Cookie: cookieHeader },
    });
    assert.strictEqual(cancelRes.status, 200);

    // 2. Fetch profile to check auto-tier recalculation.
    // Now that the manual standalone tier ($66 minAmount) is gone, the monthly donation is reduced:
    // monthlyAmount is 180 - 66 = 114.
    // Effective amount is 114 - 0 = 114.
    // The user must now automatically qualify for the Shareholder tier (85 - 169).
    const profileRes = await fetch(`${BASE_URL}/public/auth/me`, {
      headers: { Cookie: cookieHeader },
    });
    assert.strictEqual(profileRes.status, 200);
    const profileData = await profileRes.json();

    const activeTiers = profileData.user?.tiers;
    const autoTiers = activeTiers.filter((t) => t.assignedBy === 'AUTO_SUM');
    const manualTiers = activeTiers.filter((t) => t.assignedBy === 'MANUAL');

    // Standalone manual tier must be completely gone
    assert.strictEqual(manualTiers.length, 0);

    // Verify monthly amount was reduced
    assert.strictEqual(profileData.monthlyAmount, 114);

    // Auto-assigned tier must be updated to Shareholder
    const shareholderAutoTier = autoTiers.find((t) => t.name === 'Shareholder');
    assert.ok(shareholderAutoTier, 'User should now hold Shareholder auto-assigned tier');
    assert.strictEqual(autoTiers.some((t) => t.name === 'Patron'), false, 'User should no longer hold Patron tier');
  });

  await t.test('5. Cancel subscription (Cascade delete of manual standalone tiers test)', async () => {
    // 1. Assign manual standalone tier again to verify the cancellation cascade
    // Check if the relation already exists to prevent unique key violation on fast retries
    const existingRelation = await prisma.userTier.findUnique({
      where: {
        userId_tierId: {
          userId,
          tierId: standaloneTierId,
        },
      },
    });
    if (!existingRelation) {
      await prisma.userTier.create({
        data: {
          userId,
          tierId: standaloneTierId,
          assignedBy: 'MANUAL',
        },
      });
    }

    // 2. Perform subscription cancel
    const cancelSubRes = await fetch(`${BASE_URL}/public/subscriptions/cancel`, {
      method: 'POST',
      headers: { Cookie: cookieHeader },
    });
    assert.strictEqual(cancelSubRes.status, 200);

    // 3. Verify user profile.
    // Cancellation should reset monthlyAmount to 0 and cascade-delete all MANUAL tiers.
    const profileRes = await fetch(`${BASE_URL}/public/auth/me`, {
      headers: { Cookie: cookieHeader },
    });
    assert.strictEqual(profileRes.status, 200);
    const profileData = await profileRes.json();

    assert.strictEqual(profileData.monthlyAmount, 0);
    assert.strictEqual(profileData.user?.tiers.length, 0, 'All tiers (auto & manual standalone) must be deleted');
  });

  await t.test('6. Clean up: Delete test tier and user from DB', async () => {
    // Delete user transactions to avoid foreign key violations
    await prisma.transaction.deleteMany({
      where: { userId },
    });
    // Delete user tiers
    await prisma.userTier.deleteMany({
      where: { userId },
    });
    // Delete user
    await prisma.user.delete({
      where: { id: userId },
    });
    // Delete standalone tier
    await prisma.tier.delete({
      where: { id: standaloneTierId },
    });
  });
});
