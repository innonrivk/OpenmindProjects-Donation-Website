import { Router } from 'express';
import {
  getTransactions,
  getMetrics,
} from '../../controllers/admin/adminTransactionController.js';
import {
  getTransactionDetails,
  updateTransactionMeta,
} from '../../controllers/admin/adminTransactionMetaController.js';
import {
  getDonationAnalytics,
  downloadDonationAnalytics,
} from '../../controllers/admin/adminAnalyticsController.js';
import {
  exportTransactions,
} from '../../controllers/admin/adminTransactionExportController.js';

const router = Router();

router.get('/', getTransactions);
router.get('/metrics', getMetrics);
router.get('/analytics/donations', getDonationAnalytics);
router.get('/analytics/donations/download', downloadDonationAnalytics);
router.get('/export', exportTransactions);
router.get('/:id', getTransactionDetails);
router.patch('/:id', updateTransactionMeta);

export default router;
