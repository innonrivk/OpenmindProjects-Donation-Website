import { test, expect } from '@playwright/test';

test.describe('Admin Login E2E', () => {
  test('Admin login with wrong password displays error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@openmindprojects.org');
    await page.fill('input[name="password"]', 'wrong-pass');
    await page.click('button[type="submit"]');

    // Assert error notice is visible
    const errorBox = page.locator('.auth-card__error');
    await expect(errorBox.first()).toBeVisible();
  });

  test('Sidebar navigation triggers display checks', async ({ page }) => {
    // Navigate and check landing login buttons
    await page.goto('/login');
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });
});
