import { Router } from 'express';
import {
  getReceiptSettings,
  getReceiptSettingsByType,
  updateReceiptSettings,
} from '../../controllers/admin/receiptSettingsController.js';
import { downloadSampleReceipt } from '../../controllers/admin/adminReceiptDownloadController.js';

const router = Router();

router.get('/', getReceiptSettings);
router.post('/sample-pdf', downloadSampleReceipt);
router.get('/:type', getReceiptSettingsByType);
router.put('/:type', updateReceiptSettings);

export default router;
