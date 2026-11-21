import { z } from 'zod';
import { ROLE_VALUES } from '../utils/constants.js';

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

// Rules for NEW passwords (sign-up, reset, change). Login does not check them, so older passwords still work.
// bcrypt only uses the first 72 bytes, so cap the length. Keep in sync with frontend/src/utils/password.js.
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Z]/, 'Password must contain a capital letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character (e.g. ! @ # $ %)');

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{10,15}$/, 'Enter a valid phone number')
  .optional()
  .or(z.literal('').transform(() => undefined));

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    email,
    password,
    phone,
  })
  .strict();

export const loginSchema = z
  .object({
    email,
    password: z.string().min(1, 'Password is required').max(72),
    portal: z.enum(ROLE_VALUES).optional(),
  })
  .strict();

/** One-time token from an email link (base64url, 43 characters for 32 bytes). */
const emailToken = z.string().trim().regex(/^[A-Za-z0-9_-]{20,100}$/, 'This link is invalid');

export const verifyEmailSchema = z.object({ token: emailToken }).strict();

export const forgotPasswordSchema = z.object({ email }).strict();

export const resetPasswordSchema = z.object({ token: emailToken, password }).strict();

/** PATCH /auth/me: own name and phone. Email and role cannot be changed here. */
export const updateMeSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^(\+?[0-9]{10,15})?$/, 'Enter a valid phone number')
      .optional(), // '' removes the phone number
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Send a field to change' });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(72),
    newPassword: password,
  })
  .strict()
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from the current one',
  });
