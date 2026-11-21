import * as inventoryService from '../services/inventory.service.js';
import * as productService from '../services/sellerProduct.service.js';
import { assetFolders, uploadImage } from '../services/storage.service.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';

export async function list(req, res) {
  const data = await productService.listSellerProducts(req.user.id, req.validatedQuery);
  return sendSuccess(res, { data });
}

export async function getOne(req, res) {
  const product = await productService.getSellerProduct(req.user.id, req.params.id);
  return sendSuccess(res, { data: { product } });
}

export async function create(req, res) {
  const product = await productService.createProduct(
    { userId: req.user.id, storeId: req.store._id },
    req.body,
  );
  return sendSuccess(res, { status: 201, message: 'Product submitted for review', data: { product } });
}

export async function update(req, res) {
  const product = await productService.updateProduct(req.user.id, req.params.id, req.body);
  const message = product.status === 'pending' ? 'Product saved and sent for review' : 'Product saved';
  return sendSuccess(res, { message, data: { product } });
}

export async function setVisibility(req, res) {
  const product = await productService.setProductVisibility(req.user.id, req.params.id, req.body.isActive);
  return sendSuccess(res, {
    message: product.isActive ? 'Product is now active' : 'Product hidden from the storefront',
    data: { product },
  });
}

export async function remove(req, res) {
  await productService.deleteProduct(req.user.id, req.params.id);
  return sendSuccess(res, { message: 'Product deleted' });
}

export async function uploadImages(req, res) {
  if (!req.files?.length) throw ApiError.badRequest('Choose at least one image to upload');
  const folder = assetFolders.product(req.user.id);
  const images = await Promise.all((req.files || []).map((file) => uploadImage(file, folder)));
  return sendSuccess(res, { status: 201, data: { images } });
}

// ---- Inventory ----
export async function inventory(req, res) {
  const data = await inventoryService.listInventory(req.user.id, req.validatedQuery);
  return sendSuccess(res, { data });
}

export async function inventoryStats(req, res) {
  const stats = await inventoryService.getInventoryStats(req.user.id);
  return sendSuccess(res, { data: stats });
}

export async function updateStock(req, res) {
  const { productId, variantId } = req.params;
  const data = await inventoryService.updateVariantStock(req.user.id, productId, variantId, req.body);
  return sendSuccess(res, { message: 'Stock updated', data });
}
