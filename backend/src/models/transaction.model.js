import mongoose from 'mongoose';
import { PAYMENT_METHODS, TRANSACTION_TYPE_VALUES } from '../utils/constants.js';

const { Schema } = mongoose;

/**
 * Money ledger. Append-only: a record is never edited or deleted; corrections are new records.
 * amount is always positive (paise); `direction` says whether money came in or went out.
 */
const transactionSchema = new Schema(
  {
    type: { type: String, enum: TRANSACTION_TYPE_VALUES, required: true, index: true },
    direction: { type: String, enum: ['in', 'out'], required: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: PAYMENT_METHODS, required: true },

    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, required: true },
    sellerOrder: { type: Schema.Types.ObjectId, ref: 'SellerOrder' },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: Schema.Types.ObjectId, ref: 'User' },
    store: { type: Schema.Types.ObjectId, ref: 'SellerProfile' },

    reference: { type: String, trim: true, maxlength: 60 }, // UTR, refund reference, shipment number
    note: { type: String, trim: true, maxlength: 300 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

transactionSchema.index({ createdAt: -1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);
