import { z } from 'zod'
import { PASSWORD_MAX, PASSWORD_RULES } from '@/utils/password'

// Mirrors backend/src/validators/auth.validator.js so users see errors before submitting.
export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
    phone: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\+?[0-9]{10,15}$/.test(v), 'Enter a valid phone number'),
    password: PASSWORD_RULES.reduce(
      (schema, rule) => schema.refine(rule.test, `Password needs ${rule.label.charAt(0).toLowerCase()}${rule.label.slice(1)}`),
      z.string().max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`),
    ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
