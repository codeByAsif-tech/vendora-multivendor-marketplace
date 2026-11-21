import mongoose from 'mongoose';

/**
 * Two levels only: top-level categories (level 0) and subcategories (level 1).
 * Products are always attached to a leaf (a subcategory, or a top-level category without children).
 * Slugs of subcategories include the parent slug, e.g. "fashion-t-shirts".
 */
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, trim: true, maxlength: 500 },
    image: {
      type: new mongoose.Schema({ url: String, publicId: String }, { _id: false }),
      default: undefined,
    },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    level: { type: Number, enum: [0, 1], default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, min: 0 },
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

categorySchema.index({ parent: 1, sortOrder: 1, name: 1 });

export const Category = mongoose.model('Category', categorySchema);
