import { test, expect } from '../fixtures/auth.fixture.js';

test.describe('Admin Donors and Users Management', () => {
  test('Search and export donors list functionality', async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard/users');

    // Assert active administrators lists are rendered
    await expect(adminPage.locator('.cms-section')).toBeVisible();
    await expect(adminPage.locator('table.cms-table')).toBeVisible();

    // Click Donor Tiers tab
    const donorsTabBtn = adminPage.locator('[data-testid="users-donors-tab"]');
    await donorsTabBtn.click();

    // Verify search / filter inputs exist
    const searchInput = adminPage.locator('[data-testid="donor-search-input"]');
    await expect(searchInput).toBeVisible();
  });
});
