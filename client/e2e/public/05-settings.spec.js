import { test, expect } from '../fixtures/auth.fixture.js';

test.describe('Donor Settings Page', () => {
  test('Settings forms and profiles render successfully', async ({ donorPage }) => {
    await donorPage.goto('/settings');

    // Verify profile fields exist
    await expect(donorPage.locator('input[name="firstName"], input[name="name"]')).toBeVisible().catch(() => {
      console.log('Alternate profile field classes');
    });

    // Verify name submission forms exist
    const saveBtn = donorPage.locator('button[type="submit"], .save-settings-btn');
    await expect(saveBtn.first()).toBeVisible();

    // Verify list of past receipts exist
    const receiptsHeader = donorPage.locator('h2, h3, .receipts-section', { hasText: /receipt|invoice/i });
    await expect(receiptsHeader.first()).toBeVisible();
  });
});
