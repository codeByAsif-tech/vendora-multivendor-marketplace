import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Address } from '../models/address.model.js';
import { Cart } from '../models/cart.model.js';
import { Order, SellerOrder } from '../models/order.model.js';
import { Product } from '../models/product.model.js';
import { User } from '../models/user.model.js';
import { emailTemplates } from '../templates/emails/index.js';
import { ApiError } from '../utils/ApiError.js';
import {
  CANCELLABLE_STATUSES,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PRODUCT_STATUS,
} from '../utils/constants.js';
import { pageMeta, skipFor } from '../utils/pagination.js';
import { buildCartLines, deliveryTermsFor, summarize } from './cart.service.js';
import { ratesForStores, splitShipment } from './commission.service.js';
import { evaluate as evaluateCoupon, redeem as redeemCoupon, splitDiscount } from './coupon.service.js';
import { notify } from './notification.service.js';
import { queueEmail } from './email.service.js';
import { refreshOrderStatus, restockItems } from './orderSync.service.js';
import { assertUtrAvailable, createPaymentForOrder, onShipmentCancelled } from './payment.service.js';

const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function makeOrderNumber() {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, ''); // yymmdd
  return `MK${date}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function addressSnapshot(address) {
  const { fullName, phone, line1, line2, landmark, city, state, postalCode, country } = address;
  return { fullName, phone, line1, line2, landmark, city, state, postalCode, country };
}

const populateShipments = {
  path: 'sellerOrders',
  // Customers never see the platform commission split.
  select: '-commissionRate -commissionAmount -sellerEarning -seller -customer -shippingAddress',
  populate: { path: 'store', select: 'storeName slug logo' },
};

/**
 * Checkout. In one transaction:
 * 1. decrement stock (only if enough stock is still there),
 * 2. create the Order and one SellerOrder per seller,
 * 3. empty the cart.
 * The same idempotencyKey always returns the same order (double clicks, retries).
 */
export async function placeOrder(user, { addressId, paymentMethod, utr, idempotencyKey, note }) {
  const previous = await Order.findOne({ customer: user.id, idempotencyKey }).populate(populateShipments);
  if (previous) return { order: previous, created: false };

  const [cart, address] = await Promise.all([
    Cart.findOne({ user: user.id }),
    Address.findOne({ _id: addressId, user: user.id }).lean(),
  ]);
  if (!address) throw ApiError.field('addressId', 'Choose a delivery address');
  if (!cart?.items.length) throw ApiError.badRequest('Your cart is empty');

  const { lines, changed } = await buildCartLines(cart);
  if (changed) await cart.save();
  const problems = lines.filter((l) => l.issue);
  if (problems.length) {
    throw new ApiError(
      409,
      'Some items in your cart changed. Please review your cart before placing the order.',
      problems.map((l) => ({ field: String(l._id), message: `${l.name}: ${l.issueMessage}` })),
      'CART_CHANGED',
    );
  }

  const { freeShipping, shipping } = await deliveryTermsFor(user.id);
  // An applied coupon must still be valid; otherwise the customer reviews the cart first.
  const applied = cart.couponCode
    ? await evaluateCoupon(cart.couponCode, user.id, summarize(lines, { freeShipping, shipping }).summary.subtotal)
    : null;
  const { shipments, summary } = summarize(lines, { freeShipping, shipping, discount: applied?.discount ?? 0 });
  const discountShares = splitDiscount(summary.discount, shipments.map((s) => s.subtotal));
  const isCod = paymentMethod === 'cod';
  const normalizedUtr = isCod ? undefined : await assertUtrAvailable(utr);
  const initialStatus = isCod ? ORDER_STATUS.CONFIRMED : ORDER_STATUS.PENDING;
  const orderId = new mongoose.Types.ObjectId();
  const orderNumber = makeOrderNumber();
  const shippingAddress = addressSnapshot(address);
  // Commission rate is fixed at checkout: later rate changes do not touch this order.
  const commissionRates = await ratesForStores(shipments.map((s) => s.store._id));

  const sellerOrders = shipments.map((shipment, index) => ({
    _id: new mongoose.Types.ObjectId(),
    order: orderId,
    orderNumber: `${orderNumber}-${index + 1}`,
    customer: user.id,
    seller: shipment.sellerId,
    store: shipment.store._id,
    items: shipment.lines.map((l) => ({
      product: l.productId,
      variant: l.variantId,
      name: l.name,
      slug: l.slug,
      image: l.image,
      sku: l.sku,
      attributes: l.attributes.map(({ name, value }) => ({ name, value })),
      unitPrice: l.unitPrice,
      compareAtPrice: l.compareAtPrice,
      quantity: l.quantity,
      lineTotal: l.lineTotal,
    })),
    subtotal: shipment.subtotal,
    shippingFee: shipment.shippingFee,
    total: shipment.subtotal + shipment.shippingFee,
    discountShare: discountShares[index],
    payable: shipment.subtotal + shipment.shippingFee - discountShares[index],
    ...splitShipment(
      { subtotal: shipment.subtotal, total: shipment.subtotal + shipment.shippingFee },
      commissionRates.get(String(shipment.store._id)),
    ),
    paymentMethod,
    shippingAddress,
    status: initialStatus,
    statusHistory: [
      {
        status: initialStatus,
        note: isCod ? 'Order placed with Cash on Delivery' : 'Order placed. Waiting for payment verification.',
        by: user.id,
        role: 'customer',
      },
    ],
  }));

  try {
    await mongoose.connection.transaction(async (session) => {
      for (const line of lines) {
        const result = await Product.updateOne(
          {
            _id: line.productId,
            status: PRODUCT_STATUS.APPROVED,
            isActive: true,
            deletedAt: null,
            variants: { $elemMatch: { _id: line.variantId, isActive: true, stock: { $gte: line.quantity } } },
          },
          { $inc: { 'variants.$.stock': -line.quantity, totalStock: -line.quantity, soldCount: line.quantity } },
          { session },
        );
        if (result.modifiedCount !== 1) {
          throw new ApiError(409, `"${line.name}" just sold out or has less stock now. Please review your cart.`, undefined, 'CART_CHANGED');
        }
      }

      await SellerOrder.create(sellerOrders, { session, ordered: true });
      await Order.create(
        [
          {
            _id: orderId,
            orderNumber,
            customer: user.id,
            sellerOrders: sellerOrders.map((s) => s._id),
            shippingAddress,
            itemCount: summary.itemCount,
            subtotal: summary.subtotal,
            shippingTotal: summary.shipping,
            discountTotal: summary.discount,
            total: summary.total,
            coupon: applied ? { code: applied.coupon.code, couponId: applied.coupon._id } : undefined,
            payment: {
              method: paymentMethod,
              status: isCod ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.PENDING_VERIFICATION,
              utr: normalizedUtr,
            },
            status: initialStatus,
            note,
            idempotencyKey,
          },
        ],
        { session },
      );
      await createPaymentForOrder(
        {
          orderId,
          orderNumber,
          customerId: user.id,
          method: paymentMethod,
          amount: summary.total,
          utr: normalizedUtr,
        },
        session,
      );
      if (applied) await redeemCoupon(applied, { userId: user.id, orderId }, session);
      await Cart.updateOne({ user: user.id }, { $set: { items: [] }, $unset: { couponCode: 1 } }, { session });
    });
  } catch (err) {
    // Two identical requests at the same time: the loser returns the winner's order.
    if (err?.code === 11000) {
      const existing = await Order.findOne({ customer: user.id, idempotencyKey }).populate(populateShipments);
      if (existing) return { order: existing, created: false };
    }
    throw err;
  }

  // Notifications (never block the order)
  queueEmail(
    user.email,
    emailTemplates.orderPlaced({ name: user.name, orderNumber, total: rupees(summary.total), paymentMethod }),
  );
  const sellers = await User.find({ _id: { $in: sellerOrders.map((s) => s.seller) } }).select('name email').lean();
  for (const shipment of sellerOrders) {
    const seller = sellers.find((s) => String(s._id) === String(shipment.seller));
    notify(shipment.seller, {
      type: 'new_order',
      title: `New order ${shipment.orderNumber}`,
      body: `${shipment.items.reduce((sum, i) => sum + i.quantity, 0)} item(s), ${rupees(shipment.total)}`,
      link: '/seller/orders',
    });
    queueEmail(
      seller?.email,
      emailTemplates.newOrderForSeller({
        name: seller?.name,
        orderNumber: shipment.orderNumber,
        itemCount: shipment.items.reduce((sum, i) => sum + i.quantity, 0),
        total: rupees(shipment.total),
      }),
    );
  }

  const order = await Order.findById(orderId).populate(populateShipments);
  return { order, created: true };
}

export async function listMyOrders(userId, { page, limit }) {
  const filter = { customer: userId };
  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skipFor(page, limit))
      .limit(limit)
      .populate({
        path: 'sellerOrders',
        select: 'orderNumber status items.name items.image items.quantity total store',
        populate: { path: 'store', select: 'storeName slug' },
      })
      .lean(),
    Order.countDocuments(filter),
  ]);
  return { items, pagination: pageMeta(total, page, limit) };
}

export async function getMyOrder(userId, orderNumber) {
  const order = await Order.findOne({ orderNumber, customer: userId }).populate(populateShipments);
  if (!order) throw ApiError.notFound('Order not found');
  return order;
}

/**
 * Customer cancels the whole order, or one shipment (sellerOrderId), if it has not shipped yet.
 * Stock is returned in the same transaction.
 */
export async function cancelMyOrder(user, orderNumber, { sellerOrderId, reason }) {
  const order = await Order.findOne({ orderNumber, customer: user.id });
  if (!order) throw ApiError.notFound('Order not found');

  const filter = { order: order._id, status: { $in: CANCELLABLE_STATUSES } };
  if (sellerOrderId) filter._id = sellerOrderId;
  const targets = await SellerOrder.find(filter).select('_id').lean();
  if (!targets.length) {
    throw ApiError.conflict('This order can no longer be cancelled because it has already shipped.', 'NOT_CANCELLABLE');
  }

  const cancelled = [];
  await mongoose.connection.transaction(async (session) => {
    cancelled.length = 0;
    for (const { _id } of targets) {
      // Re-check the status inside the transaction (a seller may have just shipped it).
      const shipment = await SellerOrder.findOne({ _id, status: { $in: CANCELLABLE_STATUSES } }).session(session);
      if (!shipment) continue;
      shipment.status = ORDER_STATUS.CANCELLED;
      shipment.cancelReason = reason;
      shipment.cancelledBy = 'customer';
      shipment.statusHistory.push({ status: ORDER_STATUS.CANCELLED, note: reason, by: user.id, role: 'customer' });
      await shipment.save({ session });
      await restockItems(shipment.items, session);
      cancelled.push(shipment);
    }
    if (!cancelled.length) throw ApiError.conflict('This order can no longer be cancelled.', 'NOT_CANCELLABLE');
    await refreshOrderStatus(order._id, session);
    for (const shipment of cancelled) await onShipmentCancelled(shipment, session);
  });

  const sellers = await User.find({ _id: { $in: cancelled.map((s) => s.seller) } }).select('name email').lean();
  for (const shipment of cancelled) {
    const seller = sellers.find((s) => String(s._id) === String(shipment.seller));
    queueEmail(seller?.email, emailTemplates.orderCancelledForSeller({ name: seller?.name, orderNumber: shipment.orderNumber, reason }));
    notify(shipment.seller, {
      type: 'order_cancelled',
      title: `Order ${shipment.orderNumber} was cancelled`,
      body: reason ? `Customer's reason: ${reason}` : 'Cancelled by the customer. Stock was returned.',
      link: '/seller/orders',
    });
  }

  return getMyOrder(user.id, orderNumber);
}
