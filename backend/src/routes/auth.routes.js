import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authLimiter, emailLimiter, refreshLimiter } from '../middlewares/rateLimiter.js';
import { validate } from '../middlewares/validate.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateMeSchema,
  verifyEmailSchema,
} from '../validators/auth.validator.js';

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a customer account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterInput' }
 *     responses:
 *       201:
 *         description: Account created. Sets the httpOnly refresh cookie.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       409: { description: Email already registered }
 */
router.post('/register', authLimiter, validate({ body: registerSchema }), authController.registerCustomer);

/**
 * @openapi
 * /auth/register-seller:
 *   post:
 *     tags: [Auth]
 *     summary: Register a seller account (store profile is added in Phase 2)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterInput' }
 *     responses:
 *       201:
 *         description: Seller account created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       409: { description: Email already registered }
 */
router.post(
  '/register-seller',
  authLimiter,
  validate({ body: registerSchema }),
  authController.registerSeller,
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in. Optional `portal` makes sure the account role matches the login page.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginInput' }
 *     responses:
 *       200:
 *         description: Logged in. Sets the httpOnly refresh cookie.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       401: { description: Invalid email or password }
 *       403: { description: Account blocked, or wrong portal for this role }
 */
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange the refresh cookie for a new access token (rotates the refresh token)
 *     responses:
 *       200:
 *         description: New access token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       401: { description: Missing, invalid, expired or reused refresh token }
 */
router.post('/refresh', refreshLimiter, authController.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke the current refresh token and clear the cookie
 *     responses:
 *       200: { description: Logged out }
 */
router.post('/logout', authController.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Current user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { $ref: '#/components/schemas/User' }
 *       401: { description: Not authenticated }
 */
router.get('/me', authenticate, authController.me);

/**
 * @openapi
 * /auth/me:
 *   patch:
 *     tags: [Auth]
 *     summary: Update own name and/or phone (any role)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           example: { name: 'Ram Kumar', phone: '+919876543210' }
 *     responses:
 *       200: { description: Updated user }
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change own password (needs the current one); signs out other devices
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           example: { currentPassword: 'OldPassw0rd!', newPassword: 'NewPassw0rd!' }
 *     responses:
 *       200: { description: New access token (and refresh cookie) for this device }
 *       400: { description: Wrong current password or weak new password }
 */
router.patch('/me', authenticate, validate({ body: updateMeSchema }), authController.updateMe);
router.post('/change-password', authenticate, authLimiter, validate({ body: changePasswordSchema }), authController.changePassword);

/**
 * @openapi
 * /auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Confirm the email address with the token from the verification email
 *     requestBody:
 *       content:
 *         application/json:
 *           example: { token: '<token from the link>' }
 *     responses:
 *       200: { description: Verified (returns the user) }
 *       400: { description: Invalid or expired link (TOKEN_INVALID) }
 * /auth/verify-email/resend:
 *   post:
 *     tags: [Auth]
 *     summary: Send a new verification link (signed in, once a minute, 5 per 15 minutes)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Sent }
 *       409: { description: Already verified }
 *       429: { description: Asked too soon }
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Email a password reset link (same answer whether or not the account exists)
 *     requestBody:
 *       content:
 *         application/json:
 *           example: { email: 'ram@example.com' }
 *     responses:
 *       200: { description: Always the same message }
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Set a new password with the token from the email; signs out every device
 *     requestBody:
 *       content:
 *         application/json:
 *           example: { token: '<token from the link>', password: 'NewPassw0rd!' }
 *     responses:
 *       200: { description: Password changed }
 *       400: { description: Invalid or expired link, or weak password }
 */
router.post('/verify-email', authLimiter, validate({ body: verifyEmailSchema }), authController.verifyEmail);
router.post('/verify-email/resend', authenticate, emailLimiter, authController.resendVerification);
router.post('/forgot-password', emailLimiter, validate({ body: forgotPasswordSchema }), authController.forgotPassword);
router.post('/reset-password', authLimiter, validate({ body: resetPasswordSchema }), authController.resetPassword);

export default router;
