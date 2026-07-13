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

test('Integration: Website Content & Donation Box CRUD API', async (t) => {
  let contentAdminToken = '';
  let contentId = null;
  let boxId = null;

  await t.test('Setup: Create CONTENT_ADMIN token', async () => {
    let admin = await prisma.user.findFirst({ where: { role: 'CONTENT_ADMIN' } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email: 'contentadmin-test@omp.org',
          firstName: 'Content',
          lastName: 'Admin',
          role: 'CONTENT_ADMIN',
          isActive: true,
        },
      });
    }
    contentAdminToken = jwt.sign(
      { userId: admin.id, email: admin.email, role: 'CONTENT_ADMIN', tokenVersion: admin.tokenVersion },
      ADMIN_JWT_SECRET
    );
    assert.ok(contentAdminToken);
  });

  await t.test('GET /public/content - returns public contents correctly', async () => {
    const res = await fetch(`${BASE_URL}/public/content`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok('websiteContent' in data);
    assert.ok(Array.isArray(data.donationBoxes));
    assert.ok(Array.isArray(data.projects));
    assert.ok(Array.isArray(data.tiers));
    assert.ok(Array.isArray(data.milestones));
  });

  await t.test('GET /public/content/site-text - returns site text', async () => {
    const res = await fetch(`${BASE_URL}/public/content/site-text`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data === 'object');
  });

  await t.test('PUT /admin/content/site-text - updates site text successfully', async () => {
    const payload = {
      welcome_headline: 'New welcome headline',
      welcome_subheadline: 'New subheadline',
      welcome_hero_intro: 'New hero intro',
      projects_label: 'Proj label',
      projects_title: 'Proj title',
      projects_intro: 'Proj intro',
      boxes_label: 'Box label',
      boxes_title: 'Box title',
      boxes_cta: 'Box cta',
      tiers_label: 'Tier label',
      tiers_title: 'Tier title',
      tiers_intro: 'Tier intro',
      roadmap_label: 'Roadmap label',
      roadmap_title: 'Roadmap title',
      roadmap_intro: 'Roadmap intro',
      impact_label: 'Impact label',
      impact_title: 'Impact title',
      impact_intro: 'Impact intro',
      footer_brand_name: 'Brand name',
      footer_brand_desc: 'Brand desc',
      footer_tagline: 'Tagline',
    };

    const res = await fetch(`${BASE_URL}/admin/content/site-text`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${contentAdminToken}`,
      },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);

    // Verify it persists in public
    const publicRes = await fetch(`${BASE_URL}/public/content/site-text`);
    const publicData = await publicRes.json();
    assert.strictEqual(publicData.welcome_headline, 'New welcome headline');
  });

  await t.test('POST /admin/content - creates WebsiteContent', async () => {
    const res = await fetch(`${BASE_URL}/admin/content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${contentAdminToken}`,
      },
      body: JSON.stringify({
        head: 'Dynamic Head',
        subtitle: 'Dynamic Subtitle',
        body: 'Dynamic Body text content',
        version: 1,
      }),
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    contentId = data.id;
  });

  await t.test('PUT /admin/content/:id - updates WebsiteContent', async () => {
    assert.ok(contentId);
    const res = await fetch(`${BASE_URL}/admin/content/${contentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${contentAdminToken}`,
      },
      body: JSON.stringify({
        head: 'Updated Head',
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.head, 'Updated Head');
  });

  await t.test('DELETE /admin/content/:id - deletes WebsiteContent', async () => {
    assert.ok(contentId);
    const res = await fetch(`${BASE_URL}/admin/content/${contentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${contentAdminToken}` },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.message.includes('successfully'));
  });

  await t.test('POST /admin/content/donation-boxes - creates DonationBox', async () => {
    const res = await fetch(`${BASE_URL}/admin/content/donation-boxes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${contentAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Super Supporter Box',
        amount: 150,
        buttonText: 'Donate $150',
        isCustomAmount: false,
        isRecurring: true,
        isActive: true,
      }),
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    boxId = data.id;
  });

  await t.test('PUT /admin/content/donation-boxes/:id - updates DonationBox', async () => {
    assert.ok(boxId);
    const res = await fetch(`${BASE_URL}/admin/content/donation-boxes/${boxId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${contentAdminToken}`,
      },
      body: JSON.stringify({
        amount: 200,
        buttonText: 'Donate $200',
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.amount, 200);
  });

  await t.test('DELETE /admin/content/donation-boxes/:id - deletes DonationBox', async () => {
    assert.ok(boxId);
    const res = await fetch(`${BASE_URL}/admin/content/donation-boxes/${boxId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${contentAdminToken}` },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.message.includes('successfully'));
  });
});
