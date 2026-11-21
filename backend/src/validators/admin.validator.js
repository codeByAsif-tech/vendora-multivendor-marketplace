import { z } from 'zod';
import {
  PRODUCT_STATUS_VALUES,
  SELLER_STATUS_VALUES,
  USER_STATUS_VALUES,
} from '../utils/constants.js';
import { objectId, optionalQuery, paginationQuery, requireReasonFor, searchQuery } from './common.validator.js';

const reason = z.string().trim().max(500).optional();

// ---- Sellers ----
export const listSellersQuery = z.object({
  status: optionalQuery(z.enum(SELLER_STATUS_VALUES)),
  search: searchQuery,
  ...paginationQuery,
});

export const sellerStatusSchema = z
  .object({ status: z.enum(['approved', 'rejected', 'suspended']), reason })
  .strict()
  .superRefine(requireReasonFor(['rejected', 'suspended']));

// ---- Users ----
export const listUsersQuery = z.object({
  role: optionalQuery(z.enum(['customer', 'seller'])).transform((v) => v ?? 'customer'),
  status: optionalQuery(z.enum(USER_STATUS_VALUES)),
  search: searchQuery,
  ...paginationQuery,
});

export const userStatusSchema = z
  .object({ status: z.enum(USER_STATUS_VALUES), reason })
  .strict()
  .superRefine(requireReasonFor(['blocked']));

// ---- Products ----
export const adminProductListQuery = z.object({
  status: optionalQuery(z.enum(PRODUCT_STATUS_VALUES)),
  search: searchQuery,
  store: optionalQuery(objectId),
  category: optionalQuery(objectId),
  ...paginationQuery,
});

export const moderationSchema = z
  .object({ status: z.enum(['approved', 'rejected']), reason })
  .strict()
  .superRefine(requireReasonFor(['rejected']));
