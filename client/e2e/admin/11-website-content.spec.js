import { test, expect } from '../fixtures/auth.fixture.js';

test.describe('Admin Website Content Manager', () => {
  test('Markdown styling copy edit forms rendering', async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard/');

    // Assert content block lists are displayed
    await expect(adminPage.locator('.edit-content-page')).toBeVisible();

    // Verify markdown input triggers are functional
    const editBtn = adminPage.locator('button:has-text("Edit"), .edit-btn');
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await expect(adminPage.locator('textarea, input[type="text"], .tiptap')).toBeVisible();
    }
  });
});
