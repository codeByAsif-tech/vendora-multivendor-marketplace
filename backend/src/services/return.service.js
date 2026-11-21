import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { LedgerEntry, SellerWallet } from '../models/earnings.model.js';
import { Order, SellerOrder } from '../models/order.model.js';
import { Payment } from '../models/payment.model.js';
import { ReturnRequest } from '../models/returnRequest.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import {
  LEDGER_TYPES,
  OPEN_RETURN_STATUSES,
  ORDER_STATUS,
  RETURN_REASONS,
  RETURN_STATUS,
  RETURN_STATUS_VALUES,
  ROLES,
} from '../utils/constants.js';
import { pageMeta, skipFor, statusCounts } from '../utils/pagination.js';
import { searchRegex } from '../utils/text.js';
import { notify } from './notification.service.js';
import { restockItems } from './orderSync.service.js';
import { payableOf, syncOrderPayment } from './payment.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Returns are allowed while the seller's earning is still on hold, so a refund never chases paid-out money. */
export const RETURN_WINDOW_DAYS = env.EARNINGS_HOLD_DAYS;

export function returnDeadline(shipment) {
  return shipment.deliveredAt ? new Date(shipment.deliveredAt.getTime() + RETURN_WINDOW_DAYS * DAY_MS) : null;
}

/**
 * Money for the returned items:
 * - refundAmount: what the customer paid for them (their share of any coupon discount is kept by the platform)
 * - sellerDebit:  what the seller earned on them (item value minus the commission rate of the order)
 */
export function returnAmounts(shipment, itemsValue) {
  const discountOnItems = shipment.subtotal ? Math.round(((shipment.discountShare ?? 0) * itemsValue) / shipment.subtotal) : 0;
  const commissionOnItems = Math.round((itemsValue * (shipment.commissionRate ?? 0)) / 100);
  return { refundAmount: itemsValue - discountOnItems, sellerDebit: itemsValue - commissionOnItems };
}

/* ------------------------------------------------------------------ */
/* Customer                                                            */
/* ------------------------------------------------------------------ */

export async function requestReturn(user, orderNumber, { sellerOrderId, items, reason, details, refundUpi }) {
  const order = await Order.findOne({ orderNumber, customer: user.id }).select('_id').lean();
  if (!order) throw ApiError.notFound('Order not found');
  const shipment = await SellerOrder.findOne({ _id: sellerOrderId, order: order._id, customer: user.id });
  if (!shipment) throw ApiError.notFound('Shipment not found');

  if (shipment.status !== ORDER_STATUS.DELIVERED) {
    throw ApiError.conflict('Only delivered items can be returned', 'NOT_DELIVERED');
  }
  if (returnDeadline(shipment) < new Date()) {
    throw ApiError.conflict(`Returns are accepted within ${RETURN_WINDOW_DAYS} days of delivery`, 'RETURN_WINDOW_CLOSED');
  }
  if (await ReturnRequest.exists({ sellerOrder: shipment._id, status: { $in: OPEN_RETURN_STATUSES } })) {
    throw ApiError.conflict('There is already an open return for this shipment', 'RETURN_ALREADY_OPEN');
  }

  const lines = items.map(({ itemId, quantity }) => {
    const item = shipment.items.id(itemId);
    if (!item) throw ApiError.field('items', 'One of the items is not part of this shipment');
    const left = item.quantity - (item.returnedQuantity ?? 0);
    if (quantity > left) throw ApiError.field('items', `You can return at most ${left} of "${item.name}"`);
    return {
      itemId: item._id,
      product: item.product,
      variant: item.variant,
      name: item.name,
      image: item.image,
      sku: item.sku,
      unitPrice: item.unitPrice,
      quantity,
    };
  });

  const itemsValue = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const created = await ReturnRequest.create({
    returnNumber: `RT${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    order: order._id,
    sellerOrder: shipment._id,
    orderNumber: shipment.orderNumber,
    customer: user.id,
    seller: shipment.seller,
    store: shipment.store,
    items: lines,
    reason,
    details,
    refundUpi,
    itemsValue,
    ...returnAmounts(shipment, itemsValue),
    history: [{ status: RETURN_STATUS.REQUESTED, note: RETURN_REASONS[reason], by: user.id, role: ROLES.CUSTOMER }],
  });

  notify(shipment.seller, {
    type: 'return_requested',
    title: `Return requested for ${shipment.orderNumber}`,
    body: `${lines.reduce((s, l) => s + l.quantity, 0)} item(s): ${RETURN_REASONS[reason]}`,
    link: '/seller/returns',
  });
  return created;
}

export async function listMyReturns(userId, { orderNumber, page, limit }) {
  const filter = { customer: userId };
  if (orderNumber) filter.orderNumber = new RegExp(`^${orderNumber.replace(/[^A-Z0-9-]/gi, '')}(-\\d+)?$`, 'i');
  const [items, total] = await Promise.all([
    ReturnRequest.find(filter).sort({ createdAt: -1 }).skip(skipFor(page, limit)).limit(limit).select('-sellerDebit -seller').lean(),
    ReturnRequest.countDocuments(filter),
  ]);
  return { items, pagination: pageMeta(total, page, limit), windowDays: RETURN_WINDOW_DAYS };
}

/* ------------------------------------------------------------------ */
/* Seller (own returns) and admin (any)                                */
/* ------------------------------------------------------------------ */

export async function listReturns(actor, { status, search, page, limit }) {
  const filter = {};
  if (actor.role === ROLES.SELLER) filter.seller = actor.id;
  if (status) filter.status = status;
  if (search) {
    const rx = searchRegex(search);
    filter.$or = [{ returnNumber: rx }, { orderNumber: rx }];
  }
  const scope = actor.role === ROLES.SELLER ? { seller: new mongoose.Types.ObjectId(String(actor.id)) } : {};

  const [items, total, groups] = await Promise.all([
    ReturnRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skipFor(page, limit))
      .limit(limit)
      .populate('customer', 'name')
      .populate('store', 'storeName')
      .lean(),
    ReturnRequest.countDocuments(filter),
    ReturnRequest.aggregate([{ $match: scope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  return { items, pagination: pageMeta(total, page, limit), counts: statusCounts(groups, RETURN_STATUS_VALUES) };
}

const TRANSITIONS = {
  approve: { from: RETURN_STATUS.REQUESTED, to: RETURN_STATUS.APPROVED },
  reject: { from: RETURN_STATUS.REQUESTED, to: RETURN_STATUS.REJECTED },
  receive: { from: RETURN_STATUS.APPROVED, to: RETURN_STATUS.RECEIVED },
};

/**
 * approve / reject a request, or mark the parcel received.
 * "receive" in one transaction: stock back, returned quantities saved, refund due on the payment,
 * and the seller's earning reduced (ledger entry + wallet).
 */
export async function decideReturn(actor, id, { action, note }) {
  const { from, to } = TRANSITIONS[action];
  const filter = { _id: id };
  if (actor.role === ROLES.SELLER) filter.seller = actor.id;
  const current = await ReturnRequest.findOne(filter);
  if (!current) throw ApiError.notFound('Return not found');
  if (current.status !== from) {
    throw ApiError.conflict(`A return that is "${current.status}" cannot be ${action}d`, 'INVALID_STATUS_TRANSITION');
  }

  let updated;
  await mongoose.connection.transaction(async (session) => {
    const ret = await ReturnRequest.findOne({ _id: current._id, status: from }).session(session);
    if (!ret) throw ApiError.conflict('This return was just updated. Please refresh.', 'STALE_RETURN');

    ret.status = to;
    ret.history.push({ status: to, note, by: actor.id, role: actor.role });
    if (action === 'reject') ret.rejectionReason = note;

    if (action === 'receive') {
      ret.receivedAt = new Date();
      await restockItems(ret.items, session);

      const shipment = await SellerOrder.findById(ret.sellerOrder).session(session);
      for (const line of ret.items) {
        const item = shipment.items.id(line.itemId);
        if (item) item.returnedQuantity = (item.returnedQuantity ?? 0) + line.quantity;
      }
      await shipment.save({ session });

      const payment = await Payment.findOne({ order: ret.order }).session(session);
      if (payment) {
        payment.refundDue += Math.min(ret.refundAmount, payableOf(shipment));
        payment.history.push({
          status: payment.status,
          note: `Refund due ${rupees(ret.refundAmount)} for return ${ret.returnNumber}`,
          by: actor.id,
          role: actor.role,
        });
        await payment.save({ session });
        await syncOrderPayment(payment, session);
      }

      await LedgerEntry.create(
        [
          {
            store: ret.store,
            seller: ret.seller,
            type: LEDGER_TYPES.RETURN,
            amount: -ret.sellerDebit,
            sellerOrder: ret.sellerOrder,
            orderNumber: ret.orderNumber,
            gross: ret.itemsValue,
            commission: ret.itemsValue - ret.sellerDebit,
            returnRequest: ret._id,
            note: `Return ${ret.returnNumber}`,
            createdBy: actor.id,
          },
        ],
        { session },
      );
      // Taken from the available balance (it may go below zero; it is earned back from later sales).
      await SellerWallet.updateOne(
        { store: ret.store },
        {
          $setOnInsert: { seller: ret.seller },
          $inc: {
            available: -ret.sellerDebit,
            totalEarned: -ret.sellerDebit,
            totalCommission: -(ret.itemsValue - ret.sellerDebit),
          },
        },
        { upsert: true, session },
      );
    }

    await ret.save({ session });
    updated = ret;
  });

  const messages = {
    approve: {
      title: `Return ${updated.returnNumber} approved`,
      body: 'Please pack the items and hand them to the courier. Your refund starts once the seller receives them.',
    },
    reject: { title: `Return ${updated.returnNumber} was declined`, body: note },
    receive: {
      title: `Refund of ${rupees(updated.refundAmount)} on its way`,
      body: `The seller received your return ${updated.returnNumber}. We will send the money within a few days.`,
    },
  };
  const order = await Order.findById(updated.order).select('orderNumber').lean();
  notify(updated.customer, { type: `return_${to}`, ...messages[action], link: `/my-orders/${order?.orderNumber ?? ''}` });

  if (action === 'receive') {
    const admins = await User.find({ role: ROLES.ADMIN, status: 'active' }).select('_id').lean();
    notify(
      admins.map((a) => a._id),
      { type: 'refund_due', title: `Refund due: ${rupees(updated.refundAmount)}`, body: `Return ${updated.returnNumber} was received by the seller.`, link: '/admin/payments' },
    );
  }
  return updated;
}
