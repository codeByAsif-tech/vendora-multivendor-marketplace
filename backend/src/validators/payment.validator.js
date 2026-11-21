import { z } from 'zod';
import { PAYMENT_METHODS, PAYMENT_STATUS_VALUES, TRANSACTION_TYPE_VALUES } from '../utils/constants.js';
import { optionalQuery, paginationQuery, searchQuery } from './common.validator.js';

export const utrSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{6,30}$/, 'Enter the 6–30 character UTR / transaction reference');

export const listPaymentsQuery = z.object({
  status: optionalQuery(z.enum([...PAYMENT_STATUS_VALUES, 'refund_due'])),
  method: optionalQuery(z.enum(PAYMENT_METHODS)),
  search: searchQuery,
  ...paginationQuery,
});

export const rejectPaymentSchema = z
  .object({ reason: z.string().trim().min(5, 'Please give a reason (at least 5 characters)').max(300) })
  .strict();

export const refundSchema = z
  .object({
    amount: z.number().int('Amount must be in whole paise').min(100, 'Minimum refund is ₹1'),
    reference: z.string().trim().min(3, 'Enter the bank / UPI reference of the refund').max(60),
    note: z.string().trim().max(300).optional(),
  })
  .strict();

export const resubmitPaymentSchema = z.object({ utr: utrSchema }).strict();

export const listTransactionsQuery = z.object({
  type: optionalQuery(z.enum(TRANSACTION_TYPE_VALUES)),
  search: searchQuery,
  from: optionalQuery(z.coerce.date()),
  to: optionalQuery(z.coerce.date()),
  ...paginationQuery,
});
