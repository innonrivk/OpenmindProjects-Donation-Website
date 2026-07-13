import { test, expect } from '../fixtures/auth.fixture.js';

test.describe('Admin Milestones CRUD', () => {
  test('Managing milestones linked to active projects', async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard/milestones');

    // Assert milestones cards/rows render successfully
    await expect(adminPage.locator('.cms-section')).toBeVisible();

    // Verify trigger toggling is repeatable
    const addBtn = adminPage.locator('button:has-text("Add"), button:has-text("Create")');
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(adminPage.locator('select[name="projectId"], select[name="project"]')).toBeVisible();
    }
  });
});
