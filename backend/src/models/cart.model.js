import mongoose from 'mongoose';

/**
 * One cart per customer. Only references and quantities are stored:
 * prices, stock and availability are always read live from the product.
 */
const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variant: { type: mongoose.Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true, min: 1 },
  addedAt: { type: Date, default: Date.now },
});

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
    /** Coupon the customer applied; re-checked every time the cart is read and at checkout. */
    couponCode: { type: String, uppercase: true, trim: true },
  },
  { timestamps: true },
);

export const Cart = mongoose.model('Cart', cartSchema);
