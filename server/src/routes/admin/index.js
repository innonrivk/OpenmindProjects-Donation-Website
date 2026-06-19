import { Router } from 'express';
import cors from 'cors';
import { requireAdminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/rbacAuth.js';
import { PERMISSIONS } from '../../config/permissions.js';
import authRoutes from './auth.js';
import contentRoutes from './content.js';
import projectRoutes from './projects.js';
import tierRoutes from './tiers.js';
import milestoneRoutes from './milestones.js';
import transactionRoutes from './transactions.js';
import receiptSettingsRoutes from './receiptSettings.js';
import usersRoutes from './users.js';

const router = Router();

// Per-router CORS for Admin namespace
// Must allow credentials: true so that the adminRefreshToken cookie is successfully sent on refresh
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  process.env.ADMIN_URL || 'http://localhost:5174',
];

router.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Mount auth router first (handles its own requireAdminAuth application internally)
// Why? Ensures authentication endpoints bypass auth requirement checks.
router.use('/auth', authRoutes);

// Apply requireAdminAuth middleware to all subsequent admin sub-routers, combined with specific permission checks
router.use('/content', requireAdminAuth, requirePermission(PERMISSIONS.CAN_EDIT_CONTENT), contentRoutes);
router.use('/projects', requireAdminAuth, requirePermission(PERMISSIONS.CAN_MANAGE_PROJECTS), projectRoutes);
router.use('/tiers', requireAdminAuth, requirePermission(PERMISSIONS.CAN_MANAGE_DONATIONS), tierRoutes);
router.use('/milestones', requireAdminAuth, requirePermission(PERMISSIONS.CAN_MANAGE_DONATIONS), milestoneRoutes);
router.use('/transactions', requireAdminAuth, requirePermission(PERMISSIONS.CAN_VIEW_TRANSACTIONS), transactionRoutes);
router.use('/receipt-settings', requireAdminAuth, requirePermission(PERMISSIONS.CAN_MANAGE_RECEIPTS), receiptSettingsRoutes);
router.use('/users', requireAdminAuth, usersRoutes);

export default router;
