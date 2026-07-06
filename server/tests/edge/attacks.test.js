import '../../src/lib/env.js';
import { test } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import prismaPublic from '../../src/lib/prismaPublic.js';

const TEST_PORT = process.env.TEST_PORT || '3002';
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-admin-secret-DO-NOT-USE-IN-PROD';

test('Edge-Case: Token Tampering & Expiry', async (t) => {
  await t.test('Admin route rejects token with invalid signature', async () => {
    // Generate token signed with wrong secret
    const badToken = jwt.sign(
      { userId: 'admin-123', email: 'admin@omp.org', role: 'SYSADMIN', tokenVersion: 0 },
      'wrong-signing-secret'
    );

    const res = await fetch(`${BASE_URL}/admin/projects`, {
      headers: {
        Authorization: `Bearer ${badToken}`,
      },
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'invalid_token');
  });

  await t.test('Admin route rejects expired token', async () => {
    const expiredToken = jwt.sign(
      { userId: 'admin-123', email: 'admin@omp.org', role: 'SYSADMIN', tokenVersion: 0 },
      ADMIN_JWT_SECRET,
      { expiresIn: '-10s' }
    );

    const res = await fetch(`${BASE_URL}/admin/projects`, {
      headers: {
        Authorization: `Bearer ${expiredToken}`,
      },
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'invalid_token');
    assert.ok(data.message.includes('expired'));
  });
});

test('Edge-Case: SQL Injection Safety on Inputs', async (t) => {
  await t.test('Admin login is resilient to SQL injection input values', async () => {
    // Attempt standard login bypass string with a valid email syntax
    const res = await fetch(`${BASE_URL}/admin/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: "injection'or'1'='1@openmindprojects.org",
        password: 'any_password',
      }),
    });

    // SQL injection must either be blocked by Zod (400) or parameterized safely in query returning no user (401)
    assert.ok([400, 401].includes(res.status), `Expected 400 or 401, got ${res.status}`);
    const data = await res.json();
    assert.ok(
      ['validation_error', 'invalid_credentials'].includes(data.error),
      `Expected validation_error or invalid_credentials, got ${data.error}`
    );
  });
});

test('Edge-Case: Mechanical Public Write-Block Guard (Risk A)', async (t) => {
  await t.test('prismaPublic client rejects write attempts on protected models', () => {
    // Try to run a write (update) on a content model
    assert.throws(
      () => {
        prismaPublic.websiteContent.update({
          where: { id: 1 },
          data: { head: 'Hacked!' },
        });
      },
      (err) => {
        return (
          err instanceof Error &&
          err.message.includes('[PUBLIC_GUARD] Write access denied')
        );
      }
    );
  });

  await t.test('prismaPublic client allows read queries on protected models', () => {
    // Try to run a read query (should bind correctly and return a promise, not throw synchronously)
    let threw = false;
    try {
      const promise = prismaPublic.websiteContent.findFirst();
      assert.ok(promise instanceof Promise || typeof promise.then === 'function');
    } catch (err) {
      threw = true;
    }
    assert.strictEqual(threw, false);
  });

  await prismaPublic.$disconnect();
});
