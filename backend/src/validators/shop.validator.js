import { z } from 'zod';
import { ADDRESS_TYPES, CART_LIMITS, ORDER_STATUS_VALUES, PAYMENT_METHODS } from '../utils/constants.js';
import { objectId, optionalQuery, paginationQuery, searchQuery } from './common.validator.js';

const quantity = z.number().int().min(1, 'Quantity must be at least 1').max(CART_LIMITS.MAX_QTY_PER_LINE, `Maximum ${CART_LIMITS.MAX_QTY_PER_LINE} per item`);

// ---- Cart ----
export const addCartItemSchema = z
  .object({ productId: objectId, variantId: objectId, quantity: quantity.optional().default(1) })
  .strict();

export const updateCartItemSchema = z.object({ quantity }).strict();

export const cartItemParams = z.object({ itemId: objectId });

export const applyCouponSchema = z
  .object({ code: z.string().trim().min(3, 'Enter a coupon code').max(20).regex(/^[A-Za-z0-9_-]+$/, 'Letters and numbers only') })
  .strict();

// ---- Wishlist ----
export const wishlistSchema = z.object({ productId: objectId }).strict();
export const productIdParams = z.object({ productId: objectId });

// ---- Addresses ----
const addressFields = {
  fullName: z.string().trim().min(2, 'Enter the full name').max(80),
  phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, 'Enter a valid phone number'),
  line1: z.string().trim().min(3, 'Enter the address').max(120),
  line2: z.string().trim().max(120),
  landmark: z.string().trim().max(80),
  city: z.string().trim().min(2, 'Enter the city').max(60),
  state: z.string().trim().min(2, 'Enter the state').max(60),
  postalCode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit PIN code'),
  country: z.string().trim().min(2).max(60),
  type: z.enum(ADDRESS_TYPES),
  isDefault: z.boolean(),
};

export const createAddressSchema = z
  .object({
    ...addressFields,
    line2: addressFields.line2.optional().default(''),
    landmark: addressFields.landmark.optional().default(''),
    country: addressFields.country.optional().default('India'),
    type: addressFields.type.optional().default('home'),
    isDefault: addressFields.isDefault.optional().default(false),
  })
  .strict();

export const updateAddressSchema = z
  .object(Object.fromEntries(Object.entries(addressFields).map(([key, schema]) => [key, schema.optional()])))
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

// ---- Orders ----
export const placeOrderSchema = z
  .object({
    addressId: objectId,
    paymentMethod: z.enum(PAYMENT_METHODS),
    utr: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{6,30}$/, 'Enter the 6–30 character UTR / transaction reference')
      .optional(),
    // Generated once per checkout page in the browser (UUID).
    idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9-]{8,64}$/, 'Invalid idempotency key'),
    note: z.string().trim().max(300).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.paymentMethod === 'manual' && !data.utr) {
      ctx.addIssue({ code: 'custom', path: ['utr'], message: 'Enter the UTR / transaction reference of your payment' });
    }
  });

export const orderNumberParams = z.object({ orderNumber: z.string().trim().regex(/^MK[0-9A-F]{12}$/i, 'Invalid order number') });

export const cancelOrderSchema = z
  .object({
    sellerOrderId: objectId.optional(),
    reason: z.string().trim().min(3, 'Tell us why you are cancelling').max(300),
  })
  .strict();

export const myOrdersQuery = z.object({ ...paginationQuery, limit: z.coerce.number().int().min(1).max(50).default(10) });

// ---- Seller / admin order management ----
export const orderListQuery = z.object({
  status: optionalQuery(z.enum(ORDER_STATUS_VALUES)),
  search: searchQuery,
  ...paginationQuery,
});

export const orderStatusSchema = z
  .object({
    status: z.enum(['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled']),
    note: z.string().trim().max(300).optional(),
    reason: z.string().trim().max(300).optional(),
    carrier: z.string().trim().max(60).optional(),
    trackingNumber: z.string().trim().max(60).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.status === 'cancelled' && (!data.reason || data.reason.length < 5)) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Please give a reason (at least 5 characters)' });
    }
  });
