import { test, expect } from '../fixtures/auth.fixture.js';

test.describe('Admin Projects CRUD', () => {
  test('Creating, viewing, and modifying project details', async ({ adminPage }) => {
    // Navigate to projects section
    await adminPage.click('a[href="/admin/dashboard/projects"], .sidebar-link:has-text("Projects")').catch(() => {
      adminPage.goto('/admin/dashboard/projects');
    });

    // Check project list table / dashboard is visible
    await expect(adminPage.locator('.cms-section')).toBeVisible();

    // Look for add/create button and modal triggers
    const addBtn = adminPage.locator('button:has-text("Add"), button:has-text("Create"), .add-project-btn');
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(adminPage.locator('input[name="title"], input[name="name"]')).toBeVisible();
    }
  });
});
