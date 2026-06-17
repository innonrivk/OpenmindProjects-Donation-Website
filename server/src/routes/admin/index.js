import { Router } from 'express';
import cors from 'cors';
import { requireAdminAuth } from '../../middleware/adminAuth.js';
import authRoutes from './auth.js';
import contentRoutes from './content.js';
import projectRoutes from './projects.js';
import tierRoutes from './tiers.js';
import milestoneRoutes from './milestones.js';
import transactionRoutes from './transactions.js';
import receiptSettingsRoutes from './receiptSettings.js';

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

// Apply requireAdminAuth middleware to all subsequent admin sub-routers
router.use('/content', requireAdminAuth, contentRoutes);
router.use('/projects', requireAdminAuth, projectRoutes);
router.use('/tiers', requireAdminAuth, tierRoutes);
router.use('/milestones', requireAdminAuth, milestoneRoutes);
router.use('/transactions', requireAdminAuth, transactionRoutes);
router.use('/receipt-settings', requireAdminAuth, receiptSettingsRoutes);

export default router;
