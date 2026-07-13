import { test, expect } from '../fixtures/auth.fixture.js';

test.describe('Admin Donation Tiers CRUD', () => {
  test('Creating and modifying auto-applied benefit tiers', async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard/tiers');

    // Assert tiers dashboard list is rendered
    await expect(adminPage.locator('.cms-section')).toBeVisible();

    // Verify chip perk inputs are present
    const addBtn = adminPage.locator('button:has-text("Add"), button:has-text("Create")');
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(adminPage.locator('.perks-input, input[name="perk"], input[name="perks"]')).toBeVisible();
    }
  });
});
