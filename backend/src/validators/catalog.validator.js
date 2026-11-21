import { z } from 'zod';
import { optionalQuery, searchQuery } from './common.validator.js';

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,120}$/, 'Invalid slug');

export const slugParams = z.object({ slug });

export const listProductsQuery = z.object({
  search: searchQuery,
  category: optionalQuery(slug),
  store: optionalQuery(slug),
  // Comma separated: ?brand=Nike,Puma
  brand: optionalQuery(z.string().trim().max(500)).transform((value) =>
    value
      ? value
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean)
          .slice(0, 20)
      : undefined,
  ),
  minPrice: optionalQuery(z.coerce.number().int().min(0)), // paise
  maxPrice: optionalQuery(z.coerce.number().int().min(0)), // paise
  minRating: optionalQuery(z.coerce.number().min(0).max(5)),
  inStock: optionalQuery(z.enum(['true', 'false'])).transform((value) => value === 'true'),
  sort: optionalQuery(
    z.enum(['relevance', 'newest', 'price_asc', 'price_desc', 'discount', 'rating', 'popular']),
  ).transform((value) => value ?? 'newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
});
