import { Router } from 'express';
import {
  getTransactions,
  getTransactionDetails,
  getMetrics,
  updateTransactionMeta,
} from '../../controllers/admin/adminTransactionController.js';
import {
  getDonationAnalytics,
  downloadDonationAnalytics,
} from '../../controllers/admin/adminAnalyticsController.js';

const router = Router();

router.get('/', getTransactions);
router.get('/metrics', getMetrics);
router.get('/analytics/donations', getDonationAnalytics);
router.get('/analytics/donations/download', downloadDonationAnalytics);
router.get('/:id', getTransactionDetails);
router.patch('/:id', updateTransactionMeta);

export default router;
