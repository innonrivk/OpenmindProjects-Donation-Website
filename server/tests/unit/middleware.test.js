import '../../src/lib/env.js';
import { test } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { requireAdminAuth } from '../../src/middleware/adminAuth.js';
import { requireAuth } from '../../src/middleware/auth.js';
import prisma from '../../src/lib/prisma.js';

// Test secrets
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-admin-secret-DO-NOT-USE-IN-PROD';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

// Helpers to create Mock Request, Response, Next objects
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

test('requireAdminAuth middleware tests', async (t) => {
  await t.test('returns 401 when Authorization header is missing', async () => {
    const req = { headers: {} };
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await requireAdminAuth(req, res, next);

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, 'not_authenticated');
    assert.strictEqual(nextCalled, false);
  });

  await t.test('returns 401 when Authorization is not Bearer', async () => {
    const req = { headers: { authorization: 'Basic YWRtaW46cGFzc3dvcmQ=' } };
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await requireAdminAuth(req, res, next);

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, 'not_authenticated');
    assert.strictEqual(nextCalled, false);
  });

  await t.test('returns 401 when Bearer token is invalid/tampered', async () => {
    const req = { headers: { authorization: 'Bearer invalid.token.signature' } };
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await requireAdminAuth(req, res, next);

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, 'invalid_token');
    assert.strictEqual(nextCalled, false);
  });

  await t.test('returns 403 when token is valid but role is not ADMIN', async () => {
    const token = jwt.sign(
      { userId: 'user-123', email: 'donor@gmail.com', role: 'DONOR' },
      ADMIN_JWT_SECRET
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await requireAdminAuth(req, res, next);

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.error, 'forbidden');
    assert.strictEqual(nextCalled, false);
  });

  await t.test('returns 401 when token has expired', async () => {
    const token = jwt.sign(
      { userId: 'admin-123', email: 'admin@omp.org', role: 'SYSADMIN', tokenVersion: 0 },
      ADMIN_JWT_SECRET,
      { expiresIn: '-1s' } // Expired instantly
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await requireAdminAuth(req, res, next);

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, 'invalid_token');
    assert.strictEqual(res.body.message.includes('expired'), true);
    assert.strictEqual(nextCalled, false);
  });

  await t.test('calls next() and attaches user on valid ADMIN token', async () => {
    let adminUser = await prisma.user.findFirst({
      where: { email: 'admin@openmindprojects.org' },
    });

    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: 'admin@openmindprojects.org',
          firstName: 'System',
          lastName: 'Administrator',
          role: 'SYSADMIN',
          isActive: true,
          skipWelcomeEmail: true,
        },
      });
    }

    const token = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, role: 'SYSADMIN', tokenVersion: adminUser.tokenVersion },
      ADMIN_JWT_SECRET
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    await requireAdminAuth(req, res, next);

    assert.strictEqual(nextCalled, true);
    assert.deepStrictEqual(req.adminUser, {
      userId: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    });
  });
});

test('requireAuth (donor) middleware tests', async (t) => {
  await t.test('returns 401 when token cookie is missing', () => {
    const req = { cookies: {} };
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    requireAuth(req, res, next);

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, 'not_authenticated');
    assert.strictEqual(nextCalled, false);
  });

  await t.test('returns 401 when token cookie is invalid/tampered', () => {
    const req = { cookies: { token: 'tampered.donor.cookie' } };
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    requireAuth(req, res, next);

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, 'invalid_token');
    assert.strictEqual(nextCalled, false);
  });

  await t.test('calls next() and attaches user on valid donor cookie', () => {
    const token = jwt.sign(
      { userId: 'donor-789', email: 'donor@omp.org' },
      JWT_SECRET
    );
    const req = { cookies: { token } };
    const res = mockRes();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    requireAuth(req, res, next);

    assert.strictEqual(nextCalled, true);
    assert.deepStrictEqual(req.user, {
      userId: 'donor-789',
      email: 'donor@omp.org',
    });
  });
  
  await prisma.$disconnect();
});
