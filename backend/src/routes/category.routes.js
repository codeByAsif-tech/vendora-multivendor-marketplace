import { Router } from 'express';
import * as catalogController from '../controllers/catalog.controller.js';
import { validate } from '../middlewares/validate.js';
import { slugParams } from '../validators/catalog.validator.js';

const router = Router();

/**
 * @openapi
 * /categories:
 *   get:
 *     tags: [Catalog]
 *     summary: Active categories as a tree (public)
 *     responses:
 *       200:
 *         description: Category tree
 *         content:
 *           application/json:
 *             example: { success: true, data: { categories: [{ _id: "...", name: Fashion, slug: fashion, children: [{ _id: "...", name: T-Shirts, slug: fashion-t-shirts }] }] } }
 * /categories/{slug}:
 *   get:
 *     tags: [Catalog]
 *     summary: One active category with its parent (breadcrumbs) and subcategories
 *     parameters: [{ in: path, name: slug, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Category }, 404: { description: Not found or inactive } }
 */
router.get('/', catalogController.categoryTree);
router.get('/:slug', validate({ params: slugParams }), catalogController.getCategory);

export default router;
