import '../../src/lib/env.js';
import { test, after } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import prisma from '../../src/lib/prisma.js';

after(async () => {
  await prisma.$disconnect();
});

const TEST_PORT = process.env.TEST_PORT || '3002';
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

test('Integration: Public Milestones Claim API', async (t) => {
  let donorToken = '';
  let donorUser = null;
  let repeatableMilestone = null;
  let nonRepeatableMilestone = null;

  await t.test('Setup: Create donor user and test milestones', async () => {
    // 1. Create donor
    donorUser = await prisma.user.create({
      data: {
        email: `donor-milestones-${Date.now()}@omp.org`,
        firstName: 'Donor',
        lastName: 'Milestone Test',
        role: 'DONOR',
        isActive: true,
      },
    });

    donorToken = jwt.sign(
      { userId: donorUser.id, email: donorUser.email, role: 'DONOR' },
      JWT_SECRET
    );

    // 2. Create repeatable milestone (checks one-time transactions: isRecurring: false)
    repeatableMilestone = await prisma.donationMilestone.create({
      data: {
        amountUsd: 50,
        label: 'Repeatable E2E Milestone',
        description: 'Spend $50 total one-time',
        isRepeatable: true,
        displayOrder: 100,
      },
    });

    // 3. Create non-repeatable milestone (checks recurring transactions: isRecurring: true)
    nonRepeatableMilestone = await prisma.donationMilestone.create({
      data: {
        amountUsd: 10,
        label: 'Non-Repeatable E2E Milestone',
        description: 'Spend $10 total recurring',
        isRepeatable: false,
        displayOrder: 101,
      },
    });

    assert.ok(donorToken);
    assert.ok(repeatableMilestone.id);
    assert.ok(nonRepeatableMilestone.id);
  });

  await t.test('POST /public/milestones/claim - returns 403 (ineligible) when no transactions exist', async () => {
    const res = await fetch(`${BASE_URL}/public/milestones/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `token=${donorToken}`,
      },
      body: JSON.stringify({
        milestoneId: repeatableMilestone.id,
      }),
    });

    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error, 'not_eligible');
  });

  await t.test('POST /public/milestones/claim - returns 201 (success) for eligible repeatable milestone', async () => {
    // Create eligible one-time transaction (isRecurring: false)
    await prisma.transaction.create({
      data: {
        userId: donorUser.id,
        amount: 5500, // $55 in cents (>= $50 required)
        isRecurring: false,
        status: 'SUCCEEDED',
      },
    });

    const res = await fetch(`${BASE_URL}/public/milestones/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `token=${donorToken}`,
      },
      body: JSON.stringify({
        milestoneId: repeatableMilestone.id,
      }),
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.status, 'CLAIMED');
    assert.ok(data.claimedMilestone);
  });

  await t.test('POST /public/milestones/claim - returns 201 (success) for eligible non-repeatable milestone', async () => {
    // Create eligible recurring transaction (isRecurring: true)
    await prisma.transaction.create({
      data: {
        userId: donorUser.id,
        amount: 1500, // $15 in cents (>= $10 required)
        isRecurring: true,
        status: 'SUCCEEDED',
      },
    });

    const res = await fetch(`${BASE_URL}/public/milestones/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `token=${donorToken}`,
      },
      body: JSON.stringify({
        milestoneId: nonRepeatableMilestone.id,
      }),
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.status, 'CLAIMED');
  });

  await t.test('POST /public/milestones/claim - returns 409 (already claimed) for non-repeatable milestone', async () => {
    const res = await fetch(`${BASE_URL}/public/milestones/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `token=${donorToken}`,
      },
      body: JSON.stringify({
        milestoneId: nonRepeatableMilestone.id,
      }),
    });

    assert.strictEqual(res.status, 409);
    const data = await res.json();
    assert.strictEqual(data.error, 'already_claimed');
  });

  // Cleanup E2E seeded data to keep DB clean
  after(async () => {
    await prisma.claimedMilestone.deleteMany({ where: { userId: donorUser.id } });
    await prisma.transaction.deleteMany({ where: { userId: donorUser.id } });
    await prisma.user.delete({ where: { id: donorUser.id } });
    await prisma.donationMilestone.delete({ where: { id: repeatableMilestone.id } });
    await prisma.donationMilestone.delete({ where: { id: nonRepeatableMilestone.id } });
  });
});
