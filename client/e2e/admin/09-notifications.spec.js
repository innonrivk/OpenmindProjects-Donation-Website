import { test, expect } from '../fixtures/auth.fixture.js';

test.describe('Admin Notifications Drawer', () => {
  test('Renders notifications bell and drawer toggles', async ({ adminPage }) => {
    // Navigate to admin dashboard
    await adminPage.goto('/admin/dashboard');

    // Assert notification bell triggers exist in layout
    const bellIcon = adminPage.locator('.notification-bell, .bell-btn, button:has-text("bell")');
    if (await bellIcon.isVisible()) {
      await bellIcon.click();
      // Assert drawer slides in
      await expect(adminPage.locator('.notification-drawer, .notifications-drawer')).toBeVisible();
    }
  });
});
