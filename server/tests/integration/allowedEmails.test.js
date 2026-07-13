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

test('Integration: Allowed Emails API', async (t) => {
  let sysAdminToken = '';
  let sysAdminUser = null;
  let testPendingId = '';

  await t.test('Setup: Get or create SYSADMIN token', async () => {
    sysAdminUser = await prisma.user.findFirst({ where: { role: 'SYSADMIN', isProtected: false } });
    if (!sysAdminUser) {
      sysAdminUser = await prisma.user.create({
        data: {
          email: 'sysadmin-allowed-test@omp.org',
          firstName: 'Sys',
          lastName: 'Admin',
          role: 'SYSADMIN',
          isActive: true,
        },
      });
    }
    sysAdminToken = jwt.sign(
      { userId: sysAdminUser.id, email: sysAdminUser.email, role: 'SYSADMIN', tokenVersion: sysAdminUser.tokenVersion },
      ADMIN_JWT_SECRET
    );
    assert.ok(sysAdminToken);
  });

  await t.test('GET /admin/users - returns admin and pending users list', async () => {
    const res = await fetch(`${BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${sysAdminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.users));
    assert.ok(data.users.some(u => u.email === sysAdminUser.email));
  });

  await t.test('POST /admin/users - pre-assign allowed admin email successfully', async () => {
    // Delete existing entry if any
    await prisma.allowedAdminEmail.deleteMany({ where: { email: 'allowed-invite-test@omp.org' } });

    const res = await fetch(`${BASE_URL}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sysAdminToken}`,
      },
      body: JSON.stringify({
        email: 'allowed-invite-test@omp.org',
        role: 'CONTENT_ADMIN',
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'SUCCESS');
    assert.ok(data.allowedEmail);
    assert.strictEqual(data.allowedEmail.email, 'allowed-invite-test@omp.org');
    
    testPendingId = `pending-${data.allowedEmail.id}`;
  });

  await t.test('POST /admin/users - fails for self-invite', async () => {
    const res = await fetch(`${BASE_URL}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sysAdminToken}`,
      },
      body: JSON.stringify({
        email: sysAdminUser.email,
        role: 'CONTENT_ADMIN',
      }),
    });
    assert.strictEqual(res.status, 400);
  });

  await t.test('PATCH /admin/users/:id/role - updates role of pending invitation', async () => {
    assert.ok(testPendingId);
    const res = await fetch(`${BASE_URL}/admin/users/${testPendingId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sysAdminToken}`,
      },
      body: JSON.stringify({
        role: 'OPERATIONS_ADMIN',
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'SUCCESS');
    assert.strictEqual(data.user.role, 'OPERATIONS_ADMIN');
  });

  await t.test('DELETE /admin/users/:id - removes pending invitation', async () => {
    assert.ok(testPendingId);
    const res = await fetch(`${BASE_URL}/admin/users/${testPendingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sysAdminToken}` },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'SUCCESS');

    // Verify it is gone
    const idNum = parseInt(testPendingId.replace('pending-', ''), 10);
    const entry = await prisma.allowedAdminEmail.findUnique({ where: { id: idNum } });
    assert.strictEqual(entry, null);
  });
});
