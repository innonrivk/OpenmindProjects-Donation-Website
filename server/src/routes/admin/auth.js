import { Router } from 'express';
import { requireAdminAuth } from '../../middleware/adminAuth.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbacAuth.js';
import { PERMISSIONS } from '../../config/permissions.js';
import {
  adminLogin,
  adminRefresh,
  adminLogout,
  getMe,
  upgradeSession,
} from '../../controllers/admin/adminAuthController.js';
import {
  requestPasswordOtp,
  changePassword,
  requestEmailOtp,
  changeEmail,
} from '../../controllers/admin/adminSettingsController.js';

const router = Router();

/**
 * Publicly accessible admin auth endpoints.
 */
router.post('/login', adminLogin);
router.post('/refresh', adminRefresh);

/**
 * Upgrade regular authenticated session to admin session.
 */
router.post('/upgrade', requireAuth, upgradeSession);

/**
 * Authenticated admin auth endpoints.
 */
router.post('/logout', requireAdminAuth, adminLogout);
router.get('/me', requireAdminAuth, getMe);

/**
 * Authenticated admin settings endpoints.
 */
router.post('/settings/password-otp', requireAdminAuth, requirePermission(PERMISSIONS.CAN_MANAGE_SETTINGS), requestPasswordOtp);
router.post('/settings/change-password', requireAdminAuth, requirePermission(PERMISSIONS.CAN_MANAGE_SETTINGS), changePassword);
router.post('/settings/email-otp', requireAdminAuth, requirePermission(PERMISSIONS.CAN_MANAGE_SETTINGS), requestEmailOtp);
router.post('/settings/change-email', requireAdminAuth, requirePermission(PERMISSIONS.CAN_MANAGE_SETTINGS), changeEmail);

export default router;
