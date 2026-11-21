import * as catalogService from '../services/catalog.service.js';
import * as categoryService from '../services/category.service.js';
import { sendSuccess } from '../utils/response.js';

export async function listProducts(req, res) {
  const data = await catalogService.listProducts(req.validatedQuery);
  return sendSuccess(res, { data });
}

export async function getProduct(req, res) {
  const data = await catalogService.getProductBySlug(req.params.slug);
  return sendSuccess(res, { data });
}

export async function categoryTree(_req, res) {
  const categories = await categoryService.getCategoryTree();
  return sendSuccess(res, { data: { categories } });
}

export async function getCategory(req, res) {
  const category = await catalogService.getCategoryBySlug(req.params.slug);
  return sendSuccess(res, { data: { category } });
}

export async function getStore(req, res) {
  const store = await catalogService.getStoreBySlug(req.params.slug);
  return sendSuccess(res, { data: { store } });
}
