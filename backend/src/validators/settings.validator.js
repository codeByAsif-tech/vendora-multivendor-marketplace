import { z } from 'zod';

const paise = z.number().int().min(0);

/** PUT /admin/settings: send the sections (and fields) that change. Money in paise. */
export const platformSettingsSchema = z
  .object({
    shipping: z
      .object({
        fee: paise.max(100_000, 'Delivery fee can be at most ₹1000'),
        freeThreshold: paise.max(10_000_000),
        firstOrderFree: z.boolean(),
      })
      .partial()
      .strict()
      .optional(),
    announcement: z
      .object({ message: z.string().trim().max(140, 'Keep the announcement under 140 characters') })
      .partial()
      .strict()
      .optional(),
    support: z
      .object({
        email: z.string().trim().toLowerCase().email('Enter a valid email').or(z.literal('')),
        phone: z.string().trim().regex(/^(\+?[0-9]{10,15})?$/, 'Enter a valid phone number'),
      })
      .partial()
      .strict()
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Send at least one section to change' });
