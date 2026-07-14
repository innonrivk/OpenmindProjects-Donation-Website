import { test, expect } from '../fixtures/auth.fixture.js';

test.describe('Admin Communications Hub', () => {
  test('Managing template creation and dispatch automation triggers', async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard/communications');

    // Assert communications page layouts render correctly
    await expect(adminPage.locator('.cms-section')).toBeVisible();

    // Verify template creation forms can be loaded (form is inline)
    await expect(adminPage.locator('[data-testid="template-name-input"]')).toBeVisible();
    await expect(adminPage.locator('.tiptap-editor-container')).toBeVisible();
  });
});
