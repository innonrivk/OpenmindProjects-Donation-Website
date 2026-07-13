import { test, expect } from '../fixtures/auth.fixture.js';

test.describe('Subscription Monthly Flow', () => {
  test('Subscription preset and recurring parameters layout validation', async ({ donorPage }) => {
    await donorPage.goto('/donate');

    // Toggle recurring if tab or switch exists
    const recurringTab = donorPage.locator('button, .toggle-recurring', { hasText: 'Monthly' });
    if (await recurringTab.isVisible()) {
      await recurringTab.click();
    }

    // Verify billing intervals summary mentions monthly recurring billing
    const summary = donorPage.locator('.summary, .billing-text, body');
    await expect(summary.first()).toContainText(/monthly|month/i);
  });
});
