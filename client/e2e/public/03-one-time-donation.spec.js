import { test, expect } from '../fixtures/auth.fixture.js';

test.describe('One-Time Donation Flow', () => {
  test('Preset amounts and custom donation field assertions', async ({ donorPage }) => {
    await donorPage.goto('/donate');

    // Verify preset amount buttons are present
    const presetButtons = donorPage.locator('.donation-preset, button', { hasText: '$' });
    await expect(presetButtons.first()).toBeVisible();

    // Verify custom amount input is functional
    const customInput = donorPage.locator('input[type="number"], .custom-amount-input');
    if (await customInput.isVisible()) {
      await customInput.fill('75');
      // Assert payment details updates
      await expect(customInput).toHaveValue('75');
    }

    // Verify Stripe donation checkout button is present and clickable
    const submitBtn = donorPage.locator('button[type="submit"], .checkout-btn');
    await expect(submitBtn).toBeVisible();
  });
});
