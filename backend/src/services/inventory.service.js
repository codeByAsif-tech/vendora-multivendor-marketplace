import { Product } from '../models/product.model.js';
import { ApiError } from '../utils/ApiError.js';
import { pageMeta, skipFor, toObjectId } from '../utils/pagination.js';
import { searchRegex } from '../utils/text.js';
import { findOwnedProduct } from './sellerProduct.service.js';

const isLowExpr = {
  $and: [{ $gt: ['$variants.stock', 0] }, { $lte: ['$variants.stock', '$variants.lowStockThreshold'] }],
};

/** One row per variant (SKU), lowest stock first so problems are on top. */
export async function listInventory(sellerId, { search, stock, page, limit }) {
  const pipeline = [
    { $match: { seller: toObjectId(sellerId), deletedAt: null } },
    { $unwind: '$variants' },
  ];

  if (search) {
    const rx = searchRegex(search);
    pipeline.push({ $match: { $or: [{ name: rx }, { 'variants.sku': rx }] } });
  }
  if (stock === 'out') pipeline.push({ $match: { 'variants.stock': 0 } });
  if (stock === 'low') pipeline.push({ $match: { $expr: isLowExpr } });

  pipeline.push(
    { $sort: { 'variants.stock': 1, name: 1, 'variants.sku': 1 } },
    {
      $facet: {
        items: [
          { $skip: skipFor(page, limit) },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              productId: '$_id',
              variantId: '$variants._id',
              name: 1,
              status: 1,
              isActive: 1,
              image: { $first: '$images.url' },
              sku: '$variants.sku',
              attributes: '$variants.attributes',
              price: '$variants.price',
              salePrice: '$variants.salePrice',
              stock: '$variants.stock',
              lowStockThreshold: '$variants.lowStockThreshold',
              variantActive: '$variants.isActive',
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  );

  const [result] = await Product.aggregate(pipeline);
  return {
    items: result.items,
    pagination: pageMeta(result.total[0]?.count ?? 0, page, limit),
  };
}

export async function getInventoryStats(sellerId) {
  const [stats] = await Product.aggregate([
    { $match: { seller: toObjectId(sellerId), deletedAt: null } },
    { $unwind: '$variants' },
    {
      $group: {
        _id: null,
        productIds: { $addToSet: '$_id' },
        skus: { $sum: 1 },
        units: { $sum: '$variants.stock' },
        outOfStock: { $sum: { $cond: [{ $eq: ['$variants.stock', 0] }, 1, 0] } },
        lowStock: { $sum: { $cond: [isLowExpr, 1, 0] } },
        // Stock value at selling price (paise)
        stockValue: {
          $sum: { $multiply: ['$variants.stock', { $ifNull: ['$variants.salePrice', '$variants.price'] }] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        products: { $size: '$productIds' },
        skus: 1,
        units: 1,
        outOfStock: 1,
        lowStock: 1,
        stockValue: 1,
      },
    },
  ]);

  return stats ?? { products: 0, skus: 0, units: 0, outOfStock: 0, lowStock: 0, stockValue: 0 };
}

/** Sets the stock of one variant. Stock edits never send a product back to moderation. */
export async function updateVariantStock(sellerId, productId, variantId, { stock, lowStockThreshold }) {
  const product = await findOwnedProduct(sellerId, productId);
  const variant = product.variants.id(variantId);
  if (!variant) throw ApiError.notFound('Variant not found');

  variant.stock = stock;
  if (lowStockThreshold !== undefined) variant.lowStockThreshold = lowStockThreshold;
  await product.save();

  return {
    productId: product._id,
    variantId: variant._id,
    sku: variant.sku,
    stock: variant.stock,
    lowStockThreshold: variant.lowStockThreshold,
    totalStock: product.totalStock,
  };
}
