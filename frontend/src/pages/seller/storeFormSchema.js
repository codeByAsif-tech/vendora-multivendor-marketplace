import { z } from 'zod'

// Mirrors backend/src/validators/seller.validator.js. Values are uppercased before sending.
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/i
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/i

export const BUSINESS_TYPES = ['individual', 'proprietorship', 'partnership', 'private_limited', 'llp', 'other']

/** isNew: the bank account number is required only on the first submission. */
export function makeStoreSchema(isNew) {
  return z.object({
    storeName: z.string().trim().min(3, 'Store name must be at least 3 characters').max(60),
    description: z.string().trim().max(1000, 'Keep it under 1000 characters'),
    businessType: z.enum(BUSINESS_TYPES, { message: 'Choose a business type' }),
    pan: z.string().trim().regex(PAN, 'Enter a valid PAN (e.g. ABCDE1234F)'),
    gstin: z.string().trim().refine((v) => v === '' || GSTIN.test(v), 'Enter a valid 15-character GSTIN'),
    contactEmail: z.string().trim().email('Enter a valid email address'),
    contactPhone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, 'Enter a valid phone number'),
    pickupAddress: z.object({
      line1: z.string().trim().min(3, 'Address is required').max(120),
      line2: z.string().trim().max(120),
      city: z.string().trim().min(2, 'City is required').max(60),
      state: z.string().trim().min(2, 'State is required').max(60),
      postalCode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit PIN code'),
      country: z.string().trim().min(2).max(60),
    }),
    bank: z.object({
      accountHolderName: z.string().trim().min(2, 'Account holder name is required').max(80),
      bankName: z.string().trim().min(2, 'Bank name is required').max(80),
      ifsc: z.string().trim().regex(IFSC, 'Enter a valid IFSC code (e.g. HDFC0001234)'),
      accountNumber: isNew
        ? z.string().trim().regex(/^[0-9]{9,18}$/, 'Enter a valid account number (9–18 digits)')
        : z.string().trim().refine((v) => v === '' || /^[0-9]{9,18}$/.test(v), 'Enter a valid account number (9–18 digits)'),
    }),
  })
}

export function storeToForm(store, user) {
  return {
    storeName: store?.storeName ?? '',
    description: store?.description ?? '',
    businessType: store?.businessType ?? '',
    pan: store?.pan ?? '',
    gstin: store?.gstin ?? '',
    contactEmail: store?.contactEmail ?? user?.email ?? '',
    contactPhone: store?.contactPhone ?? user?.phone ?? '',
    pickupAddress: {
      line1: store?.pickupAddress?.line1 ?? '',
      line2: store?.pickupAddress?.line2 ?? '',
      city: store?.pickupAddress?.city ?? '',
      state: store?.pickupAddress?.state ?? '',
      postalCode: store?.pickupAddress?.postalCode ?? '',
      country: store?.pickupAddress?.country ?? 'India',
    },
    bank: {
      accountHolderName: store?.bank?.accountHolderName ?? '',
      bankName: store?.bank?.bankName ?? '',
      ifsc: store?.bank?.ifsc ?? '',
      accountNumber: '',
    },
  }
}

export function formToPayload(values) {
  return {
    ...values,
    pan: values.pan.toUpperCase(),
    gstin: values.gstin.toUpperCase(),
    bank: { ...values.bank, ifsc: values.bank.ifsc.toUpperCase() },
  }
}
