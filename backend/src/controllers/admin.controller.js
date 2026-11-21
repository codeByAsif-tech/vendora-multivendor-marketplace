import * as adminProductService from '../services/adminProduct.service.js';
import * as adminService from '../services/admin.service.js';
import * as adminSellerService from '../services/adminSeller.service.js';
import * as adminUserService from '../services/adminUser.service.js';
import * as categoryService from '../services/category.service.js';
import { sendSuccess } from '../utils/response.js';

export async function overview(_req, res) {
  const data = await adminService.getOverview();
  return sendSuccess(res, { data });
}

// ---- Sellers ----
export async function listSellers(req, res) {
  const data = await adminSellerService.listSellers(req.validatedQuery);
  return sendSuccess(res, { data });
}

export async function getSeller(req, res) {
  const seller = await adminSellerService.getSeller(req.params.id);
  return sendSuccess(res, { data: { seller } });
}

export async function updateSellerStatus(req, res) {
  const seller = await adminSellerService.updateSellerStatus(req.params.id, req.body, req.user);
  return sendSuccess(res, { message: `Seller ${seller.status}`, data: { seller } });
}

// ---- Users ----
export async function listUsers(req, res) {
  const data = await adminUserService.listUsers(req.validatedQuery);
  return sendSuccess(res, { data });
}

export async function updateUserStatus(req, res) {
  const user = await adminUserService.updateUserStatus(req.params.id, req.body, req.user);
  return sendSuccess(res, {
    message: user.status === 'blocked' ? 'User blocked' : 'User reactivated',
    data: { user },
  });
}

// ---- Categories ----
export async function listCategories(_req, res) {
  const categories = await categoryService.listCategoriesForAdmin();
  return sendSuccess(res, { data: { categories } });
}

export async function createCategory(req, res) {
  const category = await categoryService.createCategory(req.body);
  return sendSuccess(res, { status: 201, message: 'Category created', data: { category } });
}

export async function updateCategory(req, res) {
  const category = await categoryService.updateCategory(req.params.id, req.body);
  return sendSuccess(res, { message: 'Category updated', data: { category } });
}

export async function setCategoryImage(req, res) {
  const category = await categoryService.setCategoryImage(req.params.id, req.file);
  return sendSuccess(res, { message: 'Category image updated', data: { category } });
}

export async function deleteCategory(req, res) {
  await categoryService.deleteCategory(req.params.id);
  return sendSuccess(res, { message: 'Category deleted' });
}

// ---- Products ----
export async function listProducts(req, res) {
  const data = await adminProductService.listProducts(req.validatedQuery);
  return sendSuccess(res, { data });
}

export async function getProduct(req, res) {
  const product = await adminProductService.getProduct(req.params.id);
  return sendSuccess(res, { data: { product } });
}

export async function moderateProduct(req, res) {
  const product = await adminProductService.moderateProduct(req.params.id, req.body, req.user);
  return sendSuccess(res, { message: `Product ${product.status}`, data: { product } });
}
