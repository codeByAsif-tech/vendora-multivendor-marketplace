import mongoose from 'mongoose';
import { REVIEW_STATUS, REVIEW_STATUS_VALUES } from '../utils/constants.js';

const { Schema } = mongoose;

/**
 * Product review. Only customers with a delivered order of the product can write one
 * (so every review is a verified purchase). One review per customer per product; editing replaces it.
 * Admins can hide a review (it then stops counting in the product rating).
 */
const reviewSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    store: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true },
    sellerOrder: { type: Schema.Types.ObjectId, ref: 'SellerOrder', required: true },
    variantLabel: { type: String, maxlength: 120 }, // e.g. "Size: M · Colour: Blue"

    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 100 },
    body: { type: String, trim: true, maxlength: 2000 },

    status: { type: String, enum: REVIEW_STATUS_VALUES, default: REVIEW_STATUS.PUBLISHED, index: true },
    hiddenReason: { type: String, maxlength: 300 },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
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

reviewSchema.index({ product: 1, user: 1 }, { unique: true });
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ createdAt: -1 });

export const Review = mongoose.model('Review', reviewSchema);
