import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const idParams = z.object({ id: objectId });

/** Treats "" in query strings as "not provided" (e.g. ?status= from an empty filter). */
export const optionalQuery = (schema) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const searchQuery = optionalQuery(z.string().trim().max(100));

/** Required reason (min 5 chars) for negative decisions such as reject / suspend / block. */
export function requireReasonFor(statuses) {
  return (data, ctx) => {
    if (statuses.includes(data.status) && (!data.reason || data.reason.trim().length < 5)) {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Please give a reason (at least 5 characters)',
      });
    }
  };
}
