import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { LedgerEntry, Payout, SellerWallet } from '../models/earnings.model.js';
import { SellerOrder } from '../models/order.model.js';
import { SellerProfile } from '../models/sellerProfile.model.js';
import { User } from '../models/user.model.js';
import { emailTemplates } from '../templates/emails/index.js';
import { ApiError } from '../utils/ApiError.js';
import { EARNING_STATUS, LEDGER_TYPES } from '../utils/constants.js';
import { pageMeta, skipFor } from '../utils/pagination.js';
import { searchRegex } from '../utils/text.js';
import { effectiveRate, getDefaultRate, ratesForStores, splitShipment } from './commission.service.js';
import { queueEmail } from './email.service.js';
import { notify } from './notification.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/* ------------------------------------------------------------------ */
/* Ledger writes                                                       */
/* ------------------------------------------------------------------ */

/**
 * Called inside the "delivered" transaction: adds the seller's share of the shipment to their wallet.
 * The money is on hold for EARNINGS_HOLD_DAYS (returns window), then becomes available for payout.
 * Safe to call twice: the unique index allows one earning per shipment.
 */
export async function creditEarning(shipment, actor, session) {
  const exists = await LedgerEntry.exists({ sellerOrder: shipment._id, type: LEDGER_TYPES.EARNING }).session(session);
  if (exists) return;

  // Orders placed before commission existed get today's rate.
  let split = {
    commissionRate: shipment.commissionRate,
    commissionAmount: shipment.commissionAmount,
    sellerEarning: shipment.sellerEarning,
  };
  if (split.sellerEarning == null) {
    const rates = await ratesForStores([shipment.store], session);
    split = splitShipment(shipment, rates.get(String(shipment.store)));
    await SellerOrder.updateOne({ _id: shipment._id }, { $set: split }, { session });
  }

  const deliveredAt = shipment.deliveredAt ?? new Date();
  const onHold = env.EARNINGS_HOLD_DAYS > 0;
  const amount = split.sellerEarning;

  await LedgerEntry.create(
    [
      {
        store: shipment.store,
        seller: shipment.seller,
        type: LEDGER_TYPES.EARNING,
        amount,
        sellerOrder: shipment._id,
        orderNumber: shipment.orderNumber,
        gross: shipment.total,
        commissionRate: split.commissionRate,
        commission: split.commissionAmount,
        status: onHold ? EARNING_STATUS.ON_HOLD : EARNING_STATUS.AVAILABLE,
        availableAt: new Date(deliveredAt.getTime() + env.EARNINGS_HOLD_DAYS * DAY_MS),
        releasedAt: onHold ? undefined : deliveredAt,
        createdBy: actor?.id,
      },
    ],
    { session },
  );

  await SellerWallet.updateOne(
    { store: shipment.store },
    {
      $setOnInsert: { seller: shipment.seller },
      $inc: {
        [onHold ? 'onHold' : 'available']: amount,
        totalEarned: amount,
        totalCommission: split.commissionAmount,
      },
    },
    { upsert: true, session },
  );
}

/**
 * Moves earnings whose hold has ended from "on hold" to "available".
 * Runs lazily whenever balances are read or a payout is made (no cron needed).
 * Each entry is released in its own small transaction with a status check, so two
 * requests running this at the same time can never release the same money twice.
 */
export async function releaseMatured({ store } = {}) {
  const filter = { type: LEDGER_TYPES.EARNING, status: EARNING_STATUS.ON_HOLD, availableAt: { $lte: new Date() } };
  if (store) filter.store = store;
  const due = await LedgerEntry.find(filter).select('_id store amount').limit(500).lean();

  for (const entry of due) {
    await mongoose.connection.transaction(async (session) => {
      const result = await LedgerEntry.updateOne(
        { _id: entry._id, status: EARNING_STATUS.ON_HOLD },
        { $set: { status: EARNING_STATUS.AVAILABLE, releasedAt: new Date() } },
        { session },
      );
      if (result.modifiedCount !== 1) return;
      await SellerWallet.updateOne(
        { store: entry.store },
        { $inc: { onHold: -entry.amount, available: entry.amount } },
        { session },
      );
    });
  }
  return due.length;
}

/* ------------------------------------------------------------------ */
/* Seller                                                              */
/* ------------------------------------------------------------------ */

const EMPTY_WALLET = { onHold: 0, available: 0, totalEarned: 0, totalCommission: 0, totalPaidOut: 0, lastPayoutAt: null };

async function storeOf(sellerId) {
  return SellerProfile.findOne({ user: sellerId }).select('_id commissionRate bank').lean();
}

/** Seller's balances, current commission rate and when the next on-hold money becomes available. */
export async function getMyWallet(sellerId) {
  const [store, defaultRate] = await Promise.all([storeOf(sellerId), getDefaultRate()]);
  const base = { commissionRate: effectiveRate(store, defaultRate), holdDays: env.EARNINGS_HOLD_DAYS };
  if (!store) return { ...EMPTY_WALLET, ...base, nextRelease: null, bank: null };

  await releaseMatured({ store: store._id });
  const [wallet, next] = await Promise.all([
    SellerWallet.findOne({ store: store._id }).lean(),
    LedgerEntry.findOne({ store: store._id, type: LEDGER_TYPES.EARNING, status: EARNING_STATUS.ON_HOLD })
      .sort({ availableAt: 1 })
      .select('amount availableAt')
      .lean(),
  ]);

  return {
    ...EMPTY_WALLET,
    ...(wallet && {
      onHold: wallet.onHold,
      available: wallet.available,
      totalEarned: wallet.totalEarned,
      totalCommission: wallet.totalCommission,
      totalPaidOut: wallet.totalPaidOut,
      lastPayoutAt: wallet.lastPayoutAt ?? null,
    }),
    ...base,
    nextRelease: next ? { amount: next.amount, at: next.availableAt } : null,
    bank: store.bank ?? null,
  };
}

export async function listMyLedger(sellerId, { type, page, limit }) {
  const store = await storeOf(sellerId);
  if (!store) return { items: [], pagination: pageMeta(0, page, limit) };

  const filter = { store: store._id };
  if (type) filter.type = type;
  const [items, total] = await Promise.all([
    LedgerEntry.find(filter)
      .sort({ createdAt: -1 })
      .skip(skipFor(page, limit))
      .limit(limit)
      .populate('payout', 'method reference paidAt')
      .select('-createdBy -__v')
      .lean(),
    LedgerEntry.countDocuments(filter),
  ]);
  return { items, pagination: pageMeta(total, page, limit) };
}

export async function listMyPayouts(sellerId, { page, limit }) {
  const store = await storeOf(sellerId);
  if (!store) return { items: [], pagination: pageMeta(0, page, limit) };

  const filter = { store: store._id };
  const [items, total] = await Promise.all([
    Payout.find(filter).sort({ paidAt: -1 }).skip(skipFor(page, limit)).limit(limit).select('-paidBy -__v').lean(),
    Payout.countDocuments(filter),
  ]);
  return { items, pagination: pageMeta(total, page, limit) };
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

async function storeIdsMatching(search) {
  const rx = searchRegex(search);
  const owners = await User.find({ $or: [{ name: rx }, { email: rx }] }).select('_id').limit(500).lean();
  const stores = await SellerProfile.find({ $or: [{ storeName: rx }, { user: { $in: owners.map((o) => o._id) } }] })
    .select('_id')
    .limit(500)
    .lean();
  return stores.map((s) => s._id);
}

/** Platform totals for the payouts screen and dashboard. */
export async function walletTotals() {
  const [totals] = await SellerWallet.aggregate([
    {
      $group: {
        _id: null,
        available: { $sum: '$available' },
        onHold: { $sum: '$onHold' },
        totalPaidOut: { $sum: '$totalPaidOut' },
        totalCommission: { $sum: '$totalCommission' },
        sellersDue: { $sum: { $cond: [{ $gt: ['$available', 0] }, 1, 0] } },
      },
    },
  ]);
  return {
    available: totals?.available ?? 0,
    onHold: totals?.onHold ?? 0,
    totalPaidOut: totals?.totalPaidOut ?? 0,
    totalCommission: totals?.totalCommission ?? 0,
    sellersDue: totals?.sellersDue ?? 0,
  };
}

/** Seller balances, biggest amount ready to pay first. `due=true` → only sellers with money available. */
export async function listBalances({ search, due, page, limit }) {
  await releaseMatured();

  const filter = {};
  if (due) filter.available = { $gt: 0 };
  if (search) filter.store = { $in: await storeIdsMatching(search) };

  const [items, total, totals, defaultRate] = await Promise.all([
    SellerWallet.find(filter)
      .sort({ available: -1, onHold: -1 })
      .skip(skipFor(page, limit))
      .limit(limit)
      .populate('store', 'storeName slug status bank commissionRate')
      .populate('seller', 'name email')
      .lean(),
    SellerWallet.countDocuments(filter),
    walletTotals(),
    getDefaultRate(),
  ]);

  return {
    items: items.map((w) => ({ ...w, commissionRate: effectiveRate(w.store, defaultRate) })),
    pagination: pageMeta(total, page, limit),
    totals,
  };
}

/**
 * Admin sent money to a seller (bank transfer / UPI, outside the app) and records it here.
 * The wallet is debited with a conditional $inc, so the payout can never exceed the available
 * balance, even if two admins record payouts at the same moment.
 */
export async function createPayout({ storeId, amount, method, reference, note }, admin) {
  const store = await SellerProfile.findById(storeId).populate('user', 'name email');
  if (!store) throw ApiError.notFound('Seller not found');

  await releaseMatured({ store: store._id });

  let payout;
  try {
    await mongoose.connection.transaction(async (session) => {
      const wallet = await SellerWallet.findOneAndUpdate(
        { store: store._id, available: { $gte: amount } },
        { $inc: { available: -amount, totalPaidOut: amount }, $set: { lastPayoutAt: new Date() } },
        { new: true, session },
      );
      if (!wallet) {
        const current = await SellerWallet.findOne({ store: store._id }).select('available').session(session).lean();
        throw ApiError.conflict(
          `Only ${rupees(current?.available ?? 0)} is available to pay out for this seller`,
          'INSUFFICIENT_BALANCE',
        );
      }

      [payout] = await Payout.create(
        [
          {
            store: store._id,
            seller: store.user._id,
            amount,
            method,
            reference,
            bank: store.bank?.toObject?.() ?? store.bank,
            note,
            paidBy: admin.id,
          },
        ],
        { session },
      );

      await LedgerEntry.create(
        [
          {
            store: store._id,
            seller: store.user._id,
            type: LEDGER_TYPES.PAYOUT,
            amount: -amount,
            payout: payout._id,
            note,
            createdBy: admin.id,
          },
        ],
        { session },
      );
    });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.reference) {
      throw ApiError.conflict('This payout reference has already been recorded', 'DUPLICATE_REFERENCE');
    }
    throw err;
  }

  notify(store.user._id, {
    type: 'payout_sent',
    title: `Payout of ${rupees(amount)} sent`,
    body: `Reference ${payout.reference}${store.bank?.accountNumberLast4 ? ` · to account ending ${store.bank.accountNumberLast4}` : ''}`,
    link: '/seller/earnings',
  });
  queueEmail(
    store.user.email,
    emailTemplates.payoutSent({
      name: store.user.name,
      amount: rupees(amount),
      reference: payout.reference,
      last4: store.bank?.accountNumberLast4,
    }),
  );

  return payout;
}

export async function listPayouts({ store, search, from, to, page, limit }) {
  const filter = {};
  if (store) filter.store = store;
  if (search) {
    const rx = searchRegex(search);
    filter.$or = [{ reference: rx }, { store: { $in: await storeIdsMatching(search) } }];
  }
  if (from || to) {
    filter.paidAt = {};
    if (from) filter.paidAt.$gte = from;
    if (to) filter.paidAt.$lte = to;
  }

  const [items, total] = await Promise.all([
    Payout.find(filter)
      .sort({ paidAt: -1 })
      .skip(skipFor(page, limit))
      .limit(limit)
      .populate('store', 'storeName slug')
      .populate('paidBy', 'name')
      .lean(),
    Payout.countDocuments(filter),
  ]);
  return { items, pagination: pageMeta(total, page, limit) };
}
