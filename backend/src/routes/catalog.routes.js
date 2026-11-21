import { Router } from 'express';
import * as catalogController from '../controllers/catalog.controller.js';
import * as engagement from '../controllers/engagement.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { writeLimiter } from '../middlewares/rateLimiter.js';
import { ROLES } from '../utils/constants.js';
import { validate } from '../middlewares/validate.js';
import { listProductsQuery, slugParams } from '../validators/catalog.validator.js';
import { productReviewsQuery, reviewSchema } from '../validators/engagement.validator.js';

/** Public storefront endpoints (no login). Only products passing buildVisibilityFilter() are ever returned. */
export const productRouter = Router();
export const storeRouter = Router();

/**
 * @openapi
 * /products:
 *   get:
 *     tags: [Catalog]
 *     summary: Browse products (search, filters, sort, pagination). Prices are in paise.
 *     parameters:
 *       - { in: query, name: search, schema: { type: string }, description: "Full-text search on name, brand, tags and description" }
 *       - { in: query, name: category, schema: { type: string }, description: "Category slug (a parent includes its subcategories)" }
 *       - { in: query, name: store, schema: { type: string }, description: Store slug }
 *       - { in: query, name: brand, schema: { type: string }, description: "Comma separated, e.g. Nike,Puma" }
 *       - { in: query, name: minPrice, schema: { type: integer }, description: Paise }
 *       - { in: query, name: maxPrice, schema: { type: integer }, description: Paise }
 *       - { in: query, name: inStock, schema: { type: string, enum: ["true", "false"] } }
 *       - { in: query, name: minRating, schema: { type: number } }
 *       - { in: query, name: sort, schema: { type: string, enum: [relevance, newest, price_asc, price_desc, discount, rating, popular] } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer, maximum: 48 } }
 *     responses:
 *       200:
 *         description: "{ items, pagination, facets: { brands, priceRange } }"
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 items: [{ _id: "...", name: Classic Cotton T-Shirt, slug: classic-cotton-t-shirt-a1b2c3, minPrice: 79900, compareAtPrice: 99900, maxDiscount: 20, totalStock: 35, store: { storeName: Urban Threads, slug: urban-threads } }]
 *                 pagination: { page: 1, limit: 24, total: 1, totalPages: 1 }
 *                 facets: { brands: [Urban Threads], priceRange: { min: 79900, max: 79900 } }
 * /products/{slug}:
 *   get:
 *     tags: [Catalog]
 *     summary: Product page data with up to 8 related products
 *     parameters: [{ in: path, name: slug, required: true, schema: { type: string } }]
 *     responses: { 200: { description: "{ product, related }" }, 404: { description: Not found or not visible } }
 */
productRouter.get('/', validate({ query: listProductsQuery }), catalogController.listProducts);
productRouter.get('/:slug', validate({ params: slugParams }), catalogController.getProduct);

// Reviews: anyone can read; customers with a delivered order of the product can write one.
const customerOnly = [authenticate, authorize(ROLES.CUSTOMER)];
productRouter.get('/:slug/reviews', validate({ params: slugParams, query: productReviewsQuery }), engagement.productReviews);
productRouter.get('/:slug/reviews/me', ...customerOnly, validate({ params: slugParams }), engagement.myReviewState);
productRouter.put('/:slug/reviews/me', ...customerOnly, writeLimiter, validate({ params: slugParams, body: reviewSchema }), engagement.saveMyReview);
productRouter.delete('/:slug/reviews/me', ...customerOnly, validate({ params: slugParams }), engagement.deleteMyReview);

/**
 * @openapi
 * /stores/{slug}:
 *   get:
 *     tags: [Catalog]
 *     summary: Public store profile (approved stores only). Use /products?store=slug for its products.
 *     parameters: [{ in: path, name: slug, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Store }, 404: { description: Not found or not approved } }
 */
storeRouter.get('/:slug', validate({ params: slugParams }), catalogController.getStore);
