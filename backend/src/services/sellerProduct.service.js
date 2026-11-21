import crypto from 'node:crypto';
import { Product } from '../models/product.model.js';
import { ApiError } from '../utils/ApiError.js';
import { PRODUCT_STATUS, PRODUCT_STATUS_VALUES } from '../utils/constants.js';
import { pageMeta, skipFor, statusCounts, toObjectId } from '../utils/pagination.js';
import { searchRegex, slugify } from '../utils/text.js';
import { assertAssignableCategory } from './category.service.js';
import { assetFolders, deleteImagesLater, isOwnedAsset } from './storage.service.js';

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  price_asc: { minPrice: 1, _id: 1 },
  price_desc: { minPrice: -1, _id: 1 },
  stock_asc: { totalStock: 1, _id: 1 },
  name_asc: { name: 1, _id: 1 },
};

const makeSlug = (name) => `${slugify(name, 80) || 'product'}-${crypto.randomBytes(3).toString('hex')}`;

/** Every lookup is scoped to the seller. Another seller's product is reported as "not found". */
export async function findOwnedProduct(sellerId, productId) {
  const product = await Product.findOne({ _id: productId, seller: sellerId, deletedAt: null });
  if (!product) throw ApiError.notFound('Product not found');
  return product;
}

function assertOwnedImages(images, sellerId) {
  const folder = assetFolders.product(sellerId);
  const index = images.findIndex((image) => !isOwnedAsset(image, folder));
  if (index !== -1) {
    throw ApiError.field(`images.${index}`, 'Upload images with the product image uploader');
  }
}

/** SKUs must be unique across all of this seller's (non-deleted) products. */
async function assertSkusAvailable(sellerId, variants, excludeProductId) {
  const skus = variants.map((v) => v.sku);
  const filter = { seller: sellerId, deletedAt: null, 'variants.sku': { $in: skus } };
  if (excludeProductId) filter._id = { $ne: excludeProductId };

  const clash = await Product.findOne(filter).select('name variants.sku').lean();
  if (clash) {
    const sku = clash.variants.find((v) => skus.includes(v.sku))?.sku;
    throw ApiError.conflict(`SKU ${sku} is already used by "${clash.name}"`, 'SKU_TAKEN');
  }
}

export async function listSellerProducts(sellerId, { search, status, category, stock, sort, page, limit }) {
  const filter = { seller: sellerId, deletedAt: null };
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (stock === 'in') filter.totalStock = { $gt: 0 };
  if (stock === 'out') filter.totalStock = 0;
  if (search) {
    const rx = searchRegex(search);
    filter.$or = [{ name: rx }, { brand: rx }, { 'variants.sku': rx }];
  }

  const [items, total, groups] = await Promise.all([
    Product.find(filter)
      .sort(SORTS[sort])
      .skip(skipFor(page, limit))
      .limit(limit)
      .select('-description -specifications -highlights -tags -__v')
      .populate('category', 'name slug')
      .lean(),
    Product.countDocuments(filter),
    Product.aggregate([
      { $match: { seller: toObjectId(sellerId), deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  return {
    items,
    pagination: pageMeta(total, page, limit),
    counts: statusCounts(groups, PRODUCT_STATUS_VALUES),
  };
}

export async function getSellerProduct(sellerId, productId) {
  const product = await findOwnedProduct(sellerId, productId);
  await product.populate('category', 'name slug parent');
  return product;
}

/** @param seller { userId, storeId } */
export async function createProduct(seller, input) {
  await assertAssignableCategory(input.category);
  assertOwnedImages(input.images, seller.userId);
  await assertSkusAvailable(seller.userId, input.variants);

  return Product.create({
    ...input,
    variants: input.variants.map(({ _id, ...variant }) => variant), // new product → new variant ids
    seller: seller.userId,
    store: seller.storeId,
    slug: makeSlug(input.name),
    status: PRODUCT_STATUS.PENDING,
  });
}

/** Changes to these fields send an approved product back for review. Price/stock changes do not. */
function contentChanged(product, input) {
  const join = (list, fn) => (list || []).map(fn).join('\u0001');
  const checks = {
    name: () => input.name !== product.name,
    brand: () => (input.brand || '') !== (product.brand || ''),
    description: () => input.description !== product.description,
    category: () => String(input.category) !== String(product.category),
    highlights: () => join(input.highlights, String) !== join(product.highlights, String),
    images: () => join(input.images, (i) => i.publicId) !== join(product.images, (i) => i.publicId),
    specifications: () =>
      join(input.specifications, (s) => `${s.key}:${s.value}`) !==
      join(product.specifications, (s) => `${s.key}:${s.value}`),
  };
  return Object.entries(checks).some(([field, changed]) => field in input && changed());
}

export async function updateProduct(sellerId, productId, input) {
  const product = await findOwnedProduct(sellerId, productId);

  if (input.category && String(input.category) !== String(product.category)) {
    await assertAssignableCategory(input.category);
  }
  if (input.images) assertOwnedImages(input.images, sellerId);
  if (input.variants) await assertSkusAvailable(sellerId, input.variants, product._id);

  const needsReview = contentChanged(product, input) || product.status === PRODUCT_STATUS.REJECTED;
  const removedImages = input.images
    ? product.images
        .filter((old) => !input.images.some((img) => img.publicId === old.publicId))
        .map((img) => img.publicId)
    : [];

  const changes = { ...input };
  if (input.variants) {
    // Keep ids of existing variants (cart/order items reference them). Unknown ids are dropped.
    const existingIds = new Set(product.variants.map((v) => String(v._id)));
    changes.variants = input.variants.map(({ _id, ...variant }) =>
      _id && existingIds.has(_id) ? { _id, ...variant } : variant,
    );
  }

  product.set(changes);
  if (needsReview) {
    product.status = PRODUCT_STATUS.PENDING;
    product.rejectionReason = undefined;
  }

  await product.save();
  deleteImagesLater(removedImages);
  return product;
}

export async function setProductVisibility(sellerId, productId, isActive) {
  const product = await findOwnedProduct(sellerId, productId);
  product.isActive = isActive;
  await product.save();
  return product;
}

/**
 * Soft delete: the product disappears everywhere, but past orders keep their reference.
 * Images are kept for order history.
 */
export async function deleteProduct(sellerId, productId) {
  const product = await findOwnedProduct(sellerId, productId);
  product.deletedAt = new Date();
  product.isActive = false;
  await product.save();
}
