import mongoose from 'mongoose';
import { EARNING_STATUS, LEDGER_TYPE_VALUES, PAYOUT_METHODS } from '../utils/constants.js';

const { Schema } = mongoose;

const toJSON = {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
};

/**
 * Running balance per store (paise). Changed only with atomic $inc inside a transaction,
 * always together with a ledger entry, so it can be rebuilt from the ledger at any time.
 * - onHold:    earned, but still inside the hold window after delivery
 * - available: can be paid out now
 */
const sellerWalletSchema = new Schema(
  {
    store: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true, unique: true },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    onHold: { type: Number, default: 0, min: 0 },
    // Can go below 0 when a return is debited after the money was released; payouts need it > 0.
    available: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 }, // seller's share of every delivered shipment
    totalCommission: { type: Number, default: 0 }, // platform commission on those shipments
    totalPaidOut: { type: Number, default: 0 },
    lastPayoutAt: Date,
  },
  { timestamps: true, toJSON },
);

sellerWalletSchema.index({ available: -1 });

/**
 * Seller earnings ledger. Append-only: entries are never deleted.
 * The only field that changes is an earning's status (on_hold → available) when its hold ends.
 * amount is signed: + earning, − payout.
 */
const ledgerEntrySchema = new Schema(
  {
    store: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: LEDGER_TYPE_VALUES, required: true },
    amount: { type: Number, required: true },

    // Earnings
    sellerOrder: { type: Schema.Types.ObjectId, ref: 'SellerOrder' },
    orderNumber: String,
    gross: Number, // shipment total paid by the customer
    commissionRate: Number,
    commission: Number,
    status: { type: String, enum: Object.values(EARNING_STATUS) },
    availableAt: Date,
    releasedAt: Date,

    // Payouts
    payout: { type: Schema.Types.ObjectId, ref: 'Payout' },

    // Returns
    returnRequest: { type: Schema.Types.ObjectId, ref: 'ReturnRequest' },

    note: { type: String, trim: true, maxlength: 300 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON },
);

// One earning per shipment, even if "delivered" were processed twice.
ledgerEntrySchema.index(
  { sellerOrder: 1 },
  { unique: true, partialFilterExpression: { type: 'earning' } },
);
ledgerEntrySchema.index({ returnRequest: 1 }, { unique: true, partialFilterExpression: { type: 'return' } });
ledgerEntrySchema.index({ store: 1, createdAt: -1 });
ledgerEntrySchema.index({ status: 1, availableAt: 1 });

/** Money the admin sent to a seller's bank / UPI, recorded by hand (no payment gateway). */
const payoutSchema = new Schema(
  {
    store: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true, index: true },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 100 },
    method: { type: String, enum: PAYOUT_METHODS, required: true },
    reference: { type: String, required: true, uppercase: true, trim: true, unique: true, maxlength: 60 },
    // Where the money went (display-safe copy of the store's bank details at that moment)
    bank: {
      accountHolderName: String,
      bankName: String,
      ifsc: String,
      accountNumberLast4: String,
    },
    note: { type: String, trim: true, maxlength: 300 },
    paidBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true, toJSON },
);

payoutSchema.index({ paidAt: -1 });

export const SellerWallet = mongoose.model('SellerWallet', sellerWalletSchema);
export const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);
export const Payout = mongoose.model('Payout', payoutSchema);
