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
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-admin-secret-DO-NOT-USE-IN-PROD';

test('Edge: Transaction Export API', async (t) => {
  let operationsAdminToken = '';
  let mockUser = null;
  let mockTransactions = [];

  await t.test('Setup: Create SUPER_ADMIN token and mock transaction data', async () => {
    // 1. Create super admin (has CAN_VIEW_TRANSACTIONS permission)
    let admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email: 'superadmin-export-test@omp.org',
          firstName: 'Super',
          lastName: 'Admin',
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      });
    }
    operationsAdminToken = jwt.sign(
      { userId: admin.id, email: admin.email, role: 'SUPER_ADMIN', tokenVersion: admin.tokenVersion },
      ADMIN_JWT_SECRET
    );

    // 2. Create mock user/transactions to test filtering
    mockUser = await prisma.user.create({
      data: {
        email: `donor-export-${Date.now()}@omp.org`,
        firstName: 'John',
        lastName: 'Doe',
        role: 'DONOR',
        isActive: true,
      },
    });

    const tx1 = await prisma.transaction.create({
      data: {
        userId: mockUser.id,
        amount: 2500, // $25
        isRecurring: true,
        status: 'SUCCEEDED',
        createdAt: new Date('2026-06-01T12:00:00Z'),
      },
    });

    const tx2 = await prisma.transaction.create({
      data: {
        userId: mockUser.id,
        amount: 5000, // $50
        isRecurring: false,
        status: 'SUCCEEDED',
        createdAt: new Date('2026-06-15T12:00:00Z'),
      },
    });

    mockTransactions = [tx1, tx2];
    assert.ok(operationsAdminToken);
    assert.ok(mockUser.id);
  });

  await t.test('GET /admin/transactions/export - exports transactions as Excel sheet successfully', async () => {
    const res = await fetch(`${BASE_URL}/admin/transactions/export`, {
      headers: { Authorization: `Bearer ${operationsAdminToken}` },
    });

    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type');
    assert.ok(contentType && contentType.includes('spreadsheetml.sheet'));
    const disposition = res.headers.get('content-disposition');
    assert.ok(disposition && disposition.includes('attachment; filename="Transactions_'));
  });

  await t.test('GET /admin/transactions/export - filters by donation_type=MONTHLY', async () => {
    const res = await fetch(`${BASE_URL}/admin/transactions/export?donation_type=MONTHLY`, {
      headers: { Authorization: `Bearer ${operationsAdminToken}` },
    });

    assert.strictEqual(res.status, 200);
    const disposition = res.headers.get('content-disposition');
    assert.ok(disposition && disposition.includes('Transactions_Monthly_'));
  });

  await t.test('GET /admin/transactions/export - filters by date range', async () => {
    const res = await fetch(`${BASE_URL}/admin/transactions/export?start_date=2026-06-10&end_date=2026-06-20`, {
      headers: { Authorization: `Bearer ${operationsAdminToken}` },
    });

    assert.strictEqual(res.status, 200);
    const disposition = res.headers.get('content-disposition');
    // Ensure filename includes date range description
    assert.ok(disposition && disposition.includes('2026-06-10_to_2026-06-20'));
  });

  await t.test('GET /admin/transactions/export - returns 401 unauthorized if token missing', async () => {
    const res = await fetch(`${BASE_URL}/admin/transactions/export`);
    assert.strictEqual(res.status, 401);
  });

  after(async () => {
    await prisma.transaction.deleteMany({ where: { userId: mockUser.id } });
    await prisma.user.delete({ where: { id: mockUser.id } });
  });
});
