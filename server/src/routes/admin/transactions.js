import { Router } from 'express';
import {
  getTransactions,
  getTransactionDetails,
  getMetrics,
  updateTransactionMeta,
} from '../../controllers/admin/adminTransactionController.js';

const router = Router();

router.get('/', getTransactions);
router.get('/metrics', getMetrics);
router.get('/:id', getTransactionDetails);
router.patch('/:id', updateTransactionMeta);

export default router;
