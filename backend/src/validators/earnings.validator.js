import { z } from 'zod';
import { COMMISSION_LIMITS, LEDGER_TYPE_VALUES, PAYOUT_METHODS } from '../utils/constants.js';
import { objectId, optionalQuery, paginationQuery, searchQuery } from './common.validator.js';

/** Percent with at most 2 decimals, e.g. 10 or 12.5. */
const rate = z
  .number()
  .min(COMMISSION_LIMITS.MIN, `Rate cannot be below ${COMMISSION_LIMITS.MIN}%`)
  .max(COMMISSION_LIMITS.MAX, `Rate cannot be above ${COMMISSION_LIMITS.MAX}%`)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9, { message: 'Use at most 2 decimals' });

export const commissionSettingsSchema = z.object({ defaultRate: rate }).strict();

/** null = use the platform default again. */
export const storeCommissionSchema = z.object({ rate: rate.nullable() }).strict();

export const ledgerQuery = z.object({
  type: optionalQuery(z.enum(LEDGER_TYPE_VALUES)),
  ...paginationQuery,
});

export const sellerPayoutsQuery = z.object({ ...paginationQuery });

export const balancesQuery = z.object({
  search: searchQuery,
  due: optionalQuery(z.enum(['true', 'false']).transform((v) => v === 'true')),
  ...paginationQuery,
});

export const createPayoutSchema = z
  .object({
    storeId: objectId,
    amount: z.number().int('Amount must be in whole paise').min(100, 'Minimum payout is ₹1'),
    method: z.enum(PAYOUT_METHODS),
    reference: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9\-/]{4,60}$/, 'Enter the bank / UPI reference (4–60 letters or numbers)'),
    note: z.string().trim().max(300).optional(),
  })
  .strict();

export const payoutsQuery = z.object({
  store: optionalQuery(objectId),
  search: searchQuery,
  from: optionalQuery(z.coerce.date()),
  to: optionalQuery(z.coerce.date()),
  ...paginationQuery,
});
