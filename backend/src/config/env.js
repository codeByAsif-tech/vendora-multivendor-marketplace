import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    APP_NAME: z.string().min(1).default('Vendora'),
    CLIENT_URL: z.string().min(1).default('http://localhost:5173'),

    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
    // A rotated token presented again within this window (e.g. two tabs refreshing at once)
    // is rejected, but not treated as theft.
    REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().min(0).default(10),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    COOKIE_SECURE: booleanString,

    // AES-256-GCM key for sensitive data at rest (seller bank account numbers).
    DATA_ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, 'DATA_ENCRYPTION_KEY must be 64 hex characters (32 bytes)'),

    // ---- Email (SMTP). Leave SMTP_HOST empty to only log emails. ----
    MAIL_FROM: z.string().min(1).default('Vendora <no-reply@vendora.local>'),
    SMTP_HOST: z.string().default(''),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().default(''),
    SMTP_PASS: z.string().default(''),
    SMTP_SECURE: booleanString,

    // ---- File uploads ----
    UPLOAD_DRIVER: z.enum(['local', 'cloudinary']).default('local'),
    UPLOAD_DIR: z.string().min(1).default('uploads'),
    // Trimmed: a stray space or line ending copied with the key breaks the upload signature.
    CLOUDINARY_CLOUD_NAME: z.string().trim().default(''),
    CLOUDINARY_API_KEY: z.string().trim().default(''),
    CLOUDINARY_API_SECRET: z.string().trim().default(''),

    // ---- Seller earnings (Phase 7) ----
    // Platform commission (%) used until an admin changes it in the admin panel.
    DEFAULT_COMMISSION_RATE: z.coerce.number().min(0).max(50).default(10),
    // Days after delivery before an earning can be paid out (room for returns).
    EARNINGS_HOLD_DAYS: z.coerce.number().int().min(0).max(60).default(7),

    // ---- Accounts ----
    // true = customers must verify their email before placing an order, and sellers before submitting their store.
    REQUIRE_VERIFIED_EMAIL: booleanString,

    // ---- Deployment ----
    // Number of reverse proxies in front of the API (Nginx, Render, Railway = 1). 0 = exposed directly.
    // Needed for the real client IP (rate limits) and secure cookies; never trust more hops than exist.
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
  })
  .superRefine((value, ctx) => {
    const fail = (key, message) => ctx.addIssue({ code: 'custom', path: [key], message });

    if (value.UPLOAD_DRIVER === 'cloudinary') {
      for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
        if (!value[key]) fail(key, `${key} is required when UPLOAD_DRIVER=cloudinary`);
      }
    }

    // Browsers drop SameSite=None cookies that are not Secure: login would silently break.
    if (value.COOKIE_SAMESITE === 'none' && !value.COOKIE_SECURE) {
      fail('COOKIE_SECURE', 'COOKIE_SECURE must be true when COOKIE_SAMESITE=none');
    }

    // Production must not start with development settings.
    if (value.NODE_ENV === 'production') {
      if (!value.COOKIE_SECURE) fail('COOKIE_SECURE', 'must be true in production (HTTPS only)');
      if (value.UPLOAD_DRIVER !== 'cloudinary') {
        fail('UPLOAD_DRIVER', 'must be cloudinary in production (local files are lost on redeploy)');
      }
      for (const origin of value.CLIENT_URL.split(',').map((o) => o.trim()).filter(Boolean)) {
        if (!origin.startsWith('https://')) fail('CLIENT_URL', `must use https:// in production (got ${origin})`);
      }
      if (/change|secret|example|test/i.test(value.JWT_ACCESS_SECRET)) {
        fail('JWT_ACCESS_SECRET', 'looks like a placeholder; generate a random value');
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  // Logger depends on env, so use console here and fail fast.
  console.error(`Invalid environment configuration:\n${problems}`);
  process.exit(1);
}

const raw = parsed.data;
const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const clientOrigins = raw.CLIENT_URL.split(',').map((origin) => origin.trim()).filter(Boolean);

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  clientOrigins,
  /** Public storefront URL used in email links. */
  appUrl: clientOrigins[0],
  // Relative to the backend folder (not the folder the server was started from), so local
  // uploads are always found in the same place.
  uploadRoot: path.resolve(BACKEND_ROOT, raw.UPLOAD_DIR),
};
