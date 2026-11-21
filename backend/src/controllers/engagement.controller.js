import * as couponService from '../services/coupon.service.js';
import * as notificationService from '../services/notification.service.js';
import * as returnService from '../services/return.service.js';
import * as reviewService from '../services/review.service.js';
import { sendSuccess } from '../utils/response.js';

/* Phase 9: reviews, coupons, returns, notifications */

// ---- Reviews ----
export async function productReviews(req, res) {
  return sendSuccess(res, { data: await reviewService.listProductReviews(req.params.slug, req.validatedQuery) });
}
export async function myReviewState(req, res) {
  return sendSuccess(res, { data: await reviewService.getMyReviewState(req.user.id, req.params.slug) });
}
export async function saveMyReview(req, res) {
  const { review, created } = await reviewService.upsertMyReview(req.user, req.params.slug, req.body);
  return sendSuccess(res, {
    status: created ? 201 : 200,
    message: created ? 'Thanks for your review!' : 'Review updated',
    data: { review },
  });
}
export async function deleteMyReview(req, res) {
  await reviewService.deleteMyReview(req.user.id, req.params.slug);
  return sendSuccess(res, { message: 'Review deleted' });
}
export async function adminReviews(req, res) {
  return sendSuccess(res, { data: await reviewService.listReviews(req.validatedQuery) });
}
export async function moderateReview(req, res) {
  const review = await reviewService.moderateReview(req.params.id, req.body, req.user);
  return sendSuccess(res, { message: review.status === 'hidden' ? 'Review hidden' : 'Review published', data: { review } });
}

// ---- Coupons (admin) ----
export async function listCoupons(req, res) {
  return sendSuccess(res, { data: await couponService.listCoupons(req.validatedQuery) });
}
export async function createCoupon(req, res) {
  const coupon = await couponService.createCoupon(req.body, req.user);
  return sendSuccess(res, { status: 201, message: `Coupon ${coupon.code} created`, data: { coupon } });
}
export async function updateCoupon(req, res) {
  const coupon = await couponService.updateCoupon(req.params.id, req.body);
  return sendSuccess(res, { message: 'Coupon updated', data: { coupon } });
}

// ---- Returns ----
export async function requestReturn(req, res) {
  const ret = await returnService.requestReturn(req.user, req.params.orderNumber, req.body);
  return sendSuccess(res, { status: 201, message: 'Return requested. The seller will reply soon.', data: { return: ret } });
}
export async function myReturns(req, res) {
  return sendSuccess(res, { data: await returnService.listMyReturns(req.user.id, req.validatedQuery) });
}
export async function listReturns(req, res) {
  return sendSuccess(res, { data: await returnService.listReturns(req.user, req.validatedQuery) });
}
export async function decideReturn(req, res) {
  const ret = await returnService.decideReturn(req.user, req.params.id, req.body);
  const messages = { approve: 'Return approved', reject: 'Return declined', receive: 'Marked as received. Refund is now due.' };
  return sendSuccess(res, { message: messages[req.body.action], data: { return: ret } });
}

// ---- Notifications (every role) ----
export async function myNotifications(req, res) {
  return sendSuccess(res, { data: await notificationService.listMine(req.user.id, req.validatedQuery) });
}
export async function unreadCount(req, res) {
  return sendSuccess(res, { data: { unreadCount: await notificationService.unreadCount(req.user.id) } });
}
export async function markRead(req, res) {
  await notificationService.markRead(req.user.id, req.params.id);
  return sendSuccess(res, { data: { unreadCount: await notificationService.unreadCount(req.user.id) } });
}
export async function markAllRead(req, res) {
  await notificationService.markAllRead(req.user.id);
  return sendSuccess(res, { data: { unreadCount: 0 } });
}
