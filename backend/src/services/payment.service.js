import mongoose from 'mongoose';
import { Order, SellerOrder } from '../models/order.model.js';
import { Payment } from '../models/payment.model.js';
import { Transaction } from '../models/transaction.model.js';
import { User } from '../models/user.model.js';
import { emailTemplates } from '../templates/emails/index.js';
import { ApiError } from '../utils/ApiError.js';
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYMENT_STATUS_VALUES,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_VALUES,
} from '../utils/constants.js';
import { pageMeta, skipFor, statusCounts } from '../utils/pagination.js';
import { searchRegex } from '../utils/text.js';
import { queueEmail } from './email.service.js';
import { notify } from './notification.service.js';
import { refreshOrderStatus } from './orderSync.service.js';

/** What the customer pays for one shipment (after its share of a coupon discount). */
export const payableOf = (shipment) => shipment.payable ?? shipment.total;

export const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const event = (status, note, actor) => ({
  status,
  note,
  by: actor?.id,
  role: actor?.role ?? 'system',
});

/* ------------------------------------------------------------------ */
/* Helpers used by checkout / order services (inside their transaction) */
/* ------------------------------------------------------------------ */

/** A UTR may be used once, and a rejected UTR can never be used again. */
export async function assertUtrAvailable(utr, session) {
  const normalized = utr.trim().toUpperCase();
  const used = await Payment.exists({ $or: [{ utr: normalized }, { rejectedUtrs: normalized }] }).session(session ?? null);
  if (used) throw ApiError.conflict('This UTR / transaction reference has already been used', 'UTR_USED');
  return normalized;
}

/** Copies the payment state onto Order.payment (read-only snapshot used for display). */
export async function syncOrderPayment(payment, session) {
  await Order.updateOne(
    { _id: payment.order },
    {
      $set: {
        'payment.status': payment.status,
        'payment.utr': payment.utr,
        'payment.verifiedAt': payment.verifiedAt,
        'payment.rejectionReason': payment.rejectionReason,
        'payment.amountPaid': payment.amountPaid,
        'payment.refundDue': payment.refundDue,
        'payment.refundedAmount': payment.refundedAmount,
      },
    },
    { session },
  );
}

/** Creates the Payment for a new order (called inside the checkout transaction). */
export async function createPaymentForOrder({ orderId, orderNumber, customerId, method, amount, utr }, session) {
  const isCod = method === 'cod';
  const [payment] = await Payment.create(
    [
      {
        order: orderId,
        orderNumber,
        customer: customerId,
        method,
        amount,
        status: isCod ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.PENDING_VERIFICATION,
        utr: isCod ? undefined : utr,
        submittedAt: isCod ? undefined : new Date(),
        history: [
          event(
            isCod ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.PENDING_VERIFICATION,
            isCod ? 'Cash on Delivery' : `UTR ${utr} submitted`,
            { id: customerId, role: 'customer' },
          ),
        ],
      },
    ],
    { session },
  );
  return payment;
}

/** COD is fully paid once every shipment that was not cancelled has been delivered. */
async function completeCodIfDone(payment, session) {
  const shipments = await SellerOrder.find({ order: payment.order }).select('status').session(session).lean();
  const active = shipments.filter((s) => s.status !== ORDER_STATUS.CANCELLED);
  if (active.length && active.every((s) => s.status === ORDER_STATUS.DELIVERED)) {
    payment.status = PAYMENT_STATUS.PAID;
    payment.paidAt = new Date();
    payment.history.push(event(PAYMENT_STATUS.PAID, 'All cash collected on delivery'));
  }
}

/** Called after a shipment is marked delivered. COD: records the cash collected. */
export async function onShipmentDelivered(shipment, actor, session) {
  const payment = await Payment.findOne({ order: shipment.order }).session(session);
  if (!payment || payment.method !== 'cod') return;

  await Transaction.create(
    [
      {
        type: TRANSACTION_TYPES.COD_COLLECTED,
        direction: 'in',
        amount: payableOf(shipment),
        method: 'cod',
        order: shipment.order,
        orderNumber: shipment.orderNumber,
        sellerOrder: shipment._id,
        payment: payment._id,
        customer: shipment.customer,
        seller: shipment.seller,
        store: shipment.store,
        reference: shipment.orderNumber,
        createdBy: actor.id,
      },
    ],
    { session },
  );

  payment.amountPaid += payableOf(shipment);
  if (payment.status === PAYMENT_STATUS.PENDING) await completeCodIfDone(payment, session);
  await payment.save({ session });
  await syncOrderPayment(payment, session);
}

/**
 * Called after a shipment is cancelled.
 * - Paid online → its amount becomes refund due.
 * - Nothing collected and everything cancelled → payment cancelled.
 * - COD where the rest was delivered → payment complete.
 * A payment still waiting for verification is left alone: the admin verifies (then refunds) or rejects it.
 */
export async function onShipmentCancelled(shipment, session) {
  const payment = await Payment.findOne({ order: shipment.order }).session(session);
  if (!payment) return;

  if (payment.status === PAYMENT_STATUS.PAID && payment.method === 'manual') {
    payment.refundDue += payableOf(shipment);
    payment.history.push(event(PAYMENT_STATUS.PAID, `Refund due ${rupees(payableOf(shipment))} for cancelled ${shipment.orderNumber}`));
  } else if ([PAYMENT_STATUS.PENDING, PAYMENT_STATUS.REJECTED].includes(payment.status)) {
    const shipments = await SellerOrder.find({ order: shipment.order }).select('status').session(session).lean();
    if (shipments.every((s) => s.status === ORDER_STATUS.CANCELLED)) {
      payment.status = PAYMENT_STATUS.CANCELLED;
      payment.history.push(event(PAYMENT_STATUS.CANCELLED, 'Order cancelled, nothing to collect'));
    } else if (payment.method === 'cod') {
      await completeCodIfDone(payment, session);
    }
  }

  await payment.save({ session });
  await syncOrderPayment(payment, session);
}

/* ------------------------------------------------------------------ */
/* Admin: verification, rejection, refunds                             */
/* ------------------------------------------------------------------ */

async function emailCustomer(customerId, template) {
  const customer = await User.findById(customerId).select('name email').lean();
  if (customer) queueEmail(customer.email, template(customer.name));
}

/**
 * Admin checked the bank / UPI statement and found the money.
 * Payment → paid, a `payment_received` transaction is recorded, and all shipments waiting for payment are confirmed.
 * Shipments the customer already cancelled become refund due.
 */
export async function verifyPayment(id, admin) {
  let verified;
  await mongoose.connection.transaction(async (session) => {
    const payment = await Payment.findById(id).session(session);
    if (!payment) throw ApiError.notFound('Payment not found');
    if (payment.status !== PAYMENT_STATUS.PENDING_VERIFICATION) {
      throw ApiError.conflict('Only payments waiting for verification can be verified', 'PAYMENT_NOT_PENDING');
    }

    const now = new Date();
    payment.status = PAYMENT_STATUS.PAID;
    payment.amountPaid = payment.amount;
    payment.verifiedAt = now;
    payment.verifiedBy = admin.id;
    payment.paidAt = now;
    payment.rejectionReason = undefined;
    payment.history.push(event(PAYMENT_STATUS.PAID, `Verified UTR ${payment.utr}`, admin));

    await Transaction.create(
      [
        {
          type: TRANSACTION_TYPES.PAYMENT_RECEIVED,
          direction: 'in',
          amount: payment.amount,
          method: 'manual',
          order: payment.order,
          orderNumber: payment.orderNumber,
          payment: payment._id,
          customer: payment.customer,
          reference: payment.utr,
          createdBy: admin.id,
        },
      ],
      { session },
    );

    const shipments = await SellerOrder.find({ order: payment.order }).session(session);
    for (const shipment of shipments) {
      if (shipment.status === ORDER_STATUS.PENDING) {
        shipment.status = ORDER_STATUS.CONFIRMED;
        shipment.statusHistory.push({ status: ORDER_STATUS.CONFIRMED, note: 'Payment verified', by: admin.id, role: admin.role });
        await shipment.save({ session });
      } else if (shipment.status === ORDER_STATUS.CANCELLED) {
        payment.refundDue += payableOf(shipment);
      }
    }

    await payment.save({ session });
    await refreshOrderStatus(payment.order, session);
    await syncOrderPayment(payment, session);
    verified = payment;
  });

  notify(verified.customer, {
    type: 'payment_verified',
    title: `Payment received for ${verified.orderNumber}`,
    body: `We verified your payment of ${rupees(verified.amount)}. Your order is confirmed.`,
    link: `/my-orders/${verified.orderNumber}`,
  });
  await emailCustomer(verified.customer, (name) =>
    emailTemplates.paymentVerified({ name, orderNumber: verified.orderNumber, amount: rupees(verified.amount) }),
  );
  return verified;
}

/** The UTR could not be matched. The customer can submit a new one; the old one is blocked forever. */
export async function rejectPayment(id, { reason }, admin) {
  const payment = await Payment.findById(id);
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.status !== PAYMENT_STATUS.PENDING_VERIFICATION) {
    throw ApiError.conflict('Only payments waiting for verification can be rejected', 'PAYMENT_NOT_PENDING');
  }

  if (payment.utr) payment.rejectedUtrs.push(payment.utr);
  payment.history.push(event(PAYMENT_STATUS.REJECTED, `UTR ${payment.utr} rejected: ${reason}`, admin));
  payment.utr = undefined;
  payment.status = PAYMENT_STATUS.REJECTED;
  payment.rejectionReason = reason;
  await payment.save();
  await syncOrderPayment(payment);

  notify(payment.customer, {
    type: 'payment_rejected',
    title: `Payment not found for ${payment.orderNumber}`,
    body: `${reason} Please submit the correct UTR from your order page.`,
    link: `/my-orders/${payment.orderNumber}`,
  });
  await emailCustomer(payment.customer, (name) =>
    emailTemplates.paymentRejected({ name, orderNumber: payment.orderNumber, reason }),
  );
  return payment;
}

/** Records money sent back to the customer (bank / UPI transfer done outside the app). */
export async function recordRefund(id, { amount, reference, note }, admin) {
  let refunded;
  await mongoose.connection.transaction(async (session) => {
    const payment = await Payment.findById(id).session(session);
    if (!payment) throw ApiError.notFound('Payment not found');

    const outstanding = payment.refundDue - payment.refundedAmount;
    if (outstanding <= 0) throw ApiError.conflict('Nothing is due for refund on this payment', 'NO_REFUND_DUE');
    if (amount > outstanding) throw ApiError.field('amount', `You can refund at most ${rupees(outstanding)}`);

    payment.refundedAmount += amount;
    payment.history.push(event(payment.status, `Refunded ${rupees(amount)} (ref ${reference})${note ? `: ${note}` : ''}`, admin));

    await Transaction.create(
      [
        {
          type: TRANSACTION_TYPES.REFUND,
          direction: 'out',
          amount,
          method: payment.method,
          order: payment.order,
          orderNumber: payment.orderNumber,
          payment: payment._id,
          customer: payment.customer,
          reference,
          note,
          createdBy: admin.id,
        },
      ],
      { session },
    );

    await payment.save({ session });
    await syncOrderPayment(payment, session);
    refunded = payment;
  });

  notify(refunded.customer, {
    type: 'refund_sent',
    title: `Refund of ${rupees(amount)} sent`,
    body: `For order ${refunded.orderNumber}. Reference ${reference}.`,
    link: `/my-orders/${refunded.orderNumber}`,
  });
  await emailCustomer(refunded.customer, (name) =>
    emailTemplates.refundRecorded({ name, orderNumber: refunded.orderNumber, amount: rupees(amount), reference }),
  );
  return refunded;
}

/* ------------------------------------------------------------------ */
/* Customer: submit a new UTR after a rejection                        */
/* ------------------------------------------------------------------ */

export async function resubmitPayment(user, orderNumber, { utr }) {
  const payment = await Payment.findOne({ orderNumber, customer: user.id });
  if (!payment) throw ApiError.notFound('Order not found');
  if (payment.status !== PAYMENT_STATUS.REJECTED) {
    throw ApiError.conflict('This payment is not waiting for a new reference', 'PAYMENT_NOT_REJECTED');
  }
  const hasOpenShipments = await SellerOrder.exists({ order: payment.order, status: ORDER_STATUS.PENDING });
  if (!hasOpenShipments) throw ApiError.conflict('This order was cancelled', 'ORDER_CANCELLED');

  payment.utr = await assertUtrAvailable(utr);
  payment.status = PAYMENT_STATUS.PENDING_VERIFICATION;
  payment.submittedAt = new Date();
  payment.rejectionReason = undefined;
  payment.history.push(event(PAYMENT_STATUS.PENDING_VERIFICATION, `New UTR ${payment.utr} submitted`, user));
  await payment.save();
  await syncOrderPayment(payment);
  return payment;
}

/* ------------------------------------------------------------------ */
/* Admin lists                                                         */
/* ------------------------------------------------------------------ */

const refundDueExpr = { $expr: { $gt: ['$refundDue', '$refundedAmount'] } };

export async function listPayments({ status, method, search, page, limit }) {
  const filter = {};
  if (status === 'refund_due') Object.assign(filter, refundDueExpr);
  else if (status) filter.status = status;
  if (method) filter.method = method;
  if (search) {
    const rx = searchRegex(search);
    filter.$or = [{ orderNumber: rx }, { utr: searchRegex(search.toUpperCase()) }];
  }

  // Oldest first in the verification queue (fair, first come first served).
  const sort = status === PAYMENT_STATUS.PENDING_VERIFICATION ? { submittedAt: 1 } : { createdAt: -1 };

  const [items, total, groups, refundDueCount] = await Promise.all([
    Payment.find(filter)
      .sort(sort)
      .skip(skipFor(page, limit))
      .limit(limit)
      .select('-history -__v')
      .populate('customer', 'name email')
      .lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Payment.countDocuments(refundDueExpr),
  ]);

  return {
    items,
    pagination: pageMeta(total, page, limit),
    counts: { ...statusCounts(groups, PAYMENT_STATUS_VALUES), refund_due: refundDueCount },
  };
}

export async function getPayment(id) {
  const payment = await Payment.findById(id)
    .populate('customer', 'name email phone')
    .populate('verifiedBy', 'name')
    .populate('history.by', 'name');
  if (!payment) throw ApiError.notFound('Payment not found');

  const transactions = await Transaction.find({ payment: payment._id }).sort({ createdAt: 1 }).lean();
  return { ...payment.toJSON(), transactions };
}

/** Totals for a set of transactions: money in (online + cash), money out (refunds) and net. */
async function summarizeTransactions(match) {
  const groups = await Transaction.aggregate([{ $match: match }, { $group: { _id: '$type', amount: { $sum: '$amount' }, count: { $sum: 1 } } }]);
  const byType = Object.fromEntries(TRANSACTION_TYPE_VALUES.map((t) => [t, { amount: 0, count: 0 }]));
  for (const g of groups) byType[g._id] = { amount: g.amount, count: g.count };

  const received = byType.payment_received.amount;
  const codCollected = byType.cod_collected.amount;
  const refunded = byType.refund.amount;
  return { received, codCollected, refunded, net: received + codCollected - refunded, byType };
}

export async function listTransactions({ type, search, from, to, page, limit }) {
  const match = {};
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = from;
    if (to) match.createdAt.$lte = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1); // whole "to" day
  }
  if (search) {
    const rx = searchRegex(search);
    match.$or = [{ orderNumber: rx }, { reference: rx }];
  }

  const filter = type ? { ...match, type } : match;
  const [items, total, summary] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skipFor(page, limit))
      .limit(limit)
      .populate('customer', 'name email')
      .populate('store', 'storeName')
      .populate('createdBy', 'name')
      .lean(),
    Transaction.countDocuments(filter),
    summarizeTransactions(match), // summary ignores the type tab so all totals stay visible
  ]);

  return { items, pagination: pageMeta(total, page, limit), summary };
}

/** Net money collected on the platform (used by the admin dashboard). */
export async function collectedTotal() {
  const { net } = await summarizeTransactions({});
  return net;
}
