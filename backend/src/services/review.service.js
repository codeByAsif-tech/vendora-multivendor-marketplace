import mongoose from 'mongoose';
import { SellerOrder } from '../models/order.model.js';
import { Product } from '../models/product.model.js';
import { Review } from '../models/review.model.js';
import { SellerProfile } from '../models/sellerProfile.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ORDER_STATUS, REVIEW_STATUS } from '../utils/constants.js';
import { pageMeta, skipFor, statusCounts } from '../utils/pagination.js';
import { searchRegex } from '../utils/text.js';
import { buildVisibilityFilter } from './catalog.service.js';
import { notify } from './notification.service.js';

const SORTS = {
  newest: { createdAt: -1 },
  highest: { rating: -1, createdAt: -1 },
  lowest: { rating: 1, createdAt: -1 },
};

/** "Ram Kumar" → "Ram K." (reviews never show full names or emails). */
export function publicName(name = '') {
  const [first = 'Customer', ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

async function findVisibleProduct(slug) {
  const product = await Product.findOne({ slug, ...(await buildVisibilityFilter()) }).select('_id store name slug').lean();
  if (!product) throw ApiError.notFound('Product not found');
  return product;
}

/** Recomputes the product's average (1 decimal) and count from published reviews. */
export async function recomputeRating(productId) {
  const [row] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)), status: REVIEW_STATUS.PUBLISHED } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne(
    { _id: productId },
    { $set: { ratingAvg: row ? Math.round(row.avg * 10) / 10 : 0, ratingCount: row?.count ?? 0 } },
  );
}

/* ------------------------------------------------------------------ */
/* Public                                                              */
/* ------------------------------------------------------------------ */

export async function listProductReviews(slug, { sort, rating, page, limit }) {
  const product = await findVisibleProduct(slug);
  const base = { product: product._id, status: REVIEW_STATUS.PUBLISHED };
  const filter = rating ? { ...base, rating } : base;

  const [items, total, distribution] = await Promise.all([
    Review.find(filter)
      .sort(SORTS[sort] ?? SORTS.newest)
      .skip(skipFor(page, limit))
      .limit(limit)
      .select('rating title body variantLabel createdAt updatedAt user')
      .populate('user', 'name')
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate([{ $match: base }, { $group: { _id: '$rating', count: { $sum: 1 } } }]),
  ]);

  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const { _id, count } of distribution) counts[_id] = count;
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const average = totalCount ? Object.entries(counts).reduce((sum, [stars, n]) => sum + stars * n, 0) / totalCount : 0;

  return {
    items: items.map(({ user, ...review }) => ({ ...review, author: publicName(user?.name), verified: true })),
    pagination: pageMeta(total, page, limit),
    summary: { average: Math.round(average * 10) / 10, count: totalCount, distribution: counts },
  };
}

/* ------------------------------------------------------------------ */
/* Customer                                                            */
/* ------------------------------------------------------------------ */

/** The customer's delivered shipment containing this product (proof of purchase), newest first. */
async function deliveredPurchase(userId, productId) {
  return SellerOrder.findOne({ customer: userId, status: ORDER_STATUS.DELIVERED, 'items.product': productId })
    .sort({ deliveredAt: -1 })
    .select('_id store items')
    .lean();
}

/** Whether the customer can review this product, plus their existing review. */
export async function getMyReviewState(userId, slug) {
  const product = await findVisibleProduct(slug);
  const [review, purchase] = await Promise.all([
    Review.findOne({ product: product._id, user: userId }).lean(),
    deliveredPurchase(userId, product._id),
  ]);
  return {
    canReview: Boolean(purchase),
    reason: purchase ? null : 'You can review this product after your order is delivered.',
    review: review ? { ...review, author: undefined } : null,
  };
}

export async function upsertMyReview(user, slug, { rating, title, body }) {
  const product = await findVisibleProduct(slug);
  const purchase = await deliveredPurchase(user.id, product._id);
  if (!purchase) throw ApiError.forbidden('Only customers who received this product can review it', 'NOT_PURCHASED');

  const item = purchase.items.find((i) => String(i.product) === String(product._id));
  const variantLabel = item?.attributes?.length ? item.attributes.map((a) => `${a.name}: ${a.value}`).join(' · ') : undefined;

  const existing = await Review.findOne({ product: product._id, user: user.id });
  if (existing?.status === REVIEW_STATUS.HIDDEN) {
    throw ApiError.forbidden('This review was hidden by our team and can no longer be edited', 'REVIEW_HIDDEN');
  }

  const review = await Review.findOneAndUpdate(
    { product: product._id, user: user.id },
    {
      $set: { rating, title: title || undefined, body: body || undefined, variantLabel },
      $setOnInsert: { store: product.store, sellerOrder: purchase._id, status: REVIEW_STATUS.PUBLISHED },
    },
    { upsert: true, new: true, runValidators: true },
  );
  await recomputeRating(product._id);

  if (!existing) {
    const store = await SellerProfile.findById(product.store).select('user').lean();
    notify(store?.user, {
      type: 'new_review',
      title: `New ${rating}★ review`,
      body: `${publicName(user.name)} reviewed ${product.name}`,
      link: `/products/${product.slug}`,
    });
  }
  return { review, created: !existing };
}

export async function deleteMyReview(userId, slug) {
  const product = await findVisibleProduct(slug);
  const deleted = await Review.findOneAndDelete({ product: product._id, user: userId });
  if (!deleted) throw ApiError.notFound('You have not reviewed this product');
  await recomputeRating(product._id);
}

/* ------------------------------------------------------------------ */
/* Admin moderation                                                    */
/* ------------------------------------------------------------------ */

export async function listReviews({ status, rating, search, page, limit }) {
  const filter = {};
  if (status) filter.status = status;
  if (rating) filter.rating = rating;
  if (search) {
    const rx = searchRegex(search);
    const products = await Product.find({ name: rx }).select('_id').limit(500).lean();
    filter.$or = [{ title: rx }, { body: rx }, { product: { $in: products.map((p) => p._id) } }];
  }

  const [items, total, groups] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skipFor(page, limit))
      .limit(limit)
      .populate('product', 'name slug images')
      .populate('user', 'name email')
      .populate('store', 'storeName')
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  return {
    items: items.map((r) => ({ ...r, product: r.product && { ...r.product, image: r.product.images?.[0]?.url, images: undefined } })),
    pagination: pageMeta(total, page, limit),
    counts: statusCounts(groups, Object.values(REVIEW_STATUS)),
  };
}

/** Hide (with a reason) or publish again. The product rating is recalculated either way. */
export async function moderateReview(id, { status, reason }, admin) {
  const review = await Review.findById(id);
  if (!review) throw ApiError.notFound('Review not found');

  review.status = status;
  review.hiddenReason = status === REVIEW_STATUS.HIDDEN ? reason : undefined;
  review.moderatedBy = admin.id;
  await review.save();
  await recomputeRating(review.product);

  if (status === REVIEW_STATUS.HIDDEN) {
    const product = await Product.findById(review.product).select('name slug').lean();
    notify(review.user, {
      type: 'review_hidden',
      title: 'Your review was hidden',
      body: `Your review of ${product?.name ?? 'a product'} broke our review guidelines: ${reason}`,
      link: product ? `/products/${product.slug}` : undefined,
    });
  }
  return review;
}
