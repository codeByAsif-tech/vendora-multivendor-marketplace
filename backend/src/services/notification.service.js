import { Notification } from '../models/notification.model.js';
import { emitToUsers } from '../realtime/socket.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { pageMeta, skipFor } from '../utils/pagination.js';

/**
 * Adds an in-app notification for one or more users.
 * Fire-and-forget like emails: call it after the transaction commits, never await it in a request,
 * and a failure is only logged (a missing notification must never break an order).
 */
export function notify(userIds, { type, title, body, link }) {
  const ids = [userIds].flat().filter(Boolean);
  if (!ids.length) return;
  Notification.insertMany(ids.map((user) => ({ user, type, title, body, link })))
    .then((docs) => {
      // Live push to open tabs (the bell, toasts and the affected lists refresh at once).
      for (const doc of docs) emitToUsers(doc.user, 'notification', doc.toJSON());
    })
    .catch((err) => logger.error({ err, type }, 'Could not save notification'));
}

export async function listMine(userId, { unread, page, limit }) {
  const filter = { user: userId };
  if (unread) filter.readAt = null;
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skipFor(page, limit)).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: userId, readAt: null }),
  ]);
  return {
    items: items.map(({ user: _user, __v, ...n }) => n),
    pagination: pageMeta(total, page, limit),
    unreadCount,
  };
}

export async function unreadCount(userId) {
  return Notification.countDocuments({ user: userId, readAt: null });
}

export async function markRead(userId, id) {
  const result = await Notification.updateOne({ _id: id, user: userId, readAt: null }, { $set: { readAt: new Date() } });
  if (!result.matchedCount && !(await Notification.exists({ _id: id, user: userId }))) {
    throw ApiError.notFound('Notification not found');
  }
}

export async function markAllRead(userId) {
  const result = await Notification.updateMany({ user: userId, readAt: null }, { $set: { readAt: new Date() } });
  return result.modifiedCount;
}
