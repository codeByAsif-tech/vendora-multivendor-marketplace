import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const common = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { success: false, message: 'Too many requests. Please try again later.' },
};

/** General API limiter: 300 requests / 15 minutes per IP. */
export const apiLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 300 });

/** Session refresh: generous (every open tab refreshes), but stops scripted hammering. */
export const refreshLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 120 });

/** Coupon codes: stops guessing codes by trying many. Counted per signed-in user, not per IP. */
export const couponLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 15,
  keyGenerator: (req) => `coupon:${req.user?.id}`,
  message: { success: false, message: 'Too many coupon attempts. Please try again in 15 minutes.' },
});

/** Writes that create records (orders, returns, reviews): plenty for real use, blocks spam. */
export const writeLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => `write:${req.user?.id}`,
});

/** Endpoints that send emails (forgot password, resend verification): stops mailbox flooding. */
export const emailLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { success: false, message: 'Too many email requests. Please try again in 15 minutes.' },
});

/** Strict limiter for login/register to slow down brute-force attempts. */
export const authLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
});
