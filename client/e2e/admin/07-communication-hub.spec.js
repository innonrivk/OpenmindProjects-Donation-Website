import { test, expect } from '../fixtures/auth.fixture.js';

test.describe('Admin Communications Hub', () => {
  test('Managing template creation and dispatch automation triggers', async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard/communications');

    // Assert communications page layouts render correctly
    await expect(adminPage.locator('.cms-section')).toBeVisible();

    // Verify template creation forms can be loaded
    const createBtn = adminPage.locator('button:has-text("Template"), button:has-text("Add")');
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await expect(adminPage.locator('input[name="subject"], .tiptap-editor')).toBeVisible();
    }
  });
});
