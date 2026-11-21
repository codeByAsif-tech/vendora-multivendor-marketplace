import mongoose from 'mongoose';
import { COUPON_TYPES } from '../utils/constants.js';

const { Schema } = mongoose;

/**
 * Platform coupon created by an admin. The discount is paid by the platform:
 * sellers still earn on the full price (commission is unchanged).
 * Money in paise; percent coupons use `value` as the percentage.
 */
const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 20 },
    description: { type: String, trim: true, maxlength: 160 },
    type: { type: String, enum: COUPON_TYPES, required: true },
    value: { type: Number, required: true, min: 1 }, // % for percent, paise for fixed
    maxDiscount: { type: Number, min: 1 }, // cap for percent coupons (paise)
    minOrderValue: { type: Number, default: 0, min: 0 }, // item subtotal needed (paise)

    startsAt: Date,
    endsAt: Date,
    usageLimit: { type: Number, min: 1 }, // total uses across all customers (empty = unlimited)
    perUserLimit: { type: Number, default: 1, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    firstOrderOnly: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
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

couponSchema.index({ isActive: 1, endsAt: 1 });

/** One row per order that used a coupon (for per-customer limits). Deleted again if the whole order is cancelled. */
const couponRedemptionSchema = new Schema(
  {
    coupon: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    discount: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

couponRedemptionSchema.index({ coupon: 1, user: 1 });

export const Coupon = mongoose.model('Coupon', couponSchema);
export const CouponRedemption = mongoose.model('CouponRedemption', couponRedemptionSchema);
