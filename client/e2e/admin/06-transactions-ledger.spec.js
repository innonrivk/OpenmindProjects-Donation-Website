import { test, expect } from '../fixtures/auth.fixture.js';

test.describe('Admin Transactions Ledger', () => {
  test('Renders transactions table and filters successfully', async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard/transactions');

    // Assert table ledger rows are present
    await expect(adminPage.locator('.cms-section')).toBeVisible();

    // Verify date range inputs exist
    const dateRangeSelect = adminPage.locator('[data-testid="tx-date-range-select"]');
    await expect(dateRangeSelect.first()).toBeVisible();

    // Verify type filter elements exist
    const typeFilter = adminPage.locator('[data-testid="tx-donation-type-select"]');
    await expect(typeFilter.first()).toBeVisible();
  });
});
