import '../../../server/src/lib/env.js';
import { test as base } from '@playwright/test';
import jwt from 'jsonwebtoken';
import prisma from '../../../server/src/lib/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-admin-secret-DO-NOT-USE-IN-PROD';

export const test = base.extend({
  // Pre-authenticated admin page fixture
  adminPage: async ({ page, context }, use) => {
    // Dynamically retrieve the seeded SYSADMIN user
    const admin = await prisma.user.findFirst({ where: { role: 'SYSADMIN' } });
    if (!admin) {
      throw new Error('SYSADMIN user not found in database to authenticate Playwright E2E fixture.');
    }

    const adminRefreshToken = jwt.sign(
      { userId: admin.id, email: admin.email, role: admin.role, tokenVersion: admin.tokenVersion },
      ADMIN_JWT_SECRET
    );

    await context.addCookies([
      {
        name: 'adminRefreshToken',
        value: adminRefreshToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Strict',
      },
    ]);

    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[Browser ${msg.type().toUpperCase()}]: ${msg.text()}`);
      }
    });
    page.on('pageerror', exception => {
      console.log(`[Browser UNCAUGHT EXCEPTION]: ${exception}`);
    });

    await page.goto('/admin/dashboard');
    await use(page);
  },

  // Pre-authenticated donor page fixture
  donorPage: async ({ page, context }, use) => {
    // Dynamically retrieve or create a DONOR user
    let donor = await prisma.user.findFirst({ where: { role: 'DONOR' } });
    if (!donor) {
      donor = await prisma.user.create({
        data: {
          email: 'donor-test@omp.org',
          firstName: 'Donor',
          lastName: 'Test',
          role: 'DONOR',
          isActive: true,
        },
      });
    }

    const token = jwt.sign(
      { userId: donor.id, email: donor.email },
      JWT_SECRET
    );

    await context.addCookies([
      {
        name: 'token',
        value: token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Strict',
      },
    ]);

    await page.goto('/dashboard');
    await use(page);
  },
});

export { expect } from '@playwright/test';
