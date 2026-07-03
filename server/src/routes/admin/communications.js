import { Router } from 'express';
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  archiveTemplate,
  listTriggers,
  createTrigger,
  deleteTrigger,
  dispatchBatch,
  listDispatchLogs,
  getDispatchLog,
  deleteTemplate,
} from '../../controllers/admin/communicationsController.js';

const router = Router();

/** @route GET /admin/communications/templates */
router.get('/templates', listTemplates);

/** @route POST /admin/communications/templates */
router.post('/templates', createTemplate);

/** @route PUT /admin/communications/templates/:id */
router.put('/templates/:id', updateTemplate);

/** @route DELETE /admin/communications/templates/:id — soft archive */
router.delete('/templates/:id', archiveTemplate);

/** @route GET /admin/communications/triggers */
router.get('/triggers', listTriggers);

/** @route POST /admin/communications/triggers */
router.post('/triggers', createTrigger);

/** @route DELETE /admin/communications/triggers/:id */
router.delete('/triggers/:id', deleteTrigger);

/** @route POST /admin/communications/dispatch — manual batch send */
router.post('/dispatch', dispatchBatch);

/** @route GET /admin/communications/dispatch-logs — paginated */
router.get('/dispatch-logs', listDispatchLogs);

/** @route GET /admin/communications/dispatch-logs/:id */
router.get('/dispatch-logs/:id', getDispatchLog);

/** @route DELETE /admin/communications/templates/:id/permanent — permanent delete */
router.delete('/templates/:id/permanent', deleteTemplate);

export default router;
