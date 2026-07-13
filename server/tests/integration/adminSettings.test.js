import '../../src/lib/env.js';
import { test, after } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import prisma from '../../src/lib/prisma.js';

after(async () => {
  await prisma.$disconnect();
});

const TEST_PORT = process.env.TEST_PORT || '3002';
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-admin-secret-DO-NOT-USE-IN-PROD';

test('Integration: Admin Settings & Auth Profile API', async (t) => {
  let sysAdminToken = '';
  let sysAdminUser = null;

  await t.test('Setup: Get or create SYSADMIN token', async () => {
    sysAdminUser = await prisma.user.findFirst({ where: { role: 'SYSADMIN' } });
    if (!sysAdminUser) {
      sysAdminUser = await prisma.user.create({
        data: {
          email: 'sysadmin-settings-test@omp.org',
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

  await t.test('GET /admin/auth/me - fetches profile details successfully', async () => {
    const res = await fetch(`${BASE_URL}/admin/auth/me`, {
      headers: { Authorization: `Bearer ${sysAdminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.user.email, sysAdminUser.email);
    assert.strictEqual(data.user.role, 'SYSADMIN');
  });

  await t.test('Password Change Flow (Request OTP -> Change Password)', async () => {
    // 1. Request Password Change OTP
    const otpRes = await fetch(`${BASE_URL}/admin/auth/settings/password-otp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sysAdminToken}` },
    });
    assert.strictEqual(otpRes.status, 200);
    const otpData = await otpRes.json();
    assert.strictEqual(otpData.status, 'OTP_SENT');

    // 2. Fetch OTP from DB (safe because we are on PostgreSQL/test env and direct imports are allowed)
    const otpRecord = await prisma.userOtp.findFirst({
      where: { email: sysAdminUser.email, purpose: 'PASSWORD_CHANGE' },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(otpRecord);

    // We can't use bcrypt hashed OTP directly for validation, but we can update the OTP in DB
    // to a known mock plain text, or encrypt it ourselves, but wait!
    // Since bcrypt is used, we can't easily guess the plain text of the randomly generated code.
    // Instead of guessing, we can manually generate our own known code (e.g. '123456') and save its
    // bcrypt hash directly in the database record, then submit '123456' to the API!
    const plainOtp = '123456';
    const hashedOtp = await bcrypt.hash(plainOtp, 12);
    await prisma.userOtp.update({
      where: { id: otpRecord.id },
      data: { otp: hashedOtp },
    });

    // 3. Confirm Password Change
    const changeRes = await fetch(`${BASE_URL}/admin/auth/settings/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sysAdminToken}`,
      },
      body: JSON.stringify({
        otp: plainOtp,
        newPassword: 'new-secure-password-123456',
      }),
    });

    assert.strictEqual(changeRes.status, 200);
    const changeData = await changeRes.json();
    assert.strictEqual(changeData.status, 'PASSWORD_CHANGED');
  });

  await t.test('Email Change Flow (Request OTP -> Verify and Change)', async () => {
    const newEmail = `new-email-${Date.now()}@omp.org`;

    // 1. Request Email Change OTP
    const otpRes = await fetch(`${BASE_URL}/admin/auth/settings/email-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sysAdminToken}`,
      },
      body: JSON.stringify({ newEmail }),
    });
    assert.strictEqual(otpRes.status, 200);
    const otpData = await otpRes.json();
    assert.strictEqual(otpData.status, 'OTP_SENT');

    // 2. Fetch and override OTP from DB for verification
    const otpRecord = await prisma.userOtp.findFirst({
      where: { email: sysAdminUser.email, purpose: 'EMAIL_CHANGE' },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(otpRecord);

    const plainOtp = '654321';
    const hashedOtp = await bcrypt.hash(plainOtp, 12);
    await prisma.userOtp.update({
      where: { id: otpRecord.id },
      data: { otp: hashedOtp },
    });

    // 3. Confirm Email Change
    const changeRes = await fetch(`${BASE_URL}/admin/auth/settings/change-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sysAdminToken}`,
      },
      body: JSON.stringify({ otp: plainOtp }),
    });

    assert.strictEqual(changeRes.status, 200);
    const changeData = await changeRes.json();
    assert.strictEqual(changeData.status, 'EMAIL_CHANGED');
    assert.strictEqual(changeData.user.email, newEmail);

    // Revert user email back to original to avoid disrupting other tests
    await prisma.user.update({
      where: { id: sysAdminUser.id },
      data: { email: sysAdminUser.email },
    });
  });
});
