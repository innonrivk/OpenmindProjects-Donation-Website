import '../../src/lib/env.js';
import { test, after } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import prisma from '../../src/lib/prisma.js';
import { transporter } from '../../src/services/email.js';

after(async () => {
  await prisma.$disconnect();
  if (transporter && typeof transporter.close === 'function') {
    transporter.close();
  }
});

const TEST_PORT = process.env.TEST_PORT || '3002';
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-admin-secret-DO-NOT-USE-IN-PROD';

test('Integration: RBAC Permission Matrix', async (t) => {
  let contentAdminToken = '';
  let sysAdminToken = '';

  // Setup mock users in DB
  await t.test('Setup: Create mock CONTENT_ADMIN and SYSADMIN users', async () => {
    // 1. Content Admin
    let contentAdmin = await prisma.user.findUnique({ where: { email: 'content-admin-test@omp.org' } });
    if (!contentAdmin) {
      contentAdmin = await prisma.user.create({
        data: {
          email: 'content-admin-test@omp.org',
          firstName: 'Content',
          lastName: 'Admin Test',
          role: 'CONTENT_ADMIN',
          isActive: true,
          tokenVersion: 1,
        },
      });
    }
    contentAdminToken = jwt.sign(
      { userId: contentAdmin.id, email: contentAdmin.email, role: 'CONTENT_ADMIN', tokenVersion: 1 },
      ADMIN_JWT_SECRET
    );

    // 2. Sysadmin
    let sysAdmin = await prisma.user.findUnique({ where: { email: 'sys-admin-test@omp.org' } });
    if (!sysAdmin) {
      sysAdmin = await prisma.user.create({
        data: {
          email: 'sys-admin-test@omp.org',
          firstName: 'Sys',
          lastName: 'Admin Test',
          role: 'SYSADMIN',
          isActive: true,
          tokenVersion: 1,
        },
      });
    }
    sysAdminToken = jwt.sign(
      { userId: sysAdmin.id, email: sysAdmin.email, role: 'SYSADMIN', tokenVersion: 1 },
      ADMIN_JWT_SECRET
    );

    assert.ok(contentAdminToken);
    assert.ok(sysAdminToken);
  });

  // CONTENT_ADMIN matrix checks
  await t.test('CONTENT_ADMIN should be allowed to view projects', async () => {
    const res = await fetch(`${BASE_URL}/admin/projects`, {
      headers: { Authorization: `Bearer ${contentAdminToken}` },
    });
    assert.strictEqual(res.status, 200);
  });

  await t.test('CONTENT_ADMIN should be forbidden from viewing transactions', async () => {
    const res = await fetch(`${BASE_URL}/admin/transactions`, {
      headers: { Authorization: `Bearer ${contentAdminToken}` },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error, 'forbidden');
  });

  await t.test('CONTENT_ADMIN should be forbidden from managing users', async () => {
    const res = await fetch(`${BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${contentAdminToken}` },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error, 'forbidden');
  });

  // SYSADMIN matrix checks
  await t.test('SYSADMIN should be allowed to view projects', async () => {
    const res = await fetch(`${BASE_URL}/admin/projects`, {
      headers: { Authorization: `Bearer ${sysAdminToken}` },
    });
    assert.strictEqual(res.status, 200);
  });

  await t.test('SYSADMIN should be allowed to view transactions', async () => {
    const res = await fetch(`${BASE_URL}/admin/transactions`, {
      headers: { Authorization: `Bearer ${sysAdminToken}` },
    });
    // Wait, the transactions endpoint could return 200 or 200 with logs. Let's make sure it returns 200.
    assert.strictEqual(res.status, 200);
  });

  await t.test('SYSADMIN should be allowed to list admin users', async () => {
    const res = await fetch(`${BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${sysAdminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.users));
  });

  // Allowed Admin Emails Feature Integration Checks
  await t.test('Integration: Allowed Admin Emails Pre-Assignment and Promotion Flow', async (subT) => {
    const inviteEmail = 'pre-assigned-invitee@omp.org';
    let allowedEntryId = null;
    let registeredUserId = null;

    // Clean up any existing data first
    await prisma.allowedAdminEmail.deleteMany({ where: { email: inviteEmail } });
    await prisma.user.deleteMany({ where: { email: inviteEmail } });

    await subT.test('1. SYSADMIN adds a pre-assigned invite email', async () => {
      const res = await fetch(`${BASE_URL}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sysAdminToken}`,
        },
        body: JSON.stringify({ email: inviteEmail, role: 'OPERATIONS_ADMIN' }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'SUCCESS');
      assert.strictEqual(data.allowedEmail.email, inviteEmail);
      assert.strictEqual(data.allowedEmail.role, 'OPERATIONS_ADMIN');
    });

    await subT.test('2. Retrieve admins list and verify status is Pending', async () => {
      const res = await fetch(`${BASE_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${sysAdminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      const match = data.users.find((x) => x.email === inviteEmail);
      assert.ok(match);
      assert.strictEqual(match.isPending, true);
      assert.strictEqual(match.role, 'OPERATIONS_ADMIN');
      allowedEntryId = match.id;
    });

    await subT.test('3. Registering the pre-assigned email auto-promotes the user to OPERATIONS_ADMIN', async () => {
      const signupRes = await fetch(`${BASE_URL}/public/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Pre',
          lastName: 'Assigned User',
          email: inviteEmail,
          password: 'Password123!',
        }),
      });
      assert.strictEqual(signupRes.status, 201);
      const signupData = await signupRes.json();
      assert.strictEqual(signupData.status, 'CREATED');
      assert.strictEqual(signupData.user.role, 'OPERATIONS_ADMIN');

      // Double check User table in DB
      const dbUser = await prisma.user.findUnique({ where: { email: inviteEmail } });
      assert.strictEqual(dbUser.role, 'OPERATIONS_ADMIN');
    });

    await subT.test('4. Allowed list shows Registered status', async () => {
      const res = await fetch(`${BASE_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${sysAdminToken}` },
      });
      const data = await res.json();
      const match = data.users.find((x) => x.email === inviteEmail);
      assert.ok(match);
      assert.ok(!match.isPending);
      registeredUserId = match.id;
    });

    await subT.test('5. SYSADMIN is blocked from self-removing or self-demoting from allowed list', async () => {
      const activeSysadminEmail = 'sys-admin-test@omp.org';
      // Try to add active sysadmin email to allowed list
      const addRes = await fetch(`${BASE_URL}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sysAdminToken}`,
        },
        body: JSON.stringify({ email: activeSysadminEmail, role: 'CONTENT_ADMIN' }),
      });
      assert.strictEqual(addRes.status, 400);

      // Find active sysadmin entry if it exists in list, or attempt to delete one
      const listRes = await fetch(`${BASE_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${sysAdminToken}` },
      });
      const listData = await listRes.json();
      const match = listData.users.find((x) => x.email === activeSysadminEmail);
      if (match) {
        const delRes = await fetch(`${BASE_URL}/admin/users/${match.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${sysAdminToken}` },
        });
        assert.strictEqual(delRes.status, 400);
      }
    });

    await subT.test('6. Removing invite demotes registered user back to DONOR', async () => {
      const delRes = await fetch(`${BASE_URL}/admin/users/${registeredUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sysAdminToken}` },
      });
      assert.strictEqual(delRes.status, 200);

      // Verify user has been demoted back to DONOR in DB
      const dbUser = await prisma.user.findUnique({ where: { email: inviteEmail } });
      assert.strictEqual(dbUser.role, 'DONOR');
    });

    // Cleanup after test run
    await prisma.allowedAdminEmail.deleteMany({ where: { email: inviteEmail } });
    await prisma.user.deleteMany({ where: { email: inviteEmail } });
  });

  // Permanent Donor Deletion Check
  await t.test('Integration: Permanent Donor Deletion flow', async (subT) => {
    const donorEmail = 'test-deletable-donor@omp.org';
    let donorId = null;

    await subT.test('1. Setup: Create a new donor user', async () => {
      const signupRes = await fetch(`${BASE_URL}/public/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Deletable',
          lastName: 'Donor',
          email: donorEmail,
          password: 'Password123!',
        }),
      });
      assert.strictEqual(signupRes.status, 201);
      const data = await signupRes.json();
      donorId = data.user.id;
    });

    await subT.test('2. Setup: Add a mock transaction and vote for the donor', async () => {
      // Create mock transaction
      await prisma.transaction.create({
        data: {
          userId: donorId,
          amount: 5000,
          status: 'SUCCEEDED',
        },
      });

      // Find a project and piggybank
      const project = await prisma.projectDetail.findFirst();
      const piggyBank = await prisma.piggyBank.findFirst();
      if (project && piggyBank) {
        await prisma.vote.create({
          data: {
            userId: donorId,
            projectId: project.id,
            piggyBankId: piggyBank.id,
            seedCount: 5,
          },
        });
      }
    });

    await subT.test('3. DELETE /admin/users/donors/:id succeeds', async () => {
      const res = await fetch(`${BASE_URL}/admin/users/donors/${donorId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sysAdminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'SUCCESS');
    });

    await subT.test('4. Verify user and all cascading relations are deleted', async () => {
      const user = await prisma.user.findUnique({ where: { id: donorId } });
      assert.ok(!user);

      const transactions = await prisma.transaction.findMany({ where: { userId: donorId } });
      assert.strictEqual(transactions.length, 0);

      const votes = await prisma.vote.findMany({ where: { userId: donorId } });
      assert.strictEqual(votes.length, 0);
    });

    await prisma.$disconnect();
  });
});

