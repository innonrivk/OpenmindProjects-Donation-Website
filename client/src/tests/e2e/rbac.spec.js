import { test, expect } from '@playwright/test';

/**
 * Why Playwright E2E tests? Enforces real-world browser routing behavior and ensures
 * visual guards (like sidebar links) and route guards (react-router guard component)
 * work in unison to prevent unauthorized page exposure.
 */

test.describe('Role-Based Access Control (RBAC) E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to local test setup page
    await page.goto('http://localhost:5173/login');
  });

  /**
   * Why this test? Content Admin has the most restricted view. Checking their sidebar is
   * the fastest way to assert that NavLink filtering is functioning correctly.
   */
  test('Sidebar visibility is filtered for CONTENT_ADMIN', async ({ page }) => {
    // 1. Log in as Content Admin
    await page.fill('input[type="email"]', 'content-admin-test@omp.org');
    await page.fill('input[type="password"]', '12345678');
    await page.click('button[type="submit"]');

    // Wait for admin dashboard redirect
    await expect(page).toHaveURL(/.*\/admin\/dashboard/);

    // 2. Assert that allowed sidebar items are visible
    await expect(page.locator('text=Text edit site')).toBeVisible();
    await expect(page.locator('text=Active Projects')).toBeVisible();

    // 3. Assert that restricted sidebar items are completely absent from DOM (security/UX check)
    await expect(page.locator('text=Transactions')).not.toBeVisible();
    await expect(page.locator('text=Receipt Settings')).not.toBeVisible();
    await expect(page.locator('text=User Management')).not.toBeVisible();
  });

  /**
   * Why this test? Even if a link is hidden, a malicious/curious admin could type
   * the route directly into the URL bar. This checks that the route guard redirects them.
   */
  test('Direct URL navigation to restricted page redirects to default dashboard landing', async ({ page }) => {
    // 1. Log in as Content Admin
    await page.fill('input[type="email"]', 'content-admin-test@omp.org');
    await page.fill('input[type="password"]', '12345678');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/admin\/dashboard/);

    // 2. Force navigate to /transactions route (restricted)
    await page.goto('http://localhost:5173/admin/dashboard/transactions');

    // 3. Assert that user was bounced back to main dashboard landing
    await expect(page).toHaveURL('http://localhost:5173/admin/dashboard');
  });

  /**
   * Why this test? Verifies that a Sysadmin changing another admin's role
   * forces session invalidation on the target user's active browser session
   * due to the tokenVersion validation.
   */
  test('Immediate session invalidation on role update', async ({ page, context }) => {
    // 1. Target admin logs in
    await page.fill('input[type="email"]', 'content-admin-test@omp.org');
    await page.fill('input[type="password"]', '12345678');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/admin\/dashboard/);

    // 2. Open a separate browser tab/context simulating Sysadmin updating their role
    const sysAdminPage = await context.newPage();
    await sysAdminPage.goto('http://localhost:5173/login');
    await sysAdminPage.fill('input[type="email"]', 'sys-admin-test@omp.org');
    await sysAdminPage.fill('input[type="password"]', '12345678');
    await sysAdminPage.click('button[type="submit"]');
    
    // Sysadmin navigates to User Management and changes role of target admin
    await sysAdminPage.goto('http://localhost:5173/admin/dashboard/users');
    await sysAdminPage.selectOption('select >> xpath=//ancestor::tr[contains(., "content-admin-test@omp.org")]//select', 'OPERATIONS_ADMIN');

    // 3. Target admin attempts to fetch data (e.g. click refresh content on dashboard)
    await page.click('text=Text edit site');
    
    // 4. Assert target admin is bounced to login page due to 401 tokenVersion mismatch
    await expect(page).toHaveURL(/.*\/login/);
  });
});
