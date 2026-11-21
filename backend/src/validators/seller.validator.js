import { z } from 'zod';
import { BUSINESS_TYPES } from '../utils/constants.js';

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const addressSchema = z
  .object({
    line1: z.string().trim().min(3, 'Address is required').max(120),
    line2: z.string().trim().max(120).optional().default(''),
    city: z.string().trim().min(2, 'City is required').max(60),
    state: z.string().trim().min(2, 'State is required').max(60),
    postalCode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit PIN code'),
    country: z.string().trim().min(2).max(60).default('India'),
  })
  .strict();

const bankSchema = z
  .object({
    accountHolderName: z.string().trim().min(2, 'Account holder name is required').max(80),
    bankName: z.string().trim().min(2, 'Bank name is required').max(80),
    ifsc: z.string().trim().toUpperCase().regex(IFSC, 'Enter a valid IFSC code (e.g. HDFC0001234)'),
    // Optional on update: leave empty to keep the saved account number.
    accountNumber: z
      .string()
      .trim()
      .regex(/^[0-9]{9,18}$/, 'Enter a valid account number (9–18 digits)')
      .optional()
      .or(z.literal('')),
  })
  .strict();

export const storeProfileSchema = z
  .object({
    storeName: z.string().trim().min(3, 'Store name must be at least 3 characters').max(60),
    description: z.string().trim().max(1000).optional().default(''),
    businessType: z.enum(BUSINESS_TYPES),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(GSTIN, 'Enter a valid 15-character GSTIN')
      .optional()
      .or(z.literal('')),
    pan: z.string().trim().toUpperCase().regex(PAN, 'Enter a valid PAN (e.g. ABCDE1234F)'),
    contactEmail: z.string().trim().toLowerCase().email('Enter a valid email address'),
    contactPhone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, 'Enter a valid phone number'),
    pickupAddress: addressSchema,
    bank: bankSchema,
  })
  .strict();

/*
 * PATCH /seller/profile: send only the fields that change (at least one).
 * Built without defaults on purpose, so a missing field is never reset (e.g. description to '').
 */
const optionalText = (min, max, message) => z.string().trim().min(min, message).max(max).optional();

export const storeProfilePatchSchema = z
  .object({
    storeName: optionalText(3, 60, 'Store name must be at least 3 characters'),
    description: z.string().trim().max(1000).optional(),
    businessType: z.enum(BUSINESS_TYPES).optional(),
    gstin: z.string().trim().toUpperCase().regex(GSTIN, 'Enter a valid 15-character GSTIN').optional().or(z.literal('')),
    pan: z.string().trim().toUpperCase().regex(PAN, 'Enter a valid PAN (e.g. ABCDE1234F)').optional(),
    contactEmail: z.string().trim().toLowerCase().email('Enter a valid email address').optional(),
    contactPhone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, 'Enter a valid phone number').optional(),
    pickupAddress: z
      .object({
        line1: optionalText(3, 120, 'Address is required'),
        line2: z.string().trim().max(120).optional(),
        city: optionalText(2, 60, 'City is required'),
        state: optionalText(2, 60, 'State is required'),
        postalCode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit PIN code').optional(),
        country: optionalText(2, 60),
      })
      .strict()
      .optional(),
    bank: z
      .object({
        accountHolderName: optionalText(2, 80, 'Account holder name is required'),
        bankName: optionalText(2, 80, 'Bank name is required'),
        ifsc: z.string().trim().toUpperCase().regex(IFSC, 'Enter a valid IFSC code (e.g. HDFC0001234)').optional(),
        accountNumber: z.string().trim().regex(/^[0-9]{9,18}$/, 'Enter a valid account number (9–18 digits)').optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Send at least one field to change' });

/** PATCH /seller/profile/media text field (multipart): remove an image without uploading a new one. */
export const storeMediaPatchSchema = z
  .object({ remove: z.enum(['logo', 'banner', 'both']).optional() })
  .strict();
