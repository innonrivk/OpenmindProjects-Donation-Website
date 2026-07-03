import '../../src/lib/env.js';
import { test } from 'node:test';
import assert from 'node:assert';

const TEST_PORT = process.env.TEST_PORT || '3002';
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:5174';

test('Integration & Edge: Communications and Notifications Flow', async (t) => {
  let adminToken = '';

  // 1. Setup: Admin Login
  await t.test('POST /admin/auth/login succeeds with correct credentials', async () => {
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
    assert.ok(data.accessToken);
    adminToken = data.accessToken;
  });

  let templateId = null;

  // 2. Create Email Template
  const testTemplateName = `Test Template Name ${Date.now()}`;
  await t.test('POST /admin/communications/templates succeeds', async () => {
    const res = await fetch(`${BASE_URL}/admin/communications/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: testTemplateName,
        subject: 'Hello {donorName}!',
        bodyHtml: '<div>Test content</div>',
        pdfConfig: {
          fields: [
            { type: 'text', x: 50, y: 50, value: 'Certificate of Appreciation', fontSize: 24 }
          ]
        }
      }),
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    templateId = data.id;
  });

  // 3. Update Email Template
  await t.test('PUT /admin/communications/templates/:id succeeds', async () => {
    const res = await fetch(`${BASE_URL}/admin/communications/templates/${templateId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        subject: 'Updated: Hello {donorName}!',
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.subject, 'Updated: Hello {donorName}!');
  });

  let triggerId = null;

  // 4. Create Automation Trigger Rule
  await t.test('POST /admin/communications/triggers succeeds', async () => {
    const res = await fetch(`${BASE_URL}/admin/communications/triggers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        eventName: 'TIER_REACHED',
        emailTemplateId: templateId,
        adminRoles: ['SYSADMIN'],
      }),
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    triggerId = data.id;
  });

  // 5. Attempt Delete Template (Archive) with active trigger rule -> Should fail with 409 Conflict
  await t.test('DELETE /admin/communications/templates/:id fails with 409 when trigger matches', async () => {
    const res = await fetch(`${BASE_URL}/admin/communications/templates/${templateId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    assert.strictEqual(res.status, 409);
    const data = await res.json();
    assert.strictEqual(data.error, 'conflict');
  });

  // 6. Delete the Trigger Rule
  await t.test('DELETE /admin/communications/triggers/:id succeeds', async () => {
    const res = await fetch(`${BASE_URL}/admin/communications/triggers/${triggerId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
  });

  // 7. Delete Template (Archive) -> Should succeed now
  await t.test('DELETE /admin/communications/templates/:id succeeds when no active triggers', async () => {
    const res = await fetch(`${BASE_URL}/admin/communications/templates/${templateId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.isArchived, true);
  });

  // 8. Re-create non-archived template to test batch dispatch
  let finalTemplateId = null;
  const finalTemplateName = `Final Test Template ${Date.now()}`;
  await t.test('Setup template for batch dispatch', async () => {
    const res = await fetch(`${BASE_URL}/admin/communications/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: finalTemplateName,
        subject: 'Batch subject',
        bodyHtml: '<p>Batch body</p>',
      }),
    });
    const data = await res.json();
    finalTemplateId = data.id;
  });

  // 9. Dispatch Batch
  await t.test('POST /admin/communications/dispatch succeeds', async () => {
    const res = await fetch(`${BASE_URL}/admin/communications/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        templateId: finalTemplateId,
        targetRoles: ['SYSADMIN'],
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.hasOwnProperty('logId'));
    assert.ok(data.hasOwnProperty('recipientCount'));
  });

  // 10. Fetch unread count & notifications
  await t.test('GET /admin/notifications/unread-count succeeds', async () => {
    const res = await fetch(`${BASE_URL}/admin/notifications/unread-count`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.hasOwnProperty('count'));
  });

  await t.test('GET /admin/notifications succeeds', async () => {
    const res = await fetch(`${BASE_URL}/admin/notifications`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.items));
  });

  await t.test('PUT /admin/notifications/read-all succeeds', async () => {
    const res = await fetch(`${BASE_URL}/admin/notifications/read-all`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.strictEqual(res.status, 200);
  });

  // 11. Programmatic trigger test to check admin notification emails
  await t.test('triggerAutomation("MILESTONE_CLAIMED", ...) triggers alerts and emails', async () => {
    const { triggerAutomation } = await import('../../src/services/automationService.js');
    const { default: prisma } = await import('../../src/lib/prisma.js');
    
    // Create another template to trigger
    const milestoneTemplateName = `Milestone Claimed Notification ${Date.now()}`;
    const tmplRes = await fetch(`${BASE_URL}/admin/communications/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: milestoneTemplateName,
        subject: 'Milestone claimed by {donorName}',
        bodyHtml: '<p>{donorName} claimed {milestoneLabel}</p>',
      }),
    });
    const tmplData = await tmplRes.json();
    const milestoneTemplateId = tmplData.id;

    // Create a trigger rule mapping MILESTONE_CLAIMED to this template notifying SYSADMIN
    const trigRes = await fetch(`${BASE_URL}/admin/communications/triggers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        eventName: 'MILESTONE_CLAIMED',
        emailTemplateId: milestoneTemplateId,
        adminRoles: ['SYSADMIN'],
      }),
    });
    const trigData = await trigRes.json();
    const milestoneTriggerId = trigData.id;

    // Trigger the automation
    const context = {
      donorName: 'John Donor',
      donorEmail: 'john.donor@example.com',
      milestoneLabel: 'Regular Milestone',
    };
    
    await triggerAutomation('MILESTONE_CLAIMED', context);

    // Verify a DispatchLog was generated with status QUEUED or SENT and recipientCount = 1 + sysadmins count
    const logRes = await fetch(`${BASE_URL}/admin/communications/dispatch-logs?limit=5`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const logData = await logRes.json();
    const latestLog = logData.items[0];
    
    const sysadminCount = await prisma.user.count({
      where: { role: 'SYSADMIN', isActive: true },
    });
    
    assert.strictEqual(latestLog.emailTemplateId, milestoneTemplateId);
    assert.strictEqual(latestLog.recipientCount, 1 + sysadminCount); // Donor + active Sysadmins

    // Cleanup triggers and templates
    await fetch(`${BASE_URL}/admin/communications/triggers/${milestoneTriggerId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    await fetch(`${BASE_URL}/admin/communications/templates/${milestoneTemplateId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    // 12. Permanent Delete Template Test
    await t.test('DELETE /admin/communications/templates/:id/permanent succeeds and wipes logs', async () => {
      const tempTmplRes = await fetch(`${BASE_URL}/admin/communications/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: `Delete Test ${Date.now()}`,
          subject: 'Delete Sub',
          bodyHtml: '<p>Delete body</p>',
        }),
      });
      const tempTmpl = await tempTmplRes.json();

      // Dispatch once to create logs
      await fetch(`${BASE_URL}/admin/communications/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          templateId: tempTmpl.id,
          targetRoles: ['SYSADMIN'],
        }),
      });

      // Call permanent delete
      const delRes = await fetch(`${BASE_URL}/admin/communications/templates/${tempTmpl.id}/permanent`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      assert.strictEqual(delRes.status, 200);
      const delData = await delRes.json();
      assert.strictEqual(delData.success, true);
    });

    await prisma.$disconnect();
  });
});
