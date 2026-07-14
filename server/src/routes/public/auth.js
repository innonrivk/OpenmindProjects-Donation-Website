import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  login,
  googleLogin,
  logout,
  getMe,
} from '../../controllers/public/authController.js';
import {
  signup,
  verifyOtp,
} from '../../controllers/public/authUserController.js';
import {
  requestPasswordOtp,
  changePassword,
  requestEmailOtp,
  changeEmail,
  changeName,
  requestDeleteOtp,
  deleteAccount,
} from '../../controllers/public/authProfileController.js';
import { blockProtectedUser } from '../../middleware/blockProtectedUser.js';

const router = Router();

// Authentication
router.post('/signup', signup);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/logout', logout);
router.get('/me', getMe);

// Settings & profile management
router.post('/settings/password-otp', requireAuth, requestPasswordOtp);
router.post('/settings/change-password', requireAuth, changePassword);
router.post('/settings/email-otp', requireAuth, requestEmailOtp);
router.post('/settings/change-email', requireAuth, changeEmail);
router.post('/settings/change-name', requireAuth, changeName);
router.post('/settings/delete-otp', requireAuth, blockProtectedUser, requestDeleteOtp);
router.post('/settings/delete-account', requireAuth, blockProtectedUser, deleteAccount);

export default router;
