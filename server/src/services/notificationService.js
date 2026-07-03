import prisma from '../lib/prisma.js';

/**
 * Creates internal notification rows for a batch of admin user IDs.
 *
 * Why batch via createMany? A single SQL statement is far cheaper than
 * N individual inserts, especially during automation triggers that may
 * notify multiple admin roles simultaneously.
 *
 * @param {string[]} userIds - Array of User IDs to notify.
 * @param {string} title - Notification title.
 * @param {string} message - Notification body.
 * @returns {Promise<number>} Count of created notifications.
 */
export async function createInternalNotifications(userIds, title, message) {
  if (!userIds?.length) return 0;

  const result = await prisma.internalNotification.createMany({
    data: userIds.map((userId) => ({ userId, title, message })),
  });

  return result.count;
}

/**
 * Returns the unread notification count for a specific admin user.
 *
 * Why a dedicated function? The bell badge polls this every 30s.
 * Keeping the query isolated enables easy caching later.
 *
 * @param {string} userId - Admin user ID.
 * @returns {Promise<number>} Unread count.
 */
export async function getUnreadCount(userId) {
  return prisma.internalNotification.count({
    where: { userId, isRead: false },
  });
}

/**
 * Returns a paginated list of notifications for an admin user.
 *
 * @param {string} userId - Admin user ID.
 * @param {number} page - 1-indexed page number.
 * @param {number} limit - Items per page.
 * @returns {Promise<{ items: object[], total: number }>}
 */
export async function getNotifications(userId, page = 1, limit = 20) {
  const [items, total] = await Promise.all([
    prisma.internalNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.internalNotification.count({ where: { userId } }),
  ]);

  return { items, total };
}

/**
 * Marks a single notification as read.
 *
 * @param {number} id - Notification ID.
 * @param {string} userId - Owner user ID (for ownership validation).
 * @returns {Promise<object>} Updated notification.
 */
export async function markRead(id, userId) {
  return prisma.internalNotification.update({
    where: { id, userId },
    data: { isRead: true },
  });
}

/**
 * Marks all notifications as read for a given user.
 *
 * @param {string} userId - Admin user ID.
 * @returns {Promise<number>} Count of updated rows.
 */
export async function markAllRead(userId) {
  const result = await prisma.internalNotification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  return result.count;
}
