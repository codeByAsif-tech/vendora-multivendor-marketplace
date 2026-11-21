import mongoose from 'mongoose';
import { Order, SellerOrder } from '../models/order.model.js';
import { Payment } from '../models/payment.model.js';
import { User } from '../models/user.model.js';
import { emailTemplates } from '../templates/emails/index.js';
import { ApiError } from '../utils/ApiError.js';
import {
  ADMIN_ORDER_TRANSITIONS,
  ORDER_STATUS,
  ORDER_STATUS_VALUES,
  ROLES,
  SELLER_ORDER_TRANSITIONS,
} from '../utils/constants.js';
import { pageMeta, skipFor, statusCounts, toObjectId } from '../utils/pagination.js';
import { searchRegex } from '../utils/text.js';
import { creditEarning } from './earnings.service.js';
import { queueEmail } from './email.service.js';
import { notify } from './notification.service.js';
import { refreshOrderStatus, restockItems } from './orderSync.service.js';
import { onShipmentCancelled, onShipmentDelivered } from './payment.service.js';

const STATUS_LABELS = {
  confirmed: 'Confirmed',
  processing: 'Being packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export async function listSellerOrders(sellerId, { status, search, page, limit }) {
  const filter = { seller: sellerId };
  if (status) filter.status = status;
  if (search) {
    const rx = searchRegex(search);
    filter.$or = [{ orderNumber: rx }, { 'shippingAddress.fullName': rx }, { 'items.sku': rx }];
  }

  const [items, total, groups] = await Promise.all([
    SellerOrder.find(filter)
      .sort({ createdAt: -1 })
      .skip(skipFor(page, limit))
      .limit(limit)
      .select('-statusHistory -__v')
      .lean(),
    SellerOrder.countDocuments(filter),
    SellerOrder.aggregate([
      { $match: { seller: toObjectId(sellerId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  return { items, pagination: pageMeta(total, page, limit), counts: statusCounts(groups, ORDER_STATUS_VALUES) };
}

/** Sellers see only their own shipments (404 otherwise). Admins see any. */
async function findShipment(actor, id) {
  const filter = { _id: id };
  if (actor.role === ROLES.SELLER) filter.seller = actor.id;
  const shipment = await SellerOrder.findOne(filter);
  if (!shipment) throw ApiError.notFound('Order not found');
  return shipment;
}

export async function getSellerOrder(actor, id) {
  const shipment = await findShipment(actor, id);
  await shipment.populate([
    { path: 'customer', select: 'name' },
    { path: 'statusHistory.by', select: 'name' },
    { path: 'order', select: 'orderNumber payment.method payment.status' },
  ]);
  return shipment;
}

/**
 * Moves a shipment forward (or cancels it).
 * Allowed changes depend on the actor: SELLER_ORDER_TRANSITIONS / ADMIN_ORDER_TRANSITIONS.
 * Cancelling returns the stock. The parent order status is recalculated.
 */
export async function updateSellerOrderStatus(actor, id, { status, note, reason, carrier, trackingNumber }) {
  const current = await findShipment(actor, id);
  const transitions = actor.role === ROLES.ADMIN ? ADMIN_ORDER_TRANSITIONS : SELLER_ORDER_TRANSITIONS;
  if (!transitions[current.status]?.includes(status)) {
    throw ApiError.conflict(`An order that is "${current.status}" cannot be changed to "${status}"`, 'INVALID_STATUS_TRANSITION');
  }

  let updated;
  await mongoose.connection.transaction(async (session) => {
    const shipment = await SellerOrder.findOne({ _id: current._id, status: current.status }).session(session);
    if (!shipment) throw ApiError.conflict('This order was just updated. Please refresh.', 'STALE_ORDER');

    shipment.status = status;
    shipment.statusHistory.push({ status, note: reason || note, by: actor.id, role: actor.role });

    if (status === ORDER_STATUS.SHIPPED && (carrier || trackingNumber)) {
      shipment.tracking = { carrier, trackingNumber };
    }
    if (status === ORDER_STATUS.DELIVERED) shipment.deliveredAt = new Date();
    if (status === ORDER_STATUS.CANCELLED) {
      shipment.cancelReason = reason;
      shipment.cancelledBy = actor.role;
      await restockItems(shipment.items, session);
    }

    await shipment.save({ session });
    await refreshOrderStatus(shipment.order, session);
    if (status === ORDER_STATUS.DELIVERED) {
      await onShipmentDelivered(shipment, actor, session);
      await creditEarning(shipment, actor, session);
    }
    if (status === ORDER_STATUS.CANCELLED) await onShipmentCancelled(shipment, session);
    updated = shipment;
  });

  const order = await Order.findById(updated.order).select('orderNumber').lean();
  notify(updated.customer, {
    type: 'order_status',
    title: `${updated.orderNumber}: ${STATUS_LABELS[status] ?? status}`,
    body:
      status === ORDER_STATUS.SHIPPED && updated.tracking?.trackingNumber
        ? `${updated.tracking.carrier ?? 'Courier'} tracking: ${updated.tracking.trackingNumber}`
        : reason || note || undefined,
    link: `/my-orders/${order?.orderNumber ?? ''}`,
  });
  if (actor.role === ROLES.ADMIN && status === ORDER_STATUS.CANCELLED) {
    notify(updated.seller, {
      type: 'order_cancelled',
      title: `Order ${updated.orderNumber} was cancelled by our team`,
      body: reason,
      link: '/seller/orders',
    });
  }

  const customer = await User.findById(updated.customer).select('name email').lean();
  queueEmail(
    customer?.email,
    emailTemplates.orderStatusUpdate({
      name: customer?.name,
      orderNumber: updated.orderNumber,
      statusLabel: STATUS_LABELS[status] ?? status,
      note:
        status === ORDER_STATUS.SHIPPED && updated.tracking?.trackingNumber
          ? `${updated.tracking.carrier ?? 'Courier'} tracking number: ${updated.tracking.trackingNumber}`
          : reason || note,
    }),
  );

  return updated;
}

// ---- Admin ----

export async function listAllOrders({ status, search, page, limit }) {
  const filter = {};
  if (status) filter.status = status;
  if (search) {
    const rx = searchRegex(search);
    const customers = await User.find({ $or: [{ name: rx }, { email: rx }] }).select('_id').limit(500).lean();
    filter.$or = [{ orderNumber: rx }, { customer: { $in: customers.map((c) => c._id) } }];
  }

  const [items, total, groups] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skipFor(page, limit))
      .limit(limit)
      .populate('customer', 'name email')
      .populate({ path: 'sellerOrders', select: 'orderNumber status store total', populate: { path: 'store', select: 'storeName' } })
      .lean(),
    Order.countDocuments(filter),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  return { items, pagination: pageMeta(total, page, limit), counts: statusCounts(groups, ORDER_STATUS_VALUES) };
}

export async function getOrderForAdmin(id) {
  const order = await Order.findById(id)
    .populate('customer', 'name email phone')
    .populate({
      path: 'sellerOrders',
      populate: [
        { path: 'store', select: 'storeName slug' },
        { path: 'statusHistory.by', select: 'name' },
      ],
    });
  if (!order) throw ApiError.notFound('Order not found');

  // The admin order screen links straight to the payment actions.
  const payment = await Payment.findOne({ order: order._id }).select('_id').lean();
  return { ...order.toJSON(), paymentId: payment?._id ?? null };
}
