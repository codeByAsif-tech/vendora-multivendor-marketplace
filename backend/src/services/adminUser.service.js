import { User } from '../models/user.model.js';
import { emailTemplates } from '../templates/emails/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ROLES, USER_STATUS, USER_STATUS_VALUES } from '../utils/constants.js';
import { pageMeta, skipFor, statusCounts } from '../utils/pagination.js';
import { searchRegex } from '../utils/text.js';
import { queueEmail } from './email.service.js';
import { disconnectUser } from '../realtime/socket.js';
import { revokeAllSessions } from './token.service.js';

export async function listUsers({ role, status, search, page, limit }) {
  const filter = { role };
  if (status) filter.status = status;
  if (search) {
    const rx = searchRegex(search);
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const [items, total, groups] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skipFor(page, limit)).limit(limit).select('-__v').lean(),
    User.countDocuments(filter),
    User.aggregate([{ $match: { role } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  return {
    items,
    pagination: pageMeta(total, page, limit),
    counts: statusCounts(groups, USER_STATUS_VALUES),
  };
}

/**
 * Block / unblock a customer or seller account.
 * Blocking revokes every refresh token, and `authenticate` rejects the user's
 * remaining access tokens on the next request.
 */
export async function updateUserStatus(id, { status, reason }, admin) {
  if (String(id) === String(admin.id)) {
    throw ApiError.badRequest('You cannot change the status of your own account');
  }

  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === ROLES.ADMIN) throw ApiError.forbidden('Admin accounts cannot be blocked here');
  if (user.status === status) return user;

  user.status = status;
  await user.save({ validateModifiedOnly: true });

  if (status === USER_STATUS.BLOCKED) {
    await revokeAllSessions(user._id);
    disconnectUser(user._id);
    queueEmail(user.email, emailTemplates.accountBlocked({ name: user.name, reason }));
  } else {
    queueEmail(user.email, emailTemplates.accountReactivated({ name: user.name }));
  }

  return user;
}
