import { Router } from 'express';
import {
  unreadCount,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../controllers/admin/notificationsController.js';

const router = Router();

/** @route GET /admin/notifications/unread-count */
router.get('/unread-count', unreadCount);

/** @route GET /admin/notifications — paginated list */
router.get('/', listNotifications);

/** @route PUT /admin/notifications/:id/read */
router.put('/:id/read', markNotificationRead);

/** @route PUT /admin/notifications/read-all */
router.put('/read-all', markAllNotificationsRead);

export default router;
