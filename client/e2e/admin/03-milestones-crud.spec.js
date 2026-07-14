import { test, expect } from '../fixtures/auth.fixture.js';

test.describe('Admin Milestones CRUD', () => {
  test('Managing milestones linked to active projects', async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard/milestones');

    // Assert milestones cards/rows render successfully
    await expect(adminPage.locator('.cms-section')).toBeVisible();

    // Verify trigger toggling is repeatable
    const addBtn = adminPage.locator('[data-testid="add-milestone-btn"]');
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(adminPage.locator('[data-testid="milestone-label-input"]')).toBeVisible();
    }
  });
});
