import {
  getUnreadCount,
  getNotifications,
  markRead,
  markAllRead,
} from '../../services/notificationService.js';

/**
 * Returns the unread notification count for the authenticated admin.
 */
export async function unreadCount(req, res, next) {
  try {
    const count = await getUnreadCount(req.adminUser.userId);
    return res.json({ count });
  } catch (err) { next(err); }
}

/**
 * Paginated list of notifications for the authenticated admin.
 */
export async function listNotifications(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const result = await getNotifications(req.adminUser.userId, page, limit);
    return res.json({ ...result, page, limit });
  } catch (err) { next(err); }
}

/**
 * Marks a single notification as read.
 */
export async function markNotificationRead(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    await markRead(id, req.adminUser.userId);
    return res.json({ success: true });
  } catch (err) { next(err); }
}

/**
 * Marks all notifications as read for the authenticated admin.
 */
export async function markAllNotificationsRead(req, res, next) {
  try {
    const count = await markAllRead(req.adminUser.userId);
    return res.json({ success: true, updated: count });
  } catch (err) { next(err); }
}
