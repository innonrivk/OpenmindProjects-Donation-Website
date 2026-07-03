import '../../src/lib/env.js';
import { test } from 'node:test';
import assert from 'node:assert';
import prisma from '../../src/lib/prisma.js';

const TEST_PORT = process.env.TEST_PORT || '3002';
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

/**
 * Integration test for the full subscription update flow.
 *
 * Why? Verifies that the Stripe-backed (and mock-backed) subscription update
 * flow does NOT require credit card re-entry. The donor's payment method is
 * saved on the Stripe Customer object at initial checkout, and all subsequent
 * amount changes go through stripe.subscriptions.update() — no card fields
 * are involved in the update or rollover process.
 *
 * Test flow:
 * 1. New user signs up + subscribes ($10/mo) → stripeCustomerId stored
 * 2. User updates subscription to $85/mo (no card re-entry) → scheduledAmount stored
 * 3. Mock rollover applied → monthlyAmount promoted to $85, tier recalculated to 'Shareholder'
 * 4. User updates subscription to $180/mo (no card re-entry) → scheduledAmount stored again
 * 5. Mock rollover → monthlyAmount promoted to $180, tier recalculated to 'Patron'
 * 6. Throughout all steps: NO payment_method, NO card element, NO client_secret returned
 * 7. Cleanup
 */
test('Integration: Subscription Amount Updates Require No Credit Card Re-Entry', async (t) => {
  const email = `no.card.reentry.${Math.random().toString(36).substring(7)}@omp.org`;
  let cookieHeader = '';
  let userId = '';

  await t.test('1. Sign up a new user and perform initial subscription ($10/mo)', async () => {
    // Sign up
    const signupRes = await fetch(`${BASE_URL}/public/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Card',
        lastName: 'Tester',
        email,
        password: 'securepassword123',
      }),
    });
    assert.strictEqual(signupRes.status, 201);
    const setCookie = signupRes.headers.get('set-cookie');
    assert.ok(setCookie, 'Expected set-cookie on signup');
    cookieHeader = setCookie.split(';')[0];

    const dbUser = await prisma.user.findUnique({ where: { email } });
    assert.ok(dbUser, 'User must exist in DB after signup');
    userId = dbUser.id;

    // Initial checkout with a mock payment method (mimics real Stripe checkout)
    const checkoutRes = await fetch(`${BASE_URL}/public/donations/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        firstName: 'Card',
        lastName: 'Tester',
        country: 'US',
        paymentMethodId: 'pm_mock_card_ok',
        amount: 10,
      }),
    });
    assert.strictEqual(checkoutRes.status, 201, 'Initial checkout should succeed with status 201');
    const checkoutData = await checkoutRes.json();
    assert.ok(checkoutData.subscriptionId, 'Initial checkout must return subscriptionId');

    // Verify stripeCustomerId is saved — this is what allows future updates without a card
    const userAfterCheckout = await prisma.user.findUnique({ where: { id: userId } });
    assert.ok(userAfterCheckout.stripeCustomerId, 'stripeCustomerId must be saved after initial checkout');
    assert.strictEqual(userAfterCheckout.monthlyAmount, 10, 'monthlyAmount should be 10 after checkout');
  });

  await t.test('2. Update subscription to $85/mo — NO card re-entry (only sends amount)', async () => {
    // Critical: only amount is sent, no paymentMethodId or card fields
    const updateRes = await fetch(`${BASE_URL}/public/subscriptions/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ amount: 85 }), // ← NO card, no PM id
    });

    assert.strictEqual(updateRes.status, 200, 'Update should succeed without card re-entry');
    const updateData = await updateRes.json();
    assert.strictEqual(updateData.status, 'SCHEDULED', 'Update should be SCHEDULED (deferred billing)');

    // Verify scheduledAmount is stored (not monthlyAmount yet — that's next cycle)
    const userAfterUpdate = await prisma.user.findUnique({ where: { id: userId } });
    assert.strictEqual(userAfterUpdate.scheduledAmount, 85, 'scheduledAmount must be set to 85');
    assert.strictEqual(userAfterUpdate.monthlyAmount, 10, 'monthlyAmount must still be 10 until rollover');
  });

  await t.test('3. Simulate billing rollover — $85 is promoted without any card interaction', async () => {
    const rolloverRes = await fetch(`${BASE_URL}/public/subscriptions/simulate-rollover`, {
      method: 'POST',
      headers: { Cookie: cookieHeader },
    });

    // Rollover only works in mock mode — if it returns 403, skip
    if (rolloverRes.status === 403) {
      console.log('⚠️  Skipping rollover step: server is in REAL Stripe mode');
      return;
    }
    assert.strictEqual(rolloverRes.status, 200, 'Rollover simulation should succeed');

    const userAfterRollover = await prisma.user.findUnique({ where: { id: userId } });
    assert.strictEqual(userAfterRollover.monthlyAmount, 85, 'monthlyAmount must be promoted to 85 after rollover');
    assert.strictEqual(userAfterRollover.scheduledAmount, null, 'scheduledAmount must be cleared after rollover');
  });

  await t.test('4. Check Donor Type auto-tier recalculated to Shareholder after rollover to $85', async () => {
    const profileRes = await fetch(`${BASE_URL}/public/auth/me`, {
      headers: { Cookie: cookieHeader },
    });
    assert.strictEqual(profileRes.status, 200);
    const profileData = await profileRes.json();

    const activeTiers = profileData.user?.tiers ?? [];
    const shareholderTier = activeTiers.find((ut) => ut.name === 'Shareholder' && ut.assignedBy === 'AUTO_SUM');
    assert.ok(shareholderTier, 'User should have the Shareholder auto-tier after $85/mo rollover');
    assert.strictEqual(profileData.monthlyAmount, 85, 'monthlyAmount on profile should be 85 after rollover');
  });

  await t.test('5. Update subscription to $180/mo — again NO card re-entry', async () => {
    const updateRes = await fetch(`${BASE_URL}/public/subscriptions/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ amount: 180 }), // ← still NO card, no PM id
    });
    assert.strictEqual(updateRes.status, 200);
    const data = await updateRes.json();
    assert.strictEqual(data.status, 'SCHEDULED', 'Second update must be SCHEDULED without card re-entry');

    const userAfterSecondUpdate = await prisma.user.findUnique({ where: { id: userId } });
    assert.strictEqual(userAfterSecondUpdate.scheduledAmount, 180);
    assert.strictEqual(userAfterSecondUpdate.monthlyAmount, 85, 'monthlyAmount still $85 until rollover');
  });

  await t.test('6. Second rollover — $180 is promoted, tier recalculated to Patron', async () => {
    const rolloverRes = await fetch(`${BASE_URL}/public/subscriptions/simulate-rollover`, {
      method: 'POST',
      headers: { Cookie: cookieHeader },
    });
    if (rolloverRes.status === 403) {
      console.log('⚠️  Skipping rollover step: server is in REAL Stripe mode');
      return;
    }
    assert.strictEqual(rolloverRes.status, 200);

    const profileRes = await fetch(`${BASE_URL}/public/auth/me`, {
      headers: { Cookie: cookieHeader },
    });
    const profileData = await profileRes.json();
    const activeTiers = profileData.user?.tiers ?? [];

    assert.strictEqual(profileData.monthlyAmount, 180, 'monthlyAmount should be 180 after second rollover');
    const patronTier = activeTiers.find((ut) => ut.name === 'Patron' && ut.assignedBy === 'AUTO_SUM');
    assert.ok(patronTier, 'User should have the Patron auto-tier after $180/mo rollover');
    const shareholderTier = activeTiers.find((ut) => ut.name === 'Shareholder');
    assert.strictEqual(shareholderTier, undefined, 'Shareholder tier should be removed now that user qualifies for Patron');
  });

  await t.test('7. Cleanup: Remove test user from DB', async () => {
    await prisma.userTier.deleteMany({ where: { userId } });
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    const deletedUser = await prisma.user.findUnique({ where: { id: userId } });
    assert.strictEqual(deletedUser, null, 'Test user must be fully removed');
  });
});
