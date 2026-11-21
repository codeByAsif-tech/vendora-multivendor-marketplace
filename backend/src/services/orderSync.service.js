import { Order, SellerOrder } from '../models/order.model.js';
import { Product } from '../models/product.model.js';
import { ORDER_STATUS } from '../utils/constants.js';
import { deriveOrderStatus } from '../utils/orderStatus.js';
import { releaseForOrder } from './coupon.service.js';

/**
 * Small helpers shared by the order, seller-order and payment services
 * (kept separate so those services do not import each other in a loop).
 * Every function runs inside the caller's transaction session.
 */

/** Puts stock back for cancelled items. */
export async function restockItems(items, session) {
  for (const item of items) {
    const product = await Product.findById(item.product).session(session);
    const variant = product?.variants.id(item.variant);
    if (!variant) continue;
    variant.stock += item.quantity;
    product.soldCount = Math.max(0, product.soldCount - item.quantity);
    await product.save({ session });
  }
}

/** Recalculates the overall order status from its shipments. */
export async function refreshOrderStatus(orderId, session) {
  // Sequential on purpose: operations inside one transaction must not run in parallel.
  const shipments = await SellerOrder.find({ order: orderId }).select('status').session(session).lean();
  const status = deriveOrderStatus(shipments.map((s) => s.status));
  await Order.updateOne({ _id: orderId }, { $set: { status } }, { session });
  if (status === ORDER_STATUS.CANCELLED) await releaseForOrder(orderId, session);
  return status;
}
