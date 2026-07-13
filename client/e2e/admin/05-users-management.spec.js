import { test, expect } from '../fixtures/auth.fixture.js';

test.describe('Admin Donors and Users Management', () => {
  test('Search and export donors list functionality', async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard/users');

    // Assert active administrators lists are rendered
    await expect(adminPage.locator('.cms-section')).toBeVisible();

    // Verify search / filter inputs exist
    const searchInput = adminPage.locator('input[placeholder*="Search"], .search-input');
    await expect(searchInput.first()).toBeVisible();

    // Verify Excel export button is present
    const exportBtn = adminPage.locator('button:has-text("Export"), .export-btn');
    await expect(exportBtn.first()).toBeVisible();
  });
});
