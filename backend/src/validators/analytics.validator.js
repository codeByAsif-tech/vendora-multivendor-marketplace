import { z } from 'zod';
import { RANGES } from '../services/analytics.service.js';

export const analyticsQuery = z.object({
  range: z.enum(Object.keys(RANGES)).default('30d'),
});
