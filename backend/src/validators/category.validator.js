import { z } from 'zod';
import { objectId } from './common.validator.js';

const name = z.string().trim().min(2, 'Name must be at least 2 characters').max(60);
const parent = objectId.nullable();
const description = z.string().trim().max(500);
const isActive = z.boolean();
const sortOrder = z.number().int().min(0).max(9999);

export const createCategorySchema = z
  .object({
    name,
    parent: parent.optional().default(null),
    description: description.optional().default(''),
    isActive: isActive.optional().default(true),
    sortOrder: sortOrder.optional().default(0),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: name.optional(),
    parent: parent.optional(),
    description: description.optional(),
    isActive: isActive.optional(),
    sortOrder: sortOrder.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });
