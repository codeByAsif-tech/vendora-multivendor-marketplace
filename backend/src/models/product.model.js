import mongoose from 'mongoose';
import { PRODUCT_LIMITS, PRODUCT_STATUS, PRODUCT_STATUS_VALUES } from '../utils/constants.js';
import { deriveOptions, summarizeVariants } from '../utils/productPricing.js';

const { Schema } = mongoose;

const imageSchema = new Schema(
  { url: { type: String, required: true }, publicId: { type: String, required: true } },
  { _id: false },
);

const attributeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 30 },
    value: { type: String, required: true, trim: true, maxlength: 50 },
  },
  { _id: false },
);

/**
 * Every product has at least one variant. A "simple" product has one variant with no attributes.
 * Cart and order items always point at product + variant _id, so variant ids are kept stable on edit.
 */
const variantSchema = new Schema({
  sku: { type: String, required: true, uppercase: true, trim: true, maxlength: 40 },
  attributes: { type: [attributeSchema], default: [] },
  price: { type: Number, required: true, min: 100 }, // paise
  salePrice: { type: Number, default: null, min: 100 }, // paise, must be < price
  stock: { type: Number, required: true, min: 0, default: 0 },
  lowStockThreshold: { type: Number, min: 0, default: PRODUCT_LIMITS.DEFAULT_LOW_STOCK },
  isActive: { type: Boolean, default: true },
});

const productSchema = new Schema(
  {
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    store: { type: Schema.Types.ObjectId, ref: 'SellerProfile', required: true, index: true },

    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 150 },
    slug: { type: String, required: true, unique: true },
    brand: { type: String, trim: true, maxlength: 60 },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    description: { type: String, required: true, maxlength: 5000 },
    highlights: { type: [String], default: [] },

    images: {
      type: [imageSchema],
      validate: {
        validator: (v) => v.length >= 1 && v.length <= PRODUCT_LIMITS.MAX_IMAGES,
        message: `A product needs 1 to ${PRODUCT_LIMITS.MAX_IMAGES} images`,
      },
    },

    variants: {
      type: [variantSchema],
      validate: {
        validator: (v) => v.length >= 1 && v.length <= PRODUCT_LIMITS.MAX_VARIANTS,
        message: `A product needs 1 to ${PRODUCT_LIMITS.MAX_VARIANTS} variants`,
      },
    },
    /** Derived from variants for the storefront picker, e.g. [{ name: 'Size', values: ['S','M'] }]. */
    variantOptions: {
      type: [new Schema({ name: String, values: [String] }, { _id: false })],
      default: [],
    },

    specifications: {
      type: [new Schema({ key: String, value: String }, { _id: false })],
      default: [],
    },
    tags: { type: [String], default: [] },

    // ---- Moderation & visibility ----
    status: { type: String, enum: PRODUCT_STATUS_VALUES, default: PRODUCT_STATUS.PENDING, index: true },
    rejectionReason: { type: String, maxlength: 500 },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: { type: Date },
    /** Seller-controlled on/off switch. Storefront shows: approved + active + store approved. */
    isActive: { type: Boolean, default: true },

    // ---- Derived (kept in sync in pre-validate) ----
    minPrice: { type: Number, default: 0 },
    maxPrice: { type: Number, default: 0 },
    compareAtPrice: { type: Number, default: null },
    maxDiscount: { type: Number, default: 0 },
    totalStock: { type: Number, default: 0 },

    // ---- Filled in later phases ----
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },

    /** Soft delete: past orders keep pointing at the product. */
    deletedAt: { type: Date, default: null },
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

productSchema.pre('validate', function syncDerivedFields() {
  if (!this.variants?.length) return;
  const summary = summarizeVariants(this.variants);
  this.minPrice = summary.minPrice;
  this.maxPrice = summary.maxPrice;
  this.compareAtPrice = summary.compareAtPrice;
  this.maxDiscount = summary.maxDiscount;
  this.totalStock = summary.totalStock;
  this.variantOptions = deriveOptions(this.variants);
});

// Seller dashboard lists
productSchema.index({ seller: 1, deletedAt: 1, createdAt: -1 });
productSchema.index({ seller: 1, 'variants.sku': 1 });
// Storefront browsing (Phase 4)
productSchema.index({ status: 1, isActive: 1, deletedAt: 1, category: 1, minPrice: 1 });
// Full-text search (Phase 4)
productSchema.index(
  { name: 'text', brand: 'text', tags: 'text', description: 'text' },
  { weights: { name: 10, brand: 5, tags: 5, description: 1 }, name: 'product_text_search' },
);

export const Product = mongoose.model('Product', productSchema);
