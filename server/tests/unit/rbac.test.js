import '../../src/lib/env.js';
import { test, after } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { requirePermission } from '../../src/middleware/rbacAuth.js';
import { requireAdminAuth } from '../../src/middleware/adminAuth.js';
import { PERMISSIONS } from '../../src/config/permissions.js';
import prisma from '../../src/lib/prisma.js';

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-admin-secret-DO-NOT-USE-IN-PROD';

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
}

after(async () => {
  await prisma.$disconnect();
});

test('RBAC Middleware: requirePermission', async (t) => {
  await t.test('returns 403 forbidden when user does not have the required permission', async () => {
    const req = {
      adminUser: {
        userId: 'admin-123',
        role: 'CONTENT_ADMIN', // Content admin cannot view transactions
      },
    };
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    const middleware = requirePermission(PERMISSIONS.CAN_VIEW_TRANSACTIONS);
    await middleware(req, res, next);

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.error, 'forbidden');
    assert.strictEqual(res.body.message.includes('CAN_VIEW_TRANSACTIONS'), true);
    assert.strictEqual(nextCalled, false);
  });

  await t.test('calls next() when user has the required permission', async () => {
    const req = {
      adminUser: {
        userId: 'admin-123',
        role: 'SUPER_ADMIN', // Super admin can view transactions
      },
    };
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    const middleware = requirePermission(PERMISSIONS.CAN_VIEW_TRANSACTIONS);
    await middleware(req, res, next);

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(res.statusCode, 200); // unaffected by next() call
  });
});

test('RBAC Session Invalidation: tokenVersion mismatch', async (t) => {
  await t.test('rejects JWT if its tokenVersion does not match current db tokenVersion', async () => {
    // 1. Ensure a user exists with role SYSADMIN and tokenVersion = 1
    let adminUser = await prisma.user.findFirst({
      where: { email: 'rbac-test-admin@omp.org' },
    });

    if (adminUser) {
      adminUser = await prisma.user.update({
        where: { id: adminUser.id },
        data: { tokenVersion: 1, role: 'SYSADMIN', isActive: true },
      });
    } else {
      adminUser = await prisma.user.create({
        data: {
          email: 'rbac-test-admin@omp.org',
          firstName: 'RBAC',
          lastName: 'Test Admin',
          role: 'SYSADMIN',
          isActive: true,
          tokenVersion: 1,
        },
      });
    }

    // 2. Generate a token with a stale tokenVersion = 0
    const staleToken = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, role: 'SYSADMIN', tokenVersion: 0 },
      ADMIN_JWT_SECRET
    );

    const req = { headers: { authorization: `Bearer ${staleToken}` } };
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    // 3. Execute requireAdminAuth middleware
    await requireAdminAuth(req, res, next);

    // 4. Assert rejection
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, 'invalid_token');
    assert.strictEqual(res.body.message.includes('Session invalidated'), true);
    assert.strictEqual(nextCalled, false);
  });
});
