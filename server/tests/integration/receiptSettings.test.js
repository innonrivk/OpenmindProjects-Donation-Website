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

test('Integration: Receipt Settings API', async (t) => {
  let sysAdminToken = '';

  await t.test('Setup: Get or create SYSADMIN token', async () => {
    let admin = await prisma.user.findFirst({ where: { role: 'SYSADMIN' } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email: 'sysadmin-receipt-test@omp.org',
          firstName: 'Sys',
          lastName: 'Admin',
          role: 'SYSADMIN',
          isActive: true,
        },
      });
    }
    sysAdminToken = jwt.sign(
      { userId: admin.id, email: admin.email, role: 'SYSADMIN', tokenVersion: admin.tokenVersion },
      ADMIN_JWT_SECRET
    );
    assert.ok(sysAdminToken);
  });

  await t.test('GET /admin/receipt-settings - returns array of settings', async () => {
    const res = await fetch(`${BASE_URL}/admin/receipt-settings`, {
      headers: { Authorization: `Bearer ${sysAdminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0);
  });

  await t.test('GET /admin/receipt-settings/:type - returns specific settings', async () => {
    const res = await fetch(`${BASE_URL}/admin/receipt-settings/GLOBAL`, {
      headers: { Authorization: `Bearer ${sysAdminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.donationType, 'GLOBAL');
    assert.ok(data.emailSubjectTemplate);
  });

  await t.test('PUT /admin/receipt-settings/:type - updates settings successfully', async () => {
    const updatedPayload = {
      emailSubjectTemplate: 'Updated Subject for E2E Test',
      pdfThankYouMessage: 'Updated Thank You',
      pdfFooterNote: 'Updated Footer',
      pdfSignatureName: 'Updated Signature',
    };

    const res = await fetch(`${BASE_URL}/admin/receipt-settings/GLOBAL`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sysAdminToken}`,
      },
      body: JSON.stringify(updatedPayload),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.emailSubjectTemplate, updatedPayload.emailSubjectTemplate);
    assert.strictEqual(data.pdfThankYouMessage, updatedPayload.pdfThankYouMessage);
  });

  await t.test('PUT /admin/receipt-settings/:type - returns 400 for validation errors', async () => {
    const res = await fetch(`${BASE_URL}/admin/receipt-settings/GLOBAL`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sysAdminToken}`,
      },
      body: JSON.stringify({
        emailSubjectTemplate: 'a', // too short
        pdfThankYouMessage: 'b',
      }),
    });
    assert.strictEqual(res.status, 400);
  });

  await t.test('POST /admin/receipt-settings/sample-pdf - generates PDF successfully', async () => {
    const res = await fetch(`${BASE_URL}/admin/receipt-settings/sample-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sysAdminToken}`,
      },
      body: JSON.stringify({
        pdfThankYouMessage: 'Thank you for your support!',
        pdfFooterNote: 'Official Receipt',
        pdfSignatureName: 'OMP',
        isRecurring: true,
        tierName: 'Gold Tier',
      }),
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
    const disposition = res.headers.get('content-disposition');
    assert.ok(disposition && disposition.includes('OMP-receipt-sample'));
  });

  await t.test('GET /admin/receipt-settings - returns 401 unauthorized if token missing', async () => {
    const res = await fetch(`${BASE_URL}/admin/receipt-settings`);
    assert.strictEqual(res.status, 401);
  });
});
