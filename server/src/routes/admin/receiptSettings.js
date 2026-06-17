import { Router } from 'express';
import {
  getReceiptSettings,
  getReceiptSettingsByType,
  updateReceiptSettings,
} from '../../controllers/admin/receiptSettingsController.js';

const router = Router();

router.get('/', getReceiptSettings);
router.get('/:type', getReceiptSettingsByType);
router.put('/:type', updateReceiptSettings);

export default router;
