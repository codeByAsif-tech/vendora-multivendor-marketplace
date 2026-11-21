import mongoose from 'mongoose';
import { RETURN_REASONS, RETURN_STATUS, RETURN_STATUS_VALUES, ROLE_VALUES } from '../utils/constants.js';

const { Schema } = mongoose;

const returnItemSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, required: true }, // SellerOrder.items[]._id
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variant: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    image: String,
    sku: String,
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const returnEventSchema = new Schema(
  {
    status: { type: String, enum: RETURN_STATUS_VALUES, required: true },
    note: { type: String, maxlength: 500 },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: [...ROLE_VALUES, 'system'] },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

/**
 * Customer return for (some items of) one delivered shipment.
 * requested → approved | rejected; approved → received (stock back, refund due, seller debited).
 * Amounts in paise.
 */
const returnRequestSchema = new Schema(
  {
    returnNumber: { type: String, required: true, unique: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    sellerOrder: { type: Schema.Types.ObjectId, ref: 'SellerOrder', required: true, index: true },
    orderNumber: { type: String, required: true }, // shipment number, e.g. MK...-1
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    store: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true },

    items: { type: [returnItemSchema], required: true },
    reason: { type: String, enum: Object.keys(RETURN_REASONS), required: true },
    details: { type: String, trim: true, maxlength: 1000 },
    refundUpi: { type: String, trim: true, maxlength: 60 }, // where to send the refund (optional)

    itemsValue: { type: Number, required: true }, // unit price × quantity
    refundAmount: { type: Number, required: true }, // itemsValue minus its share of any coupon discount
    sellerDebit: { type: Number, required: true }, // itemsValue minus commission on it

    status: { type: String, enum: RETURN_STATUS_VALUES, default: RETURN_STATUS.REQUESTED },
    rejectionReason: { type: String, maxlength: 500 },
    history: { type: [returnEventSchema], default: [] },
    receivedAt: Date,
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

returnRequestSchema.index({ seller: 1, status: 1, createdAt: -1 });
returnRequestSchema.index({ status: 1, createdAt: -1 });

export const ReturnRequest = mongoose.model('ReturnRequest', returnRequestSchema);
