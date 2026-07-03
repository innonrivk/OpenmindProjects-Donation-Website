import '../../src/lib/env.js';
import { test } from 'node:test';
import assert from 'node:assert';
const TEST_PORT = process.env.TEST_PORT || '3002';
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;
// Test clients
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:5174';

test('Integration: Public Endpoints & CORS checks', async (t) => {
  await t.test('GET /public/content returns website data and includes client CORS header', async () => {
    const res = await fetch(`${BASE_URL}/public/content`, {
      headers: { Origin: CLIENT_URL },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.websiteContent);
    assert.ok(Array.isArray(data.donationBoxes));
    assert.ok(Array.isArray(data.projects));

    const allowOrigin = res.headers.get('access-control-allow-origin');
    assert.strictEqual(allowOrigin, CLIENT_URL);
  });

  await t.test('GET /public/content refuses admin origin CORS header', async () => {
    const res = await fetch(`${BASE_URL}/public/content`, {
      headers: { Origin: 'http://malicious-domain.com' },
    });
    const allowOrigin = res.headers.get('access-control-allow-origin');
    assert.notStrictEqual(allowOrigin, 'http://malicious-domain.com');
  });
});

test('Integration: Admin Auth Flow & Protected Routing & CORS checks', async (t) => {
  let adminToken = '';
  let adminRefreshTokenCookie = '';

  await t.test('POST /admin/auth/login succeeds with correct credentials and returns JWT', async () => {
    const res = await fetch(`${BASE_URL}/admin/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ADMIN_URL,
      },
      body: JSON.stringify({
        email: 'admin@openmindprojects.org',
        password: process.env.SEED_ADMIN_PASSWORD || '12345678',
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'LOGGED_IN');
    assert.ok(data.accessToken);
    adminToken = data.accessToken;

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      adminRefreshTokenCookie = setCookie.split(';')[0];
    }

    // Assert CORS headers for admin portal
    const allowOrigin = res.headers.get('access-control-allow-origin');
    assert.strictEqual(allowOrigin, ADMIN_URL);
    const allowCredentials = res.headers.get('access-control-allow-credentials');
    assert.strictEqual(allowCredentials, 'true');
  });

  await t.test('POST /admin/auth/refresh returns new access token with valid refresh cookie', async () => {
    assert.ok(adminRefreshTokenCookie, 'Pre-condition failed: Refresh token cookie was not retrieved.');
    const res = await fetch(`${BASE_URL}/admin/auth/refresh`, {
      method: 'POST',
      headers: {
        Origin: ADMIN_URL,
        Cookie: adminRefreshTokenCookie,
      },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.accessToken);
  });

  await t.test('GET /admin/projects fails with 401 without Bearer token', async () => {
    const res = await fetch(`${BASE_URL}/admin/projects`, {
      headers: {
        Origin: ADMIN_URL,
      },
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'not_authenticated');
  });

  await t.test('GET /admin/projects succeeds with valid Bearer token', async () => {
    assert.ok(adminToken, 'Pre-condition failed: Admin token was not generated.');
    const res = await fetch(`${BASE_URL}/admin/projects`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Origin: ADMIN_URL,
      },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0);
  });

  await t.test('GET /admin/transactions/analytics/donations succeeds with valid Bearer token', async () => {
    assert.ok(adminToken, 'Pre-condition failed: Admin token was not generated.');
    const res = await fetch(`${BASE_URL}/admin/transactions/analytics/donations`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Origin: ADMIN_URL,
      },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.monthly);
    assert.ok(data.yearly);
    assert.ok(data.weekly3m);
    assert.ok(data.biweekly6m);
    assert.strictEqual(data.monthly.length, 12);
    assert.strictEqual(data.yearly.length, 10);
    assert.ok(data.weekly3m.length > 0);
    assert.ok(data.biweekly6m.length > 0);
    
    assert.ok(data.monthly[0].period);
    assert.ok('monthly' in data.monthly[0]);
    assert.ok('oneTime' in data.monthly[0]);
    assert.ok(data.weekly3m[0].period);
    assert.ok('monthly' in data.weekly3m[0]);
    assert.ok('oneTime' in data.weekly3m[0]);
    assert.ok(data.biweekly6m[0].period);
    assert.ok('monthly' in data.biweekly6m[0]);
    assert.ok('oneTime' in data.biweekly6m[0]);
  });

  await t.test('GET /admin/transactions/analytics/donations/download succeeds with valid Bearer token', async () => {
    assert.ok(adminToken, 'Pre-condition failed: Admin token was not generated.');
    const res = await fetch(`${BASE_URL}/admin/transactions/analytics/donations/download`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Origin: ADMIN_URL,
      },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('image/svg+xml'));
    const contentDisposition = res.headers.get('content-disposition');
    assert.ok(contentDisposition && contentDisposition.includes('attachment; filename="donation_chart_'));
  });

  await t.test('GET /admin/transactions/analytics/donations/download?view=MONTHLY_3 succeeds', async () => {
    assert.ok(adminToken, 'Pre-condition failed: Admin token was not generated.');
    const res = await fetch(`${BASE_URL}/admin/transactions/analytics/donations/download?view=MONTHLY_3`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Origin: ADMIN_URL,
      },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('image/svg+xml'));
    const contentDisposition = res.headers.get('content-disposition');
    assert.ok(contentDisposition && contentDisposition.includes('attachment; filename="donation_chart_monthly_3'));
  });

  await t.test('GET /admin/transactions/analytics/donations/download?view=MONTHLY_6 succeeds', async () => {
    assert.ok(adminToken, 'Pre-condition failed: Admin token was not generated.');
    const res = await fetch(`${BASE_URL}/admin/transactions/analytics/donations/download?view=MONTHLY_6`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Origin: ADMIN_URL,
      },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('image/svg+xml'));
    const contentDisposition = res.headers.get('content-disposition');
    assert.ok(contentDisposition && contentDisposition.includes('attachment; filename="donation_chart_monthly_6'));
  });

  await t.test('GET /admin/transactions/export succeeds and returns excel sheet', async () => {
    assert.ok(adminToken, 'Pre-condition failed: Admin token was not generated.');
    const res = await fetch(`${BASE_URL}/admin/transactions/export?donation_type=MONTHLY`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Origin: ADMIN_URL,
      },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
    const contentDisposition = res.headers.get('content-disposition');
    assert.ok(contentDisposition && contentDisposition.includes('attachment; filename="Transactions_Monthly_All-Tiers_'));
    assert.ok(res.headers.get('access-control-expose-headers')?.includes('X-Export-Limit-Hit'));
  });

  await t.test('POST /admin/auth/logout clears the refresh cookie', async () => {
    assert.ok(adminRefreshTokenCookie, 'Pre-condition failed: Refresh token cookie was not retrieved.');
    const res = await fetch(`${BASE_URL}/admin/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Origin: ADMIN_URL,
        Cookie: adminRefreshTokenCookie,
      },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'LOGGED_OUT');

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie && setCookie.includes('adminRefreshToken=;'));
  });
});

test('Integration: Easy Admin Login & Decoupled Token Upgrade Pattern', async (t) => {
  let donorCookie = '';
  let adminToken = '';

  await t.test('POST /public/auth/login succeeds with admin credentials and returns user profile with role: SYSADMIN', async () => {
    const res = await fetch(`${BASE_URL}/public/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@openmindprojects.org',
        password: process.env.SEED_ADMIN_PASSWORD || '12345678',
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'LOGGED_IN');
    assert.strictEqual(data.user.role, 'SYSADMIN');

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Expected public auth token cookie to be set');
    donorCookie = setCookie.split(';')[0];
  });

  await t.test('POST /admin/auth/upgrade fails with 401 when no public session is present', async () => {
    const res = await fetch(`${BASE_URL}/admin/auth/upgrade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    assert.strictEqual(res.status, 401);
  });

  await t.test('POST /admin/auth/upgrade succeeds with valid public admin session and issues admin refresh token cookie + access token', async () => {
    assert.ok(donorCookie, 'Pre-condition failed: Public auth cookie was not retrieved.');
    const res = await fetch(`${BASE_URL}/admin/auth/upgrade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: donorCookie,
      },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'UPGRADED');
    assert.ok(data.accessToken);
    assert.strictEqual(data.user.role, 'SYSADMIN');
    adminToken = data.accessToken;

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie && setCookie.includes('adminRefreshToken='), 'Expected adminRefreshToken cookie to be set');
  });

  await t.test('POST /admin/auth/logout clears both admin and public cookies', async () => {
    assert.ok(adminToken, 'Pre-condition failed: Admin token was not generated.');
    const res = await fetch(`${BASE_URL}/admin/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
    const hasAdminClear = cookies.some(c => c.includes('adminRefreshToken=;'));
    const hasPublicClear = cookies.some(c => c.includes('token=;'));
    assert.ok(hasAdminClear, 'Expected adminRefreshToken cookie to be cleared');
    assert.ok(hasPublicClear, 'Expected public token cookie to be cleared');
  });
});
