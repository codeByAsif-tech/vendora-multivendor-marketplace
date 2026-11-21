import { Coupon, CouponRedemption } from '../models/coupon.model.js';
import { Order } from '../models/order.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ORDER_STATUS } from '../utils/constants.js';
import { pageMeta, skipFor } from '../utils/pagination.js';
import { searchRegex } from '../utils/text.js';

const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const invalid = (message) => new ApiError(400, message, [{ field: 'code', message }], 'COUPON_INVALID');

/** Discount (paise) a coupon gives on an item subtotal. Never more than the subtotal. */
export function discountFor(coupon, subtotal) {
  const raw = coupon.type === 'percent' ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
  const capped = coupon.type === 'percent' && coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
  return Math.max(0, Math.min(capped, subtotal));
}

/** Short text for the customer, e.g. "10% off (up to ₹200) on orders above ₹999". */
export function describe(coupon) {
  const off = coupon.type === 'percent' ? `${coupon.value}% off` : `${rupees(coupon.value)} off`;
  const cap = coupon.type === 'percent' && coupon.maxDiscount ? ` (up to ${rupees(coupon.maxDiscount)})` : '';
  const min = coupon.minOrderValue ? ` on orders above ${rupees(coupon.minOrderValue)}` : '';
  return `${off}${cap}${min}`;
}

/**
 * Checks every rule and returns { coupon, discount }; throws COUPON_INVALID with a reason the customer can act on.
 * Runs when applying, on every cart read, and again inside the checkout transaction.
 */
export async function evaluate(code, userId, subtotal, session) {
  const coupon = await Coupon.findOne({ code: String(code).trim().toUpperCase() }).session(session ?? null);
  const now = new Date();
  if (!coupon || !coupon.isActive) throw invalid('This coupon code is not valid');
  if (coupon.startsAt && coupon.startsAt > now) throw invalid('This coupon is not active yet');
  if (coupon.endsAt && coupon.endsAt < now) throw invalid('This coupon has expired');
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw invalid('This coupon has been fully used');
  if (subtotal < coupon.minOrderValue) {
    throw invalid(`Add items worth ${rupees(coupon.minOrderValue - subtotal)} more to use this coupon`);
  }

  const used = await CouponRedemption.countDocuments({ coupon: coupon._id, user: userId }).session(session ?? null);
  if (used >= coupon.perUserLimit) throw invalid('You have already used this coupon');

  if (coupon.firstOrderOnly) {
    const ordered = await Order.exists({ customer: userId, status: { $ne: ORDER_STATUS.CANCELLED } }).session(session ?? null);
    if (ordered) throw invalid('This coupon is only for your first order');
  }

  const discount = discountFor(coupon, subtotal);
  if (discount <= 0) throw invalid('This coupon gives no discount on this cart');
  return { coupon, discount };
}

/**
 * Inside the checkout transaction: counts the use. The conditional update means two customers
 * using the last remaining slot at once cannot both get it.
 */
export async function redeem({ coupon, discount }, { userId, orderId }, session) {
  const filter = { _id: coupon._id, isActive: true };
  if (coupon.usageLimit) filter.usedCount = { $lt: coupon.usageLimit };
  const result = await Coupon.updateOne(filter, { $inc: { usedCount: 1 } }, { session });
  if (result.modifiedCount !== 1) throw invalid('This coupon has just been fully used');
  await CouponRedemption.create([{ coupon: coupon._id, user: userId, order: orderId, discount }], { session });
}

/** The whole order was cancelled: give the coupon use back. Safe to call more than once. */
export async function releaseForOrder(orderId, session) {
  const redemption = await CouponRedemption.findOneAndDelete({ order: orderId }, { session });
  if (redemption) await Coupon.updateOne({ _id: redemption.coupon, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }, { session });
}

/**
 * Splits the order discount across shipments in proportion to their item subtotal.
 * Rounding leftovers go to the largest shipment, so the shares always add up exactly.
 */
export function splitDiscount(discount, subtotals) {
  const total = subtotals.reduce((a, b) => a + b, 0);
  if (!discount || !total) return subtotals.map(() => 0);
  const shares = subtotals.map((s) => Math.floor((discount * s) / total));
  const largest = subtotals.indexOf(Math.max(...subtotals));
  shares[largest] += discount - shares.reduce((a, b) => a + b, 0);
  return shares;
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export async function listCoupons({ status, search, page, limit }) {
  const filter = {};
  const now = new Date();
  if (status === 'active') Object.assign(filter, { isActive: true, $or: [{ endsAt: null }, { endsAt: { $gte: now } }] });
  if (status === 'expired') filter.endsAt = { $lt: now };
  if (status === 'disabled') filter.isActive = false;
  if (search) filter.code = searchRegex(search.toUpperCase());

  const [items, total] = await Promise.all([
    Coupon.find(filter).sort({ createdAt: -1 }).skip(skipFor(page, limit)).limit(limit).lean(),
    Coupon.countDocuments(filter),
  ]);
  return { items: items.map((c) => ({ ...c, summary: describe(c) })), pagination: pageMeta(total, page, limit) };
}

export async function createCoupon(input, admin) {
  if (await Coupon.exists({ code: input.code })) throw ApiError.field('code', 'A coupon with this code already exists');
  return Coupon.create({ ...input, createdBy: admin.id });
}

/** Code and type are fixed after creation (customers may already have used it); everything else can change. */
export async function updateCoupon(id, input) {
  const coupon = await Coupon.findById(id);
  if (!coupon) throw ApiError.notFound('Coupon not found');
  Object.assign(coupon, input);
  if (coupon.usageLimit && coupon.usageLimit < coupon.usedCount) {
    throw ApiError.field('usageLimit', `Already used ${coupon.usedCount} times; the limit cannot be lower`);
  }
  await coupon.save();
  return coupon;
}
