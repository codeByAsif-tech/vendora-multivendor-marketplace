import { Cart } from '../models/cart.model.js';
import { Order } from '../models/order.model.js';
import { Product } from '../models/product.model.js';
import { ApiError } from '../utils/ApiError.js';
import { CART_LIMITS, ORDER_STATUS } from '../utils/constants.js';
import { shippingFor } from '../utils/orderStatus.js';
import { effectivePrice, hasValidSale } from '../utils/productPricing.js';
import { buildVisibilityFilter } from './catalog.service.js';
import { describe, evaluate } from './coupon.service.js';
import { DEFAULT_SETTINGS, getPlatformSettings } from './platformSettings.service.js';

const ISSUE_MESSAGES = {
  unavailable: 'This item is no longer available',
  out_of_stock: 'Out of stock',
  insufficient_stock: 'Only a few left. Quantity was reduced.',
};

/**
 * Turns stored cart items into display/checkout lines using live product data.
 * Each line has `issue`: null | 'unavailable' | 'out_of_stock' | 'insufficient_stock'.
 * Quantities above the available stock are reduced (and saved) so the cart never asks for more than exists.
 */
export async function buildCartLines(cart) {
  const ids = [...new Set(cart.items.map((i) => String(i.product)))];
  const visibility = await buildVisibilityFilter();
  const products = await Product.find({ _id: { $in: ids }, ...visibility })
    .select('name slug images variants store seller')
    .populate('store', 'storeName slug')
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  let changed = false;
  const lines = cart.items.map((item) => {
    const product = byId.get(String(item.product));
    const variant = product?.variants.find((v) => String(v._id) === String(item.variant) && v.isActive !== false);

    let issue = null;
    if (!product || !variant) issue = 'unavailable';
    else if (variant.stock <= 0) issue = 'out_of_stock';
    else if (item.quantity > variant.stock) {
      item.quantity = variant.stock;
      issue = 'insufficient_stock';
      changed = true;
    }

    const unitPrice = variant ? effectivePrice(variant) : 0;
    return {
      _id: item._id,
      productId: item.product,
      variantId: item.variant,
      quantity: item.quantity,
      name: product?.name ?? 'Unavailable product',
      slug: product?.slug,
      image: product?.images?.[0]?.url,
      sku: variant?.sku,
      attributes: variant?.attributes ?? [],
      unitPrice,
      compareAtPrice: variant && hasValidSale(variant) ? variant.price : null,
      lineTotal: unitPrice * item.quantity,
      stock: variant?.stock ?? 0,
      maxQuantity: Math.min(variant?.stock ?? 0, CART_LIMITS.MAX_QTY_PER_LINE),
      store: product?.store ?? null,
      sellerId: product?.seller,
      issue,
      issueMessage: issue ? ISSUE_MESSAGES[issue] : null,
    };
  });

  return { lines, changed };
}

/** First order = no earlier order that was not cancelled. First orders ship free. */
export async function isFirstOrder(userId) {
  return !(await Order.exists({ customer: userId, status: { $ne: ORDER_STATUS.CANCELLED } }));
}

/**
 * Groups purchasable lines per store and calculates shipping per shipment.
 * freeShipping: true for the customer's first order (when that offer is on).
 * shipping: { fee, freeThreshold } from the platform settings.
 */
export function summarize(lines, { freeShipping = false, discount = 0, shipping: rule = DEFAULT_SETTINGS.shipping } = {}) {
  const buyable = lines.filter((l) => !l.issue || l.issue === 'insufficient_stock');
  const groups = new Map();
  for (const line of buyable) {
    const key = String(line.store._id);
    if (!groups.has(key)) groups.set(key, { store: line.store, sellerId: line.sellerId, lines: [], subtotal: 0 });
    const group = groups.get(key);
    group.lines.push(line);
    group.subtotal += line.lineTotal;
  }

  const shipments = [...groups.values()].map((g) => ({ ...g, shippingFee: freeShipping ? 0 : shippingFor(g.subtotal, rule) }));
  const subtotal = shipments.reduce((sum, s) => sum + s.subtotal, 0);
  const shipping = shipments.reduce((sum, s) => sum + s.shippingFee, 0);
  const savings = buyable.reduce((sum, l) => sum + (l.compareAtPrice ? (l.compareAtPrice - l.unitPrice) * l.quantity : 0), 0);

  return {
    shipments,
    summary: {
      itemCount: buyable.reduce((sum, l) => sum + l.quantity, 0),
      lineCount: lines.length,
      subtotal,
      shipping,
      discount: Math.min(discount, subtotal),
      total: subtotal + shipping - Math.min(discount, subtotal),
      savings,
      hasIssues: lines.some((l) => l.issue && l.issue !== 'insufficient_stock'),
      firstOrderFreeDelivery: freeShipping,
      shippingRule: { fee: rule.fee, freeThreshold: rule.freeThreshold },
    },
  };
}

async function getOrCreateCart(userId) {
  return (await Cart.findOne({ user: userId })) ?? new Cart({ user: userId, items: [] });
}

/** Current shipping rule and whether this customer gets the first-order free delivery. */
export async function deliveryTermsFor(userId) {
  const { shipping } = await getPlatformSettings();
  const freeShipping = shipping.firstOrderFree ? await isFirstOrder(userId) : false;
  return { freeShipping, shipping };
}

/** Cart response for the API: lines (without internal seller ids) + totals. */
export async function getCart(userId) {
  const cart = await getOrCreateCart(userId);
  const { lines, changed } = await buildCartLines(cart);
  if (changed && !cart.isNew) await cart.save();

  const { freeShipping, shipping } = await deliveryTermsFor(userId);
  const coupon = await couponForCart(cart, userId, summarize(lines, { freeShipping, shipping }).summary.subtotal);
  const { summary, shipments } = summarize(lines, { freeShipping, shipping, discount: coupon?.discount ?? 0 });
  return {
    items: lines.map(({ sellerId: _sellerId, ...line }) => line),
    summary,
    coupon: coupon?.view ?? null,
    shipments: shipments.map((s) => ({ store: s.store, subtotal: s.subtotal, shippingFee: s.shippingFee })),
  };
}

/**
 * The applied coupon, re-checked against the current cart. An invalid coupon stays applied
 * (e.g. the customer can add items to reach the minimum) but gives no discount and explains why.
 */
async function couponForCart(cart, userId, subtotal) {
  if (!cart.couponCode) return null;
  try {
    const { coupon, discount } = await evaluate(cart.couponCode, userId, subtotal);
    return { discount, view: { code: coupon.code, description: coupon.description || describe(coupon), discount, error: null } };
  } catch (err) {
    if (err?.code !== 'COUPON_INVALID') throw err;
    return { discount: 0, view: { code: cart.couponCode, description: null, discount: 0, error: err.message } };
  }
}

/** Applies a coupon after checking it against the current cart (invalid codes are not saved). */
export async function applyCoupon(userId, { code }) {
  const cart = await getOrCreateCart(userId);
  const { lines } = await buildCartLines(cart);
  if (!lines.length) throw ApiError.badRequest('Add something to your cart first');
  const { summary } = summarize(lines);
  const { coupon } = await evaluate(code, userId, summary.subtotal);
  cart.couponCode = coupon.code;
  await cart.save();
  return getCart(userId);
}

export async function removeCoupon(userId) {
  await Cart.updateOne({ user: userId }, { $unset: { couponCode: 1 } });
  return getCart(userId);
}

async function loadBuyableVariant(productId, variantId) {
  const visibility = await buildVisibilityFilter();
  const product = await Product.findOne({ _id: productId, ...visibility }).select('variants').lean();
  const variant = product?.variants.find((v) => String(v._id) === String(variantId) && v.isActive !== false);
  if (!variant) throw ApiError.notFound('This product is not available');
  if (variant.stock <= 0) throw ApiError.conflict('This item is out of stock', 'OUT_OF_STOCK');
  return variant;
}

export async function addItem(userId, { productId, variantId, quantity }) {
  const variant = await loadBuyableVariant(productId, variantId);
  const cart = await getOrCreateCart(userId);

  const existing = cart.items.find((i) => String(i.product) === productId && String(i.variant) === variantId);
  const limit = Math.min(variant.stock, CART_LIMITS.MAX_QTY_PER_LINE);

  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, limit);
  } else {
    if (cart.items.length >= CART_LIMITS.MAX_LINES) {
      throw ApiError.badRequest(`Your cart can hold up to ${CART_LIMITS.MAX_LINES} different items`);
    }
    cart.items.push({ product: productId, variant: variantId, quantity: Math.min(quantity, limit) });
  }

  await cart.save();
  return getCart(userId);
}

export async function updateItem(userId, itemId, { quantity }) {
  const cart = await Cart.findOne({ user: userId });
  const item = cart?.items.id(itemId);
  if (!item) throw ApiError.notFound('Cart item not found');

  const variant = await loadBuyableVariant(item.product, item.variant);
  item.quantity = Math.min(quantity, variant.stock, CART_LIMITS.MAX_QTY_PER_LINE);
  await cart.save();
  return getCart(userId);
}

export async function removeItem(userId, itemId) {
  await Cart.updateOne({ user: userId }, { $pull: { items: { _id: itemId } } });
  return getCart(userId);
}

export async function clearCart(userId) {
  await Cart.updateOne({ user: userId }, { $set: { items: [] }, $unset: { couponCode: 1 } });
  return getCart(userId);
}
