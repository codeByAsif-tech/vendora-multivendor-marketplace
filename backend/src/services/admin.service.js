import { Order } from '../models/order.model.js';
import { Payment } from '../models/payment.model.js';
import { Product } from '../models/product.model.js';
import { SellerProfile } from '../models/sellerProfile.model.js';
import { User } from '../models/user.model.js';
import { PAYMENT_STATUS, PRODUCT_STATUS, ROLES, SELLER_STATUS } from '../utils/constants.js';
import { walletTotals } from './earnings.service.js';
import { collectedTotal } from './payment.service.js';

/** Platform counts for the admin dashboard. Revenue and order metrics arrive in later phases. */
export async function getOverview() {
  const [roleCounts, pendingSellers, approvedSellers, products, pendingProducts, orders] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    SellerProfile.countDocuments({ status: SELLER_STATUS.PENDING }),
    SellerProfile.countDocuments({ status: SELLER_STATUS.APPROVED }),
    Product.countDocuments({ deletedAt: null }),
    Product.countDocuments({ deletedAt: null, status: PRODUCT_STATUS.PENDING }),
    Order.countDocuments(),
  ]);
  const [collected, paymentsToVerify, wallets] = await Promise.all([
    collectedTotal(),
    Payment.countDocuments({ status: PAYMENT_STATUS.PENDING_VERIFICATION }),
    walletTotals(),
  ]);

  const byRole = Object.fromEntries(roleCounts.map(({ _id, count }) => [_id, count]));

  return {
    customers: byRole[ROLES.CUSTOMER] || 0,
    sellers: byRole[ROLES.SELLER] || 0,
    admins: byRole[ROLES.ADMIN] || 0,
    approvedSellers,
    pendingSellers,
    products,
    pendingProducts,
    orders,
    collected, // net money received (paise): online + cash on delivery − refunds
    paymentsToVerify,
    commissionEarned: wallets.totalCommission, // platform share of delivered shipments
    payoutsDue: wallets.available, // seller money ready to be paid out
    sellersDue: wallets.sellersDue,
  };
}
