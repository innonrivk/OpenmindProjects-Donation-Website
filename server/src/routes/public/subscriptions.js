import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  updateSubscription,
  cancelSubscription,
  cancelScheduledSubscription,
  simulateRollover,
  cancelUserTier,
} from '../../controllers/public/subscriptionsController.js';

const router = Router();

/**
 * Route handlers for managing donor recurring subscriptions.
 * Enforces authenticated access using the donor requireAuth middleware.
 */
router.post('/update', requireAuth, updateSubscription);
router.post('/cancel', requireAuth, cancelSubscription);
router.post('/cancel-scheduled', requireAuth, cancelScheduledSubscription);
router.post('/simulate-rollover', requireAuth, simulateRollover);
router.delete('/tiers/:tierId', requireAuth, cancelUserTier);

export default router;
