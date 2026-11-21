import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import * as engagement from '../controllers/engagement.controller.js';
import * as earningsController from '../controllers/earnings.controller.js';
import * as orderController from '../controllers/orderManagement.controller.js';
import * as productController from '../controllers/sellerProduct.controller.js';
import * as storeController from '../controllers/sellerStore.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireApprovedSeller } from '../middlewares/requireApprovedSeller.js';
import { requireVerifiedEmail } from '../middlewares/requireVerifiedEmail.js';
import { uploadImageFields, uploadImages } from '../middlewares/upload.js';
import { validate } from '../middlewares/validate.js';
import { PRODUCT_LIMITS, ROLES } from '../utils/constants.js';
import { analyticsQuery } from '../validators/analytics.validator.js';
import { idParams } from '../validators/common.validator.js';
import { ledgerQuery, sellerPayoutsQuery } from '../validators/earnings.validator.js';
import { decideReturnSchema, returnListQuery } from '../validators/engagement.validator.js';
import {
  createProductSchema,
  inventoryListQuery,
  sellerProductListQuery,
  stockUpdateSchema,
  updateProductSchema,
  variantParams,
  visibilitySchema,
} from '../validators/product.validator.js';
import { storeMediaPatchSchema, storeProfilePatchSchema, storeProfileSchema } from '../validators/seller.validator.js';
import { orderListQuery, orderStatusSchema } from '../validators/shop.validator.js';

const router = Router();

// Every seller route: logged-in seller. All data is scoped to req.user.id inside the services.
router.use(authenticate, authorize(ROLES.SELLER));

/* ----------------------------- Store profile ----------------------------- */

/**
 * @openapi
 * /seller/profile:
 *   get:
 *     tags: [Seller store]
 *     summary: My store profile (`store` is null until the first submission)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Store profile } }
 *   put:
 *     tags: [Seller store]
 *     summary: Create (submit for review) or update my store profile
 *     description: |
 *       First save creates the profile with status `pending`. Saving a `rejected` profile resubmits it.
 *       `bank.accountNumber` is required the first time; leave it empty later to keep the saved one.
 *       The full account number is stored encrypted and only the last 4 digits are ever returned.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             storeName: Urban Threads
 *             description: Everyday cotton wear, made in Tiruppur.
 *             businessType: proprietorship
 *             gstin: 33ABCDE1234F1Z5
 *             pan: ABCDE1234F
 *             contactEmail: hello@urbanthreads.in
 *             contactPhone: "+919876543210"
 *             pickupAddress: { line1: 12 Mill Road, city: Tiruppur, state: Tamil Nadu, postalCode: "641601" }
 *             bank: { accountHolderName: Ram Kumar, bankName: HDFC Bank, ifsc: HDFC0001234, accountNumber: "50100123456789" }
 *     responses:
 *       201: { description: Submitted for review }
 *       200: { description: Saved }
 *       400: { $ref: '#/components/responses/ValidationError' }
 */
router.get('/profile', storeController.getMyStore);
router.put('/profile', requireVerifiedEmail, validate({ body: storeProfileSchema }), storeController.saveMyStore);
/**
 * @openapi
 * /seller/profile:
 *   patch:
 *     tags: [Seller store]
 *     summary: Change only some store fields
 *     description: Send only the fields that change (same names as PUT). Nested pickupAddress and bank fields are merged with the saved ones; the bank account number is kept unless sent.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           example: { contactPhone: '+919812345678', pickupAddress: { city: 'Coimbatore' } }
 *     responses:
 *       200: { description: Updated store }
 *       404: { description: No store yet (use PUT first) }
 */
router.patch('/profile', requireVerifiedEmail, validate({ body: storeProfilePatchSchema }), storeController.patchMyStore);

/**
 * @openapi
 * /seller/profile/media:
 *   put:
 *     tags: [Seller store]
 *     summary: Upload store logo and/or banner (multipart, JPG/PNG/WebP, max 5 MB each)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               logo: { type: string, format: binary }
 *               banner: { type: string, format: binary }
 *     responses: { 200: { description: Updated store } }
 */
router.put(
  '/profile/media',
  ...uploadImageFields([
    { name: 'logo', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
  ]),
  storeController.updateMyStoreMedia,
);

/**
 * @openapi
 * /seller/profile/media:
 *   patch:
 *     tags: [Seller store]
 *     summary: Change only the logo, only the banner, or remove one (multipart)
 *     description: Send a `logo` and/or `banner` file; images not sent stay as they are. Send `remove` = logo, banner or both to delete an image.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               logo: { type: string, format: binary }
 *               banner: { type: string, format: binary }
 *               remove: { type: string, enum: [logo, banner, both] }
 *     responses:
 *       200: { description: Updated store }
 */
router.patch(
  '/profile/media',
  ...uploadImageFields([
    { name: 'logo', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
  ]),
  validate({ body: storeMediaPatchSchema }),
  storeController.patchMyStoreMedia,
);

/* ------------------------------- Products ------------------------------- */

/**
 * @openapi
 * /seller/products:
 *   get:
 *     tags: [Seller products]
 *     summary: My products (search, status, category, stock, sort, pagination)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string, enum: [pending, approved, rejected] } }
 *       - { in: query, name: stock, schema: { type: string, enum: [in, out] } }
 *       - { in: query, name: sort, schema: { type: string, enum: [newest, oldest, price_asc, price_desc, stock_asc, name_asc] } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *     responses: { 200: { description: "{ items, pagination, counts }" } }
 *   post:
 *     tags: [Seller products]
 *     summary: Create a product (approved stores only). Goes to admin review.
 *     description: Prices are integers in paise (₹799 = 79900). Upload images first via /seller/uploads/product-images.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             name: Classic Cotton Crew T-Shirt
 *             brand: Urban Threads
 *             category: 665f1c2e8b3a4c0012ab34cd
 *             description: Soft 180 GSM combed cotton tee with a relaxed fit.
 *             highlights: [100% cotton, Pre-shrunk]
 *             images: [{ url: "https://res.cloudinary.com/demo/image/upload/v1/marketplace/products/665f/abc.jpg", publicId: marketplace/products/665f/abc }]
 *             variants:
 *               - { sku: TS-BLK-M, attributes: [{ name: Color, value: Black }, { name: Size, value: M }], price: 99900, salePrice: 79900, stock: 25 }
 *               - { sku: TS-BLK-L, attributes: [{ name: Color, value: Black }, { name: Size, value: L }], price: 99900, salePrice: 79900, stock: 10 }
 *             specifications: [{ key: Fabric, value: Cotton }]
 *             tags: [tshirt, cotton]
 *     responses:
 *       201: { description: Created with status pending }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       403: { description: Store not approved (code STORE_PENDING / STORE_REJECTED / STORE_SUSPENDED / STORE_PROFILE_REQUIRED) }
 *       409: { description: SKU already used by another of your products }
 */
router.get('/products', validate({ query: sellerProductListQuery }), productController.list);
router.post('/products', requireApprovedSeller, validate({ body: createProductSchema }), productController.create);

/**
 * @openapi
 * /seller/products/{id}:
 *   get:
 *     tags: [Seller products]
 *     summary: One of my products (404 if it belongs to another seller)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Product }, 404: { description: Not found } }
 *   patch:
 *     tags: [Seller products]
 *     summary: Update a product. Content changes send it back to review; price/stock changes do not.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Updated product } }
 *   delete:
 *     tags: [Seller products]
 *     summary: Delete (soft) a product
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Deleted } }
 */
router.get('/products/:id', validate({ params: idParams }), productController.getOne);
router.patch(
  '/products/:id',
  requireApprovedSeller,
  validate({ params: idParams, body: updateProductSchema }),
  productController.update,
);
router.delete('/products/:id', requireApprovedSeller, validate({ params: idParams }), productController.remove);

/**
 * @openapi
 * /seller/products/{id}/visibility:
 *   patch:
 *     tags: [Seller products]
 *     summary: Show or hide a product in the storefront
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody: { content: { application/json: { example: { isActive: false } } } }
 *     responses: { 200: { description: Updated product } }
 */
router.patch(
  '/products/:id/visibility',
  requireApprovedSeller,
  validate({ params: idParams, body: visibilitySchema }),
  productController.setVisibility,
);

/**
 * @openapi
 * /seller/uploads/product-images:
 *   post:
 *     tags: [Seller products]
 *     summary: Upload up to 8 product images (field "images"). Returns [{ url, publicId }] to use in the product body.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images: { type: array, items: { type: string, format: binary } }
 *     responses: { 201: { description: Uploaded images } }
 */
router.post(
  '/uploads/product-images',
  requireApprovedSeller,
  ...uploadImages('images', PRODUCT_LIMITS.MAX_IMAGES),
  productController.uploadImages,
);

/* ------------------------------- Inventory ------------------------------ */

/**
 * @openapi
 * /seller/inventory:
 *   get:
 *     tags: [Seller inventory]
 *     summary: One row per SKU, lowest stock first
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: stock, schema: { type: string, enum: [low, out] } }
 *       - { in: query, name: search, schema: { type: string } }
 *     responses: { 200: { description: "{ items, pagination }" } }
 * /seller/inventory/stats:
 *   get:
 *     tags: [Seller inventory]
 *     summary: Inventory totals (products, SKUs, units, low/out of stock, stock value in paise)
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: Stats } }
 * /seller/inventory/{productId}/variants/{variantId}:
 *   patch:
 *     tags: [Seller inventory]
 *     summary: Set stock (and optionally the low-stock threshold) of one SKU
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: productId, required: true, schema: { type: string } }
 *       - { in: path, name: variantId, required: true, schema: { type: string } }
 *     requestBody: { content: { application/json: { example: { stock: 40, lowStockThreshold: 5 } } } }
 *     responses: { 200: { description: Updated stock } }
 */
router.get('/inventory', validate({ query: inventoryListQuery }), productController.inventory);
router.get('/inventory/stats', productController.inventoryStats);
router.patch(
  '/inventory/:productId/variants/:variantId',
  requireApprovedSeller,
  validate({ params: variantParams, body: stockUpdateSchema }),
  productController.updateStock,
);

/* -------------------------------- Orders -------------------------------- */

/**
 * @openapi
 * /seller/orders:
 *   get:
 *     tags: [Seller orders]
 *     summary: My shipments (only items from my store), with status counts
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [pending, confirmed, processing, shipped, out_for_delivery, delivered, cancelled] } }
 *       - { in: query, name: search, schema: { type: string }, description: "Order number, customer name or SKU" }
 *     responses: { 200: { description: "{ items, pagination, counts }" } }
 * /seller/orders/{id}:
 *   get:
 *     tags: [Seller orders]
 *     summary: One shipment with delivery address and timeline (404 if not mine)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Shipment } }
 * /seller/orders/{id}/status:
 *   patch:
 *     tags: [Seller orders]
 *     summary: "Move the shipment forward: confirmed → processing → shipped → out_for_delivery → delivered, or cancel before shipping"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody: { content: { application/json: { example: { status: shipped, carrier: Delhivery, trackingNumber: DL123456789IN } } } }
 *     responses: { 200: { description: Updated }, 409: { description: Not allowed from the current status } }
 */
router.get('/orders', validate({ query: orderListQuery }), orderController.listSellerOrders);
router.get('/orders/:id', validate({ params: idParams }), orderController.getShipment);
router.patch(
  '/orders/:id/status',
  validate({ params: idParams, body: orderStatusSchema }),
  orderController.updateShipmentStatus,
);

/* -------------------------------- Returns ------------------------------- */

router.get('/returns', validate({ query: returnListQuery }), engagement.listReturns);
router.patch('/returns/:id', validate({ params: idParams, body: decideReturnSchema }), engagement.decideReturn);

/* ------------------------------- Analytics ------------------------------ */

router.get('/analytics', validate({ query: analyticsQuery }), analyticsController.sellerReport);

/* ------------------------------- Earnings ------------------------------- */
// Read-only for sellers; payouts are recorded by admins. Works for suspended stores too (it is their money).

router.get('/earnings', earningsController.myWallet);
router.get('/earnings/ledger', validate({ query: ledgerQuery }), earningsController.myLedger);
router.get('/payouts', validate({ query: sellerPayoutsQuery }), earningsController.myPayouts);

export default router;
