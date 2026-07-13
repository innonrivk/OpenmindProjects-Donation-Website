import { test, expect } from '../fixtures/auth.fixture.js';

test.describe('Admin Receipt Settings', () => {
  test('Branding variables and PDF sample generators validation', async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard/receipts');

    // Assert receipt settings dashboard layout renders correctly
    await expect(adminPage.locator('.cms-section')).toBeVisible();

    // Verify template variables placeholders description section
    await expect(adminPage.locator('body')).toContainText(/variables|subject|placeholder/i);
  });
});
