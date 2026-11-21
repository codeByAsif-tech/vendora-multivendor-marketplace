import mongoose from 'mongoose';
import {
  ORDER_STATUS,
  ORDER_STATUS_VALUES,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  ROLE_VALUES,
} from '../utils/constants.js';
import { addressFields } from './address.model.js';

const { Schema } = mongoose;

const addressSnapshotSchema = new Schema(addressFields, { _id: false });

/**
 * One Order per checkout (what the customer paid for).
 * It is split into one SellerOrder per seller (what each seller ships).
 * Status on the Order is derived from its SellerOrders (see utils/orderStatus.js).
 * All money in paise.
 */
const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sellerOrders: [{ type: Schema.Types.ObjectId, ref: 'SellerOrder' }],
    shippingAddress: { type: addressSnapshotSchema, required: true },

    itemCount: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    shippingTotal: { type: Number, required: true },
    discountTotal: { type: Number, default: 0 }, // coupon discount (platform-funded)
    total: { type: Number, required: true }, // subtotal + shipping − discount = what the customer pays
    coupon: {
      code: String,
      couponId: { type: Schema.Types.ObjectId, ref: 'Coupon' },
    },

    /** Read-only copy of the Payment document (kept in sync by payment.service) for fast display. */
    payment: {
      method: { type: String, enum: PAYMENT_METHODS, required: true },
      status: { type: String, enum: Object.values(PAYMENT_STATUS), required: true },
      utr: { type: String, trim: true, maxlength: 40 }, // manual payment reference
      verifiedAt: Date,
      rejectionReason: String,
      amountPaid: { type: Number, default: 0 },
      refundDue: { type: Number, default: 0 },
      refundedAmount: { type: Number, default: 0 },
    },

    status: { type: String, enum: ORDER_STATUS_VALUES, default: ORDER_STATUS.PENDING, index: true },
    note: { type: String, trim: true, maxlength: 300 },
    /** Client-generated key: retries of the same checkout return the same order. */
    idempotencyKey: { type: String, required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        delete ret.idempotencyKey;
        return ret;
      },
    },
  },
);

orderSchema.index({ customer: 1, idempotencyKey: 1 }, { unique: true });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });

const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variant: { type: Schema.Types.ObjectId, required: true },
    // Snapshot at the time of purchase (the product may change later)
    name: { type: String, required: true },
    slug: String,
    image: String,
    sku: String,
    attributes: [{ _id: false, name: String, value: String }],
    unitPrice: { type: Number, required: true },
    compareAtPrice: Number,
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true },
    /** Units already returned (Phase 9); a unit can be returned only once. */
    returnedQuantity: { type: Number, default: 0 },
  },
  { _id: true },
);

const statusEventSchema = new Schema(
  {
    status: { type: String, enum: ORDER_STATUS_VALUES, required: true },
    note: { type: String, maxlength: 300 },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: [...ROLE_VALUES, 'system'] },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const sellerOrderSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, required: true, unique: true }, // e.g. MK261112A1B2C3-1
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    store: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true },

    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    shippingFee: { type: Number, required: true },
    total: { type: Number, required: true },
    /**
     * Part of the order's coupon discount that falls on this shipment (split by subtotal).
     * The customer pays `payable` for this shipment; the seller is not charged for coupons.
     */
    discountShare: { type: Number, default: 0 },
    payable: { type: Number, default: null }, // total − discountShare (null on older orders = total)
    /**
     * Commission snapshot taken at checkout (rate in %, amounts in paise).
     * commissionAmount = subtotal × rate; sellerEarning = total − commissionAmount.
     * null on orders placed before Phase 7 (filled in when they are delivered).
     */
    commissionRate: { type: Number, default: null },
    commissionAmount: { type: Number, default: null },
    sellerEarning: { type: Number, default: null },

    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    shippingAddress: { type: addressSnapshotSchema, required: true },

    status: { type: String, enum: ORDER_STATUS_VALUES, required: true },
    statusHistory: { type: [statusEventSchema], default: [] },
    tracking: {
      carrier: { type: String, trim: true, maxlength: 60 },
      trackingNumber: { type: String, trim: true, maxlength: 60 },
    },
    cancelReason: { type: String, maxlength: 300 },
    cancelledBy: { type: String, enum: [...ROLE_VALUES, 'system'] },
    deliveredAt: Date,
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

sellerOrderSchema.index({ seller: 1, status: 1, createdAt: -1 });
sellerOrderSchema.index({ seller: 1, createdAt: -1 });

export const Order = mongoose.model('Order', orderSchema);
export const SellerOrder = mongoose.model('SellerOrder', sellerOrderSchema);
