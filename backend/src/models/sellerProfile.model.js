import mongoose from 'mongoose';
import { BUSINESS_TYPES, SELLER_STATUS, SELLER_STATUS_VALUES } from '../utils/constants.js';

const imageSchema = new mongoose.Schema(
  { url: { type: String, required: true }, publicId: { type: String, required: true } },
  { _id: false },
);

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, required: true, trim: true, maxlength: 120 },
    line2: { type: String, trim: true, maxlength: 120 },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    state: { type: String, required: true, trim: true, maxlength: 60 },
    postalCode: { type: String, required: true, trim: true, maxlength: 10 },
    country: { type: String, required: true, trim: true, default: 'India', maxlength: 60 },
  },
  { _id: false },
);

// Only display-safe bank fields live here. The full account number is encrypted separately.
const bankSchema = new mongoose.Schema(
  {
    accountHolderName: { type: String, required: true, trim: true, maxlength: 80 },
    bankName: { type: String, required: true, trim: true, maxlength: 80 },
    ifsc: { type: String, required: true, uppercase: true, trim: true, maxlength: 11 },
    accountNumberLast4: { type: String, required: true, maxlength: 4 },
  },
  { _id: false },
);

const statusEventSchema = new mongoose.Schema(
  {
    status: { type: String, enum: SELLER_STATUS_VALUES, required: true },
    reason: { type: String, maxlength: 500 },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const sellerProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    storeName: { type: String, required: true, trim: true, minlength: 3, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, trim: true, maxlength: 1000 },
    logo: imageSchema,
    banner: imageSchema,

    businessType: { type: String, enum: BUSINESS_TYPES, required: true },
    gstin: { type: String, uppercase: true, trim: true, maxlength: 15 },
    pan: { type: String, uppercase: true, trim: true, required: true, maxlength: 10 },

    contactEmail: { type: String, lowercase: true, trim: true, required: true, maxlength: 254 },
    contactPhone: { type: String, trim: true, required: true, maxlength: 20 },
    pickupAddress: { type: addressSchema, required: true },

    bank: { type: bankSchema, required: true },
    bankAccountNumberEncrypted: { type: String, required: true, select: false },

    status: {
      type: String,
      enum: SELLER_STATUS_VALUES,
      default: SELLER_STATUS.PENDING,
      index: true,
    },
    /** Latest rejection / suspension reason shown to the seller. */
    statusReason: { type: String, maxlength: 500 },
    statusHistory: { type: [statusEventSchema], default: [] },
    /** Commission override (%) for this store. null = platform default. */
    commissionRate: { type: Number, min: 0, max: 50, default: null },
    submittedAt: { type: Date },
    approvedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.bankAccountNumberEncrypted;
        delete ret.__v;
        return ret;
      },
    },
  },
);

sellerProfileSchema.index({ status: 1, submittedAt: -1 });

export const SellerProfile = mongoose.model('SellerProfile', sellerProfileSchema);
