import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import * as analyticsController from '../controllers/analytics.controller.js';
import * as earningsController from '../controllers/earnings.controller.js';
import * as engagement from '../controllers/engagement.controller.js';
import * as settingsController from '../controllers/settings.controller.js';
import * as orderController from '../controllers/orderManagement.controller.js';
import * as paymentController from '../controllers/payment.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { uploadSingleImage } from '../middlewares/upload.js';
import { validate } from '../middlewares/validate.js';
import { ROLES } from '../utils/constants.js';
import {
  adminProductListQuery,
  listSellersQuery,
  listUsersQuery,
  moderationSchema,
  sellerStatusSchema,
  userStatusSchema,
} from '../validators/admin.validator.js';
import { createCategorySchema, updateCategorySchema } from '../validators/category.validator.js';
import { analyticsQuery } from '../validators/analytics.validator.js';
import { idParams } from '../validators/common.validator.js';
import { platformSettingsSchema } from '../validators/settings.validator.js';
import {
  balancesQuery,
  commissionSettingsSchema,
  createPayoutSchema,
  payoutsQuery,
  storeCommissionSchema,
} from '../validators/earnings.validator.js';
import {
  adminReviewsQuery,
  couponListQuery,
  createCouponSchema,
  decideReturnSchema,
  moderateReviewSchema,
  returnListQuery,
  updateCouponSchema,
} from '../validators/engagement.validator.js';
import {
  listPaymentsQuery,
  listTransactionsQuery,
  refundSchema,
  rejectPaymentSchema,
} from '../validators/payment.validator.js';
import { orderListQuery, orderStatusSchema } from '../validators/shop.validator.js';

const router = Router();

// Every admin route requires an authenticated admin.
router.use(authenticate, authorize(ROLES.ADMIN));

/**
 * @openapi
 * /admin/overview:
 *   get:
 *     tags: [Admin]
 *     summary: Platform counts for the admin dashboard
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Counts
 *         content:
 *           application/json:
 *             example: { success: true, data: { customers: 12, sellers: 3, admins: 1, approvedSellers: 2, pendingSellers: 1, products: 40, pendingProducts: 5 } }
 *       401: { description: Not authenticated }
 *       403: { description: Not an admin }
 */
router.get('/overview', adminController.overview);
router.get('/analytics', validate({ query: analyticsQuery }), analyticsController.adminReport);

/* -------------------------------- Sellers -------------------------------- */

/**
 * @openapi
 * /admin/sellers:
 *   get:
 *     tags: [Admin sellers]
 *     summary: Seller stores with status counts for tabs
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [pending, approved, rejected, suspended] } }
 *       - { in: query, name: search, schema: { type: string }, description: "Store name, owner name or email" }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *     responses: { 200: { description: "{ items, pagination, counts }" } }
 * /admin/sellers/{id}:
 *   get:
 *     tags: [Admin sellers]
 *     summary: Seller store details with status history
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Seller }, 404: { description: Not found } }
 * /admin/sellers/{id}/status:
 *   patch:
 *     tags: [Admin sellers]
 *     summary: Approve, reject, suspend or reinstate (approve a suspended) seller
 *     description: |
 *       Allowed: pending → approved/rejected, approved → suspended, suspended → approved, rejected → approved.
 *       `reason` (min 5 chars) is required for rejected and suspended. The seller is emailed.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody: { content: { application/json: { example: { status: rejected, reason: PAN number does not match the business name } } } }
 *     responses:
 *       200: { description: Updated seller }
 *       409: { description: Status change not allowed (code INVALID_STATUS_TRANSITION) }
 */
router.get('/sellers', validate({ query: listSellersQuery }), adminController.listSellers);
router.get('/sellers/:id', validate({ params: idParams }), adminController.getSeller);
router.patch(
  '/sellers/:id/status',
  validate({ params: idParams, body: sellerStatusSchema }),
  adminController.updateSellerStatus,
);

router.patch(
  '/sellers/:id/commission',
  validate({ params: idParams, body: storeCommissionSchema }),
  earningsController.updateStoreCommission,
);

/* --------------------------------- Users --------------------------------- */

/**
 * @openapi
 * /admin/users:
 *   get:
 *     tags: [Admin users]
 *     summary: Customer (default) or seller accounts
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: role, schema: { type: string, enum: [customer, seller] } }
 *       - { in: query, name: status, schema: { type: string, enum: [active, blocked] } }
 *       - { in: query, name: search, schema: { type: string } }
 *     responses: { 200: { description: "{ items, pagination, counts }" } }
 * /admin/users/{id}/status:
 *   patch:
 *     tags: [Admin users]
 *     summary: Block or reactivate an account. Blocking signs the user out everywhere.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody: { content: { application/json: { example: { status: blocked, reason: Repeated fraudulent returns } } } }
 *     responses: { 200: { description: Updated user }, 403: { description: Target is an admin } }
 */
router.get('/users', validate({ query: listUsersQuery }), adminController.listUsers);
router.patch(
  '/users/:id/status',
  validate({ params: idParams, body: userStatusSchema }),
  adminController.updateUserStatus,
);

/* ------------------------------- Categories ------------------------------ */

/**
 * @openapi
 * /admin/categories:
 *   get:
 *     tags: [Admin categories]
 *     summary: All categories (flat, with productCount)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Categories } }
 *   post:
 *     tags: [Admin categories]
 *     summary: Create a category or subcategory (max 2 levels)
 *     security: [{ bearerAuth: [] }]
 *     requestBody: { content: { application/json: { example: { name: T-Shirts, parent: 665f1c2e8b3a4c0012ab34cd, description: "", isActive: true, sortOrder: 0 } } } }
 *     responses: { 201: { description: Created }, 409: { description: Name already exists at this level } }
 * /admin/categories/{id}:
 *   patch:
 *     tags: [Admin categories]
 *     summary: Update a category (renaming a parent also updates its subcategory slugs)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Updated } }
 *   delete:
 *     tags: [Admin categories]
 *     summary: Delete a category without subcategories or products
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Deleted }, 409: { description: Has subcategories or products } }
 * /admin/categories/{id}/image:
 *   put:
 *     tags: [Admin categories]
 *     summary: Upload the category image (multipart field "image")
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Updated } }
 */
router.get('/categories', adminController.listCategories);
router.post('/categories', validate({ body: createCategorySchema }), adminController.createCategory);
router.patch(
  '/categories/:id',
  validate({ params: idParams, body: updateCategorySchema }),
  adminController.updateCategory,
);
router.delete('/categories/:id', validate({ params: idParams }), adminController.deleteCategory);
router.put(
  '/categories/:id/image',
  validate({ params: idParams }),
  ...uploadSingleImage('image'),
  adminController.setCategoryImage,
);

/* -------------------------------- Products ------------------------------- */

/**
 * @openapi
 * /admin/products:
 *   get:
 *     tags: [Admin products]
 *     summary: All products for moderation (pending = oldest first)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [pending, approved, rejected] } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: store, schema: { type: string } }
 *       - { in: query, name: category, schema: { type: string } }
 *     responses: { 200: { description: "{ items, pagination, counts }" } }
 * /admin/products/{id}:
 *   get:
 *     tags: [Admin products]
 *     summary: Full product details
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Product } }
 * /admin/products/{id}/moderation:
 *   patch:
 *     tags: [Admin products]
 *     summary: Approve or reject a product (reason required for reject). The seller is emailed.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody: { content: { application/json: { example: { status: rejected, reason: Images show a watermark from another site } } } }
 *     responses: { 200: { description: Updated product } }
 */
router.get('/products', validate({ query: adminProductListQuery }), adminController.listProducts);
router.get('/products/:id', validate({ params: idParams }), adminController.getProduct);
router.patch(
  '/products/:id/moderation',
  validate({ params: idParams, body: moderationSchema }),
  adminController.moderateProduct,
);

/* -------------------------- Payments & transactions ------------------------- */

/**
 * @openapi
 * /admin/payments:
 *   get:
 *     tags: [Admin payments]
 *     summary: "Payments with counts. status=pending_verification is the verification queue (oldest first); status=refund_due lists refunds to make."
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [pending, pending_verification, paid, rejected, cancelled, refund_due] } }
 *       - { in: query, name: method, schema: { type: string, enum: [cod, manual] } }
 *       - { in: query, name: search, schema: { type: string }, description: Order number or UTR }
 *     responses: { 200: { description: "{ items, pagination, counts }" } }
 * /admin/payments/{id}:
 *   get:
 *     tags: [Admin payments]
 *     summary: Payment with its history and transactions
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Payment } }
 * /admin/payments/{id}/verify:
 *   post:
 *     tags: [Admin payments]
 *     summary: "Money found in the bank / UPI statement: mark paid, record the transaction, confirm the order"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Verified }, 409: { description: Not waiting for verification (code PAYMENT_NOT_PENDING) } }
 * /admin/payments/{id}/reject:
 *   post:
 *     tags: [Admin payments]
 *     summary: UTR could not be matched. The customer is emailed and can submit a new UTR.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody: { content: { application/json: { example: { reason: No payment with this UTR in our UPI statement } } } }
 *     responses: { 200: { description: Rejected } }
 * /admin/payments/{id}/refunds:
 *   post:
 *     tags: [Admin payments]
 *     summary: Record a refund made outside the app (amount in paise, up to the refund due)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody: { content: { application/json: { example: { amount: 79900, reference: UPI-REF-889911, note: Cancelled shipment MK2611120A1B2C-2 } } } }
 *     responses: { 200: { description: Refund recorded }, 400: { description: More than the refund due } }
 * /admin/transactions:
 *   get:
 *     tags: [Admin payments]
 *     summary: Money ledger (append-only) with totals for the date range
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: type, schema: { type: string, enum: [payment_received, cod_collected, refund] } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *       - { in: query, name: search, schema: { type: string }, description: Order number or reference }
 *     responses: { 200: { description: "{ items, pagination, summary: { received, codCollected, refunded, net } }" } }
 */
router.get('/payments', validate({ query: listPaymentsQuery }), paymentController.listPayments);
router.get('/payments/:id', validate({ params: idParams }), paymentController.getPayment);
router.post('/payments/:id/verify', validate({ params: idParams }), paymentController.verifyPayment);
router.post('/payments/:id/reject', validate({ params: idParams, body: rejectPaymentSchema }), paymentController.rejectPayment);
router.post('/payments/:id/refunds', validate({ params: idParams, body: refundSchema }), paymentController.recordRefund);
router.get('/transactions', validate({ query: listTransactionsQuery }), paymentController.listTransactions);

/* ------------------------- Commission & payouts ------------------------- */

router.get('/settings', settingsController.adminSettings);
router.put('/settings', validate({ body: platformSettingsSchema }), settingsController.updateSettings);
router.get('/settings/commission', earningsController.getCommission);
router.put('/settings/commission', validate({ body: commissionSettingsSchema }), earningsController.updateCommission);
router.get('/payouts/balances', validate({ query: balancesQuery }), earningsController.listBalances);
router.get('/payouts', validate({ query: payoutsQuery }), earningsController.listPayouts);
router.post('/payouts', validate({ body: createPayoutSchema }), earningsController.createPayout);

/* ------------------------ Reviews, coupons, returns ----------------------- */

router.get('/reviews', validate({ query: adminReviewsQuery }), engagement.adminReviews);
router.patch('/reviews/:id', validate({ params: idParams, body: moderateReviewSchema }), engagement.moderateReview);

router.get('/coupons', validate({ query: couponListQuery }), engagement.listCoupons);
router.post('/coupons', validate({ body: createCouponSchema }), engagement.createCoupon);
router.patch('/coupons/:id', validate({ params: idParams, body: updateCouponSchema }), engagement.updateCoupon);

// Admins see every return and can step in (e.g. a seller who does not respond).
router.get('/returns', validate({ query: returnListQuery }), engagement.listReturns);
router.patch('/returns/:id', validate({ params: idParams, body: decideReturnSchema }), engagement.decideReturn);

/* --------------------------------- Orders -------------------------------- */

/**
 * @openapi
 * /admin/orders:
 *   get:
 *     tags: [Admin orders]
 *     summary: All orders (search by order number, customer name or email)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: "{ items, pagination, counts }" } }
 * /admin/orders/{id}:
 *   get:
 *     tags: [Admin orders]
 *     summary: Full order with customer, payment and every shipment
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Order } }
 * /admin/seller-orders/{id}/status:
 *   patch:
 *     tags: [Admin orders]
 *     summary: Confirm a shipment waiting for payment, or cancel one that has not shipped (fulfilment is done by sellers)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Updated } }
 */
router.get('/orders', validate({ query: orderListQuery }), orderController.listAllOrders);
router.get('/orders/:id', validate({ params: idParams }), orderController.getOrderForAdmin);
router.patch(
  '/seller-orders/:id/status',
  validate({ params: idParams, body: orderStatusSchema }),
  orderController.updateShipmentStatus,
);

export default router;
