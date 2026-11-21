import { z } from 'zod';
import { PRODUCT_LIMITS, PRODUCT_STATUS_VALUES } from '../utils/constants.js';
import { objectId, optionalQuery, paginationQuery, searchQuery } from './common.validator.js';

/**
 * All money values are integers in paise (₹1 = 100). ₹799.00 → 79900.
 */
const paise = z
  .number()
  .int('Amount must be a whole number of paise')
  .min(100, 'Minimum price is ₹1')
  .max(1_000_000_000, 'Price is too high');

const imageSchema = z
  .object({ url: z.string().min(1).max(500), publicId: z.string().min(1).max(300) })
  .strict();

const attributeSchema = z
  .object({
    name: z.string().trim().min(1, 'Attribute name is required').max(30),
    value: z.string().trim().min(1, 'Attribute value is required').max(50),
  })
  .strict();

const variantSchema = z
  .object({
    _id: objectId.optional(), // send back for existing variants so their ids stay stable
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{0,39}$/, 'SKU may contain letters, numbers, - and _ (max 40)'),
    attributes: z.array(attributeSchema).max(PRODUCT_LIMITS.MAX_ATTRIBUTES).default([]),
    price: paise,
    salePrice: paise.nullable().optional(),
    stock: z.number().int().min(0, 'Stock cannot be negative').max(1_000_000),
    lowStockThreshold: z.number().int().min(0).max(10_000).default(PRODUCT_LIMITS.DEFAULT_LOW_STOCK),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine((v) => v.salePrice == null || v.salePrice < v.price, {
    path: ['salePrice'],
    message: 'Sale price must be lower than the regular price',
  });

const baseFields = {
  name: z.string().trim().min(3, 'Name must be at least 3 characters').max(150),
  brand: z.string().trim().max(60),
  category: objectId,
  description: z.string().trim().min(20, 'Description must be at least 20 characters').max(5000),
  highlights: z.array(z.string().trim().min(1).max(200)).max(8),
  images: z
    .array(imageSchema)
    .min(1, 'Add at least one image')
    .max(PRODUCT_LIMITS.MAX_IMAGES, `Up to ${PRODUCT_LIMITS.MAX_IMAGES} images`),
  variants: z
    .array(variantSchema)
    .min(1, 'Add at least one variant')
    .max(PRODUCT_LIMITS.MAX_VARIANTS, `Up to ${PRODUCT_LIMITS.MAX_VARIANTS} variants`),
  specifications: z
    .array(
      z
        .object({ key: z.string().trim().min(1).max(50), value: z.string().trim().min(1).max(200) })
        .strict(),
    )
    .max(30),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(15),
  isActive: z.boolean(),
};

/**
 * Rules across variants:
 * - SKUs unique within the product
 * - with more than one variant: every variant has attributes, all use the same attribute names,
 *   and no two variants have the same combination
 */
export function checkVariants(data, ctx) {
  const { variants } = data;
  if (!Array.isArray(variants) || !variants.length) return;

  const issue = (path, message) => ctx.addIssue({ code: 'custom', path: ['variants', ...path], message });
  const attrs = (v) => (Array.isArray(v?.attributes) ? v.attributes : []);
  const lower = (text) => String(text ?? '').toLowerCase();
  const signature = (v) => attrs(v).map((a) => lower(a?.name)).sort().join('|');
  const combination = (v) =>
    attrs(v).map((a) => `${lower(a?.name)}=${lower(a?.value)}`).sort().join('|');

  const skus = new Set();
  const combos = new Set();
  const expected = signature(variants[0]);

  variants.forEach((variant, i) => {
    if (skus.has(variant?.sku)) issue([i, 'sku'], 'Duplicate SKU in this product');
    skus.add(variant?.sku);

    const names = attrs(variant).map((a) => lower(a?.name));
    if (new Set(names).size !== names.length) issue([i, 'attributes'], 'Each attribute may appear only once');

    if (variants.length > 1) {
      if (!attrs(variant).length) {
        issue([i, 'attributes'], 'Each variant needs attributes such as Size or Color');
        return;
      }
      if (signature(variant) !== expected) issue([i, 'attributes'], 'All variants must use the same attributes');

      const combo = combination(variant);
      if (combos.has(combo)) issue([i, 'attributes'], 'Two variants have the same combination');
      combos.add(combo);
    }
  });
}

export const createProductSchema = z
  .object({
    ...baseFields,
    brand: baseFields.brand.optional().default(''),
    highlights: baseFields.highlights.optional().default([]),
    specifications: baseFields.specifications.optional().default([]),
    tags: baseFields.tags.optional().default([]),
    isActive: baseFields.isActive.optional().default(true),
  })
  .strict()
  .superRefine(checkVariants);

export const updateProductSchema = z
  .object(Object.fromEntries(Object.entries(baseFields).map(([key, schema]) => [key, schema.optional()])))
  .strict()
  .superRefine(checkVariants)
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

export const sellerProductListQuery = z.object({
  search: searchQuery,
  status: optionalQuery(z.enum(PRODUCT_STATUS_VALUES)),
  category: optionalQuery(objectId),
  stock: optionalQuery(z.enum(['in', 'out'])),
  sort: optionalQuery(
    z.enum(['newest', 'oldest', 'price_asc', 'price_desc', 'stock_asc', 'name_asc']),
  ).transform((v) => v ?? 'newest'),
  ...paginationQuery,
});

export const visibilitySchema = z.object({ isActive: z.boolean() }).strict();

export const inventoryListQuery = z.object({
  search: searchQuery,
  stock: optionalQuery(z.enum(['low', 'out'])),
  ...paginationQuery,
});

export const variantParams = z.object({ productId: objectId, variantId: objectId });

export const stockUpdateSchema = z
  .object({
    stock: z.number().int().min(0, 'Stock cannot be negative').max(1_000_000),
    lowStockThreshold: z.number().int().min(0).max(10_000).optional(),
  })
  .strict();
