import { prisma } from '../lib/prisma.js';

export async function listNotifications(userId, { page = 1, limit = 20 } = {}) {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 50); const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
  const [items, total, unread] = await prisma.$transaction([
    prisma.notification.findMany({ where: { userId }, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, meta: { page, limit: take, total, totalPages: Math.ceil(total / take), unread } };
}

export async function markNotificationRead(userId, id) {
  const updated = await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  if (!updated.count) { const error = new Error('Notification not found'); error.statusCode = 404; error.code = 'NOTIFICATION_NOT_FOUND'; throw error; }
}

export async function markAllNotificationsRead(userId) { await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } }); }
