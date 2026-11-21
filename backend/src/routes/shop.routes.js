import { Router } from 'express';
import * as engagement from '../controllers/engagement.controller.js';
import * as paymentController from '../controllers/payment.controller.js';
import * as shop from '../controllers/shop.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { couponLimiter, writeLimiter } from '../middlewares/rateLimiter.js';
import { requireVerifiedEmail } from '../middlewares/requireVerifiedEmail.js';
import { validate } from '../middlewares/validate.js';
import { ROLES } from '../utils/constants.js';
import { idParams } from '../validators/common.validator.js';
import { requestReturnSchema } from '../validators/engagement.validator.js';
import { resubmitPaymentSchema } from '../validators/payment.validator.js';
import {
  addCartItemSchema,
  applyCouponSchema,
  cancelOrderSchema,
  cartItemParams,
  createAddressSchema,
  myOrdersQuery,
  orderNumberParams,
  placeOrderSchema,
  productIdParams,
  updateAddressSchema,
  updateCartItemSchema,
  wishlistSchema,
} from '../validators/shop.validator.js';

/** Customer-only shopping endpoints. Every query is scoped to req.user.id. */
const customerOnly = [authenticate, authorize(ROLES.CUSTOMER)];

// ---------------------------------- Cart ----------------------------------
export const cartRouter = Router();
cartRouter.use(...customerOnly);

/**
 * @openapi
 * /cart:
 *   get:
 *     tags: [Cart]
 *     summary: My cart with live prices, stock checks, per-store shipping and totals (paise)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: "{ items, summary, shipments }"
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 items: [{ _id: "...", name: Classic Tee, unitPrice: 79900, quantity: 2, lineTotal: 159800, maxQuantity: 10, issue: null, store: { storeName: Urban Threads } }]
 *                 summary: { itemCount: 2, subtotal: 159800, shipping: 0, discount: 0, total: 159800, savings: 40000, hasIssues: false }
 *   delete:
 *     tags: [Cart]
 *     summary: Empty the cart
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Empty cart } }
 * /cart/items:
 *   post:
 *     tags: [Cart]
 *     summary: Add a product variant (quantity is merged and capped at stock / 10)
 *     security: [{ bearerAuth: [] }]
 *     requestBody: { content: { application/json: { example: { productId: 665f1c2e8b3a4c0012ab34cd, variantId: 665f1c2e8b3a4c0012ab34ce, quantity: 1 } } } }
 *     responses: { 200: { description: Updated cart }, 404: { description: Not available }, 409: { description: Out of stock } }
 * /cart/items/{itemId}:
 *   patch:
 *     tags: [Cart]
 *     summary: Change quantity
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: itemId, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Updated cart } }
 *   delete:
 *     tags: [Cart]
 *     summary: Remove a line
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: itemId, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Updated cart } }
 */
cartRouter.get('/', shop.getCart);
cartRouter.delete('/', shop.clearCart);
cartRouter.post('/items', validate({ body: addCartItemSchema }), shop.addCartItem);
cartRouter.patch('/items/:itemId', validate({ params: cartItemParams, body: updateCartItemSchema }), shop.updateCartItem);
cartRouter.delete('/items/:itemId', validate({ params: cartItemParams }), shop.removeCartItem);
cartRouter.post('/coupon', couponLimiter, validate({ body: applyCouponSchema }), shop.applyCoupon);
cartRouter.delete('/coupon', shop.removeCoupon);

// -------------------------------- Wishlist --------------------------------
export const wishlistRouter = Router();
wishlistRouter.use(...customerOnly);

/**
 * @openapi
 * /wishlist:
 *   get:
 *     tags: [Wishlist]
 *     summary: My wishlist (visible products as cards + all saved product ids)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: "{ items, productIds }" } }
 *   post:
 *     tags: [Wishlist]
 *     summary: Save a product
 *     security: [{ bearerAuth: [] }]
 *     requestBody: { content: { application/json: { example: { productId: 665f1c2e8b3a4c0012ab34cd } } } }
 *     responses: { 200: { description: Updated wishlist } }
 * /wishlist/{productId}:
 *   delete:
 *     tags: [Wishlist]
 *     summary: Remove a product
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: productId, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Updated wishlist } }
 */
wishlistRouter.get('/', shop.getWishlist);
wishlistRouter.post('/', validate({ body: wishlistSchema }), shop.addToWishlist);
wishlistRouter.delete('/:productId', validate({ params: productIdParams }), shop.removeFromWishlist);

// -------------------------------- Addresses -------------------------------
export const addressRouter = Router();
addressRouter.use(...customerOnly);

/**
 * @openapi
 * /addresses:
 *   get:
 *     tags: [Addresses]
 *     summary: My saved addresses (default first)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Addresses } }
 *   post:
 *     tags: [Addresses]
 *     summary: Save an address (max 10; the first one becomes the default)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           example: { fullName: Ram Kumar, phone: "+919876543210", line1: 12 MG Road, city: Bengaluru, state: Karnataka, postalCode: "560001", type: home }
 *     responses: { 201: { description: Saved } }
 * /addresses/{id}:
 *   patch:
 *     tags: [Addresses]
 *     summary: Update an address
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Addresses]
 *     summary: Delete an address
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Deleted } }
 * /addresses/{id}/default:
 *   patch:
 *     tags: [Addresses]
 *     summary: Make this the default address
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Updated } }
 */
addressRouter.get('/', shop.listAddresses);
addressRouter.post('/', validate({ body: createAddressSchema }), shop.createAddress);
addressRouter.patch('/:id', validate({ params: idParams, body: updateAddressSchema }), shop.updateAddress);
addressRouter.patch('/:id/default', validate({ params: idParams }), shop.setDefaultAddress);
addressRouter.delete('/:id', validate({ params: idParams }), shop.deleteAddress);

// --------------------------------- Orders ---------------------------------
export const orderRouter = Router();
orderRouter.use(...customerOnly);

/**
 * @openapi
 * /orders:
 *   post:
 *     tags: [Orders]
 *     summary: Place an order from the cart (checkout)
 *     description: |
 *       Stock is checked and reserved in one transaction; the order is split into one shipment per seller.
 *       Send a new UUID as `idempotencyKey` per checkout: retrying with the same key returns the same order (200).
 *       `cod` orders are confirmed immediately; `manual` orders need `utr` and wait for payment verification.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           example: { addressId: 665f1c2e8b3a4c0012ab34cd, paymentMethod: cod, idempotencyKey: 3f2b7c1e-9a4d-4c55-8f0e-2b1d7e6a9c10 }
 *     responses:
 *       201: { description: Order placed }
 *       200: { description: Same idempotencyKey, existing order returned }
 *       409: { description: "Cart changed: price/stock/availability (code CART_CHANGED)" }
 *   get:
 *     tags: [Orders]
 *     summary: My orders (newest first)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: "{ items, pagination }" } }
 * /orders/{orderNumber}:
 *   get:
 *     tags: [Orders]
 *     summary: One of my orders with its shipments and timelines
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: orderNumber, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Order }, 404: { description: Not found } }
 * /orders/{orderNumber}/cancel:
 *   post:
 *     tags: [Orders]
 *     summary: Cancel the order (or one shipment) before it ships. Stock is returned.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: orderNumber, required: true, schema: { type: string } }]
 *     requestBody: { content: { application/json: { example: { reason: Ordered by mistake } } } }
 *     responses: { 200: { description: Updated order }, 409: { description: Already shipped (code NOT_CANCELLABLE) } }
 */
orderRouter.post('/', writeLimiter, requireVerifiedEmail, validate({ body: placeOrderSchema }), shop.placeOrder);
orderRouter.get('/', validate({ query: myOrdersQuery }), shop.listMyOrders);
orderRouter.get('/:orderNumber', validate({ params: orderNumberParams }), shop.getMyOrder);
orderRouter.post('/:orderNumber/cancel', validate({ params: orderNumberParams, body: cancelOrderSchema }), shop.cancelMyOrder);

/**
 * @openapi
 * /orders/{orderNumber}/payment:
 *   post:
 *     tags: [Orders]
 *     summary: Submit a new UTR after the previous one was rejected
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: orderNumber, required: true, schema: { type: string } }]
 *     requestBody: { content: { application/json: { example: { utr: "412345678901" } } } }
 *     responses: { 200: { description: Waiting for verification again }, 409: { description: Not rejected or UTR already used } }
 */
orderRouter.post(
  '/:orderNumber/returns',
  writeLimiter,
  validate({ params: orderNumberParams, body: requestReturnSchema }),
  engagement.requestReturn,
);
orderRouter.post(
  '/:orderNumber/payment',
  validate({ params: orderNumberParams, body: resubmitPaymentSchema }),
  paymentController.resubmitPayment,
);
