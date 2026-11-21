import { Router } from 'express';
import adminRoutes from './admin.routes.js';
import authRoutes from './auth.routes.js';
import { productRouter, storeRouter } from './catalog.routes.js';
import categoryRoutes from './category.routes.js';
import { notificationRouter, returnRouter } from './engagement.routes.js';
import sellerRoutes from './seller.routes.js';
import { publicSettings } from '../controllers/settings.controller.js';
import { addressRouter, cartRouter, orderRouter, wishlistRouter } from './shop.routes.js';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Health check
 *     responses:
 *       200: { description: API is running }
 */
router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', uptime: Math.round(process.uptime()) } });
});

router.use('/auth', authRoutes);
// Delivery terms, announcement and support contact for the storefront (public, no secrets).
router.get('/settings', publicSettings);
router.use('/categories', categoryRoutes);
router.use('/products', productRouter);
router.use('/stores', storeRouter);
router.use('/cart', cartRouter);
router.use('/wishlist', wishlistRouter);
router.use('/addresses', addressRouter);
router.use('/orders', orderRouter);
router.use('/returns', returnRouter);
router.use('/notifications', notificationRouter);
router.use('/seller', sellerRoutes);
router.use('/admin', adminRoutes);

export default router;
