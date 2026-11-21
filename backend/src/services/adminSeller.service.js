import { Product } from '../models/product.model.js';
import { SellerProfile } from '../models/sellerProfile.model.js';
import { User } from '../models/user.model.js';
import { emailTemplates } from '../templates/emails/index.js';
import { ApiError } from '../utils/ApiError.js';
import {
  ROLES,
  SELLER_STATUS,
  SELLER_STATUS_TRANSITIONS,
  SELLER_STATUS_VALUES,
} from '../utils/constants.js';
import { pageMeta, skipFor, statusCounts } from '../utils/pagination.js';
import { searchRegex } from '../utils/text.js';
import { queueEmail } from './email.service.js';
import { notify } from './notification.service.js';

export async function listSellers({ status, search, page, limit }) {
  const filter = {};
  if (status) filter.status = status;

  if (search) {
    const rx = searchRegex(search);
    const owners = await User.find({ role: ROLES.SELLER, $or: [{ name: rx }, { email: rx }] })
      .select('_id')
      .limit(500)
      .lean();
    filter.$or = [{ storeName: rx }, { user: { $in: owners.map((o) => o._id) } }];
  }

  const [items, total, groups] = await Promise.all([
    SellerProfile.find(filter)
      .sort({ submittedAt: -1 })
      .skip(skipFor(page, limit))
      .limit(limit)
      .select('-statusHistory -__v')
      .populate('user', 'name email phone status')
      .lean(),
    SellerProfile.countDocuments(filter),
    SellerProfile.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  return {
    items,
    pagination: pageMeta(total, page, limit),
    counts: statusCounts(groups, SELLER_STATUS_VALUES),
  };
}

export async function getSeller(id) {
  const profile = await SellerProfile.findById(id)
    .populate('user', 'name email phone status createdAt lastLoginAt')
    .populate('statusHistory.changedBy', 'name role');
  if (!profile) throw ApiError.notFound('Seller not found');

  const productCount = await Product.countDocuments({ store: profile._id, deletedAt: null });
  return { ...profile.toJSON(), productCount };
}

const EMAIL_FOR_STATUS = {
  [SELLER_STATUS.REJECTED]: () => emailTemplates.sellerRejected,
  [SELLER_STATUS.SUSPENDED]: () => emailTemplates.sellerSuspended,
  [SELLER_STATUS.APPROVED]: (previous) =>
    previous === SELLER_STATUS.SUSPENDED ? emailTemplates.sellerReinstated : emailTemplates.sellerApproved,
};

/**
 * Admin decision on a seller. Allowed changes are listed in SELLER_STATUS_TRANSITIONS.
 * Every change is appended to statusHistory and the seller is emailed.
 */
export async function updateSellerStatus(id, { status, reason }, admin) {
  const profile = await SellerProfile.findById(id).populate('user', 'name email');
  if (!profile) throw ApiError.notFound('Seller not found');

  const previous = profile.status;
  if (!SELLER_STATUS_TRANSITIONS[previous].includes(status)) {
    throw ApiError.conflict(`A ${previous} seller cannot be changed to ${status}`, 'INVALID_STATUS_TRANSITION');
  }

  const needsReason = status === SELLER_STATUS.REJECTED || status === SELLER_STATUS.SUSPENDED;
  profile.status = status;
  profile.statusReason = needsReason ? reason : undefined;
  if (status === SELLER_STATUS.APPROVED && !profile.approvedAt) profile.approvedAt = new Date();
  profile.statusHistory.push({ status, reason: reason || undefined, changedBy: admin.id });

  await profile.save();

  const { name, email } = profile.user;
  const template = EMAIL_FOR_STATUS[status](previous);
  queueEmail(email, template({ name, storeName: profile.storeName, reason }));
  const titles = {
    approved: previous === SELLER_STATUS.SUSPENDED ? 'Your store is active again' : 'Your store is approved',
    rejected: 'Your store application needs changes',
    suspended: 'Your store has been suspended',
  };
  notify(profile.user._id, {
    type: `store_${status}`,
    title: titles[status] ?? `Store ${status}`,
    body: reason || (status === SELLER_STATUS.APPROVED ? 'You can now add products and start selling.' : undefined),
    link: status === SELLER_STATUS.APPROVED ? '/seller/dashboard' : '/seller/settings',
  });

  return profile;
}
