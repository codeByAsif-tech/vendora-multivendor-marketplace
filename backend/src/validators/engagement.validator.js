import { z } from 'zod';
import { COUPON_TYPES, RETURN_REASONS, RETURN_STATUS_VALUES, REVIEW_STATUS_VALUES } from '../utils/constants.js';
import { objectId, optionalQuery, paginationQuery, searchQuery } from './common.validator.js';

/* Phase 9: reviews, coupons, returns, notifications */

// ---- Reviews ----
const stars = z.coerce.number().int().min(1).max(5);

export const productReviewsQuery = z.object({
  sort: optionalQuery(z.enum(['newest', 'highest', 'lowest'])),
  rating: optionalQuery(stars),
  ...paginationQuery,
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const reviewSchema = z
  .object({
    rating: z.number().int().min(1, 'Choose a rating').max(5),
    title: z.string().trim().max(100).optional(),
    body: z.string().trim().max(2000, 'Keep it under 2000 characters').optional(),
  })
  .strict();

export const adminReviewsQuery = z.object({
  status: optionalQuery(z.enum(REVIEW_STATUS_VALUES)),
  rating: optionalQuery(stars),
  search: searchQuery,
  ...paginationQuery,
});

export const moderateReviewSchema = z
  .object({ status: z.enum(REVIEW_STATUS_VALUES), reason: z.string().trim().max(300).optional() })
  .strict()
  .superRefine((data, ctx) => {
    if (data.status === 'hidden' && (!data.reason || data.reason.length < 5)) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Please give a reason (at least 5 characters)' });
    }
  });

// ---- Coupons ----
const couponFields = {
  description: z.string().trim().max(160).optional(),
  value: z.number().int().min(1),
  maxDiscount: z.number().int().min(100).nullable().optional(),
  minOrderValue: z.number().int().min(0).optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  usageLimit: z.number().int().min(1).nullable().optional(),
  perUserLimit: z.number().int().min(1).max(100).optional(),
  firstOrderOnly: z.boolean().optional(),
  isActive: z.boolean().optional(),
};

function checkCoupon(data, ctx) {
  if (data.type === 'percent' && data.value > 90) {
    ctx.addIssue({ code: 'custom', path: ['value'], message: 'A percent coupon can be at most 90%' });
  }
  if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End date must be after the start date' });
  }
}

export const createCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,20}$/, '3–20 letters, numbers, - or _'),
    type: z.enum(COUPON_TYPES),
    ...couponFields,
  })
  .strict()
  .superRefine(checkCoupon);

/** Code and type cannot change after creation. */
export const updateCouponSchema = z.object(couponFields).partial().strict().superRefine(checkCoupon);

export const couponListQuery = z.object({
  status: optionalQuery(z.enum(['active', 'expired', 'disabled'])),
  search: searchQuery,
  ...paginationQuery,
});

// ---- Returns ----
export const requestReturnSchema = z
  .object({
    sellerOrderId: objectId,
    items: z
      .array(z.object({ itemId: objectId, quantity: z.number().int().min(1) }).strict())
      .min(1, 'Choose at least one item')
      .max(50),
    reason: z.enum(Object.keys(RETURN_REASONS)),
    details: z.string().trim().max(1000).optional(),
    refundUpi: z
      .string()
      .trim()
      .regex(/^[\w.-]{2,}@[a-zA-Z]{2,}$/, 'Enter a UPI ID like name@bank')
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const ids = data.items.map((i) => i.itemId);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['items'], message: 'Each item only once' });
    if (['damaged', 'wrong_item', 'not_as_described', 'other'].includes(data.reason) && (!data.details || data.details.length < 10)) {
      ctx.addIssue({ code: 'custom', path: ['details'], message: 'Please describe the problem (at least 10 characters)' });
    }
  });

export const myReturnsQuery = z.object({
  orderNumber: optionalQuery(z.string().trim().max(40)),
  ...paginationQuery,
});

export const returnListQuery = z.object({
  status: optionalQuery(z.enum(RETURN_STATUS_VALUES)),
  search: searchQuery,
  ...paginationQuery,
});

export const decideReturnSchema = z
  .object({ action: z.enum(['approve', 'reject', 'receive']), note: z.string().trim().max(500).optional() })
  .strict()
  .superRefine((data, ctx) => {
    if (data.action === 'reject' && (!data.note || data.note.length < 5)) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Please tell the customer why (at least 5 characters)' });
    }
  });

// ---- Notifications ----
export const notificationsQuery = z.object({
  unread: optionalQuery(z.enum(['true', 'false']).transform((v) => v === 'true')),
  ...paginationQuery,
  limit: z.coerce.number().int().min(1).max(50).default(15),
});
