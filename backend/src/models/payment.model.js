import mongoose from 'mongoose';
import { PAYMENT_METHODS, PAYMENT_STATUS_VALUES, ROLE_VALUES } from '../utils/constants.js';

const { Schema } = mongoose;

const paymentEventSchema = new Schema(
  {
    status: { type: String, enum: PAYMENT_STATUS_VALUES, required: true },
    note: { type: String, maxlength: 300 },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: [...ROLE_VALUES, 'system'] },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

/**
 * One payment per order: the source of truth for what the customer owes / paid / gets back.
 * Order.payment holds a read-only copy for fast display.
 * Amounts in paise.
 */
const paymentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    orderNumber: { type: String, required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    status: { type: String, enum: PAYMENT_STATUS_VALUES, required: true, index: true },

    amount: { type: Number, required: true }, // order total
    amountPaid: { type: Number, default: 0 }, // verified (manual) or collected so far (COD)
    refundDue: { type: Number, default: 0 }, // paid amount of cancelled shipments
    refundedAmount: { type: Number, default: 0 },

    // Manual payments: UTR is unique across all payments; rejected UTRs can never be reused.
    utr: { type: String, uppercase: true, trim: true },
    rejectedUtrs: { type: [String], default: [] },
    submittedAt: Date,
    verifiedAt: Date,
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, maxlength: 300 },
    paidAt: Date,

    history: { type: [paymentEventSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

paymentSchema.index({ utr: 1 }, { unique: true, partialFilterExpression: { utr: { $type: 'string' } } });
paymentSchema.index({ rejectedUtrs: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });

export const Payment = mongoose.model('Payment', paymentSchema);
