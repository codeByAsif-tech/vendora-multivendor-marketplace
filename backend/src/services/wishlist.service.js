import { Product } from '../models/product.model.js';
import { Wishlist } from '../models/wishlist.model.js';
import { ApiError } from '../utils/ApiError.js';
import { buildVisibilityFilter } from './catalog.service.js';

const MAX_ITEMS = 200;

/** Visible wishlisted products as product cards (newest first). Hidden products are skipped, not deleted. */
export async function getWishlist(userId) {
  const wishlist = await Wishlist.findOne({ user: userId }).lean();
  const ids = wishlist?.products ?? [];
  if (!ids.length) return { items: [], productIds: [] };

  const visibility = await buildVisibilityFilter();
  const products = await Product.find({ _id: { $in: ids }, ...visibility })
    .select('name slug brand minPrice maxPrice compareAtPrice maxDiscount totalStock ratingAvg ratingCount store')
    .slice('images', 2)
    .populate('store', 'storeName slug')
    .lean();

  const byId = new Map(products.map((p) => [String(p._id), p]));
  const items = [...ids].reverse().map((id) => byId.get(String(id))).filter(Boolean);
  return { items, productIds: ids.map(String) };
}

export async function addToWishlist(userId, productId) {
  const visibility = await buildVisibilityFilter();
  const exists = await Product.exists({ _id: productId, ...visibility });
  if (!exists) throw ApiError.notFound('This product is not available');

  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId } },
    { upsert: true, returnDocument: 'after' },
  );
  if (!wishlist.products.some((id) => String(id) === productId)) {
    if (wishlist.products.length >= MAX_ITEMS) throw ApiError.badRequest(`Your wishlist can hold up to ${MAX_ITEMS} items`);
    wishlist.products.push(productId);
    await wishlist.save();
  }
  return getWishlist(userId);
}

export async function removeFromWishlist(userId, productId) {
  await Wishlist.updateOne({ user: userId }, { $pull: { products: productId } });
  return getWishlist(userId);
}
