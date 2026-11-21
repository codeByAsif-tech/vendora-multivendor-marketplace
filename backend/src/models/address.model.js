import mongoose from 'mongoose';
import { ADDRESS_TYPES } from '../utils/constants.js';

/** Fields shared by saved addresses and the address snapshot stored on orders. */
export const addressFields = {
  fullName: { type: String, required: true, trim: true, maxlength: 80 },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  line1: { type: String, required: true, trim: true, maxlength: 120 },
  line2: { type: String, trim: true, maxlength: 120 },
  landmark: { type: String, trim: true, maxlength: 80 },
  city: { type: String, required: true, trim: true, maxlength: 60 },
  state: { type: String, required: true, trim: true, maxlength: 60 },
  postalCode: { type: String, required: true, trim: true, maxlength: 10 },
  country: { type: String, required: true, trim: true, default: 'India', maxlength: 60 },
};

const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ...addressFields,
    type: { type: String, enum: ADDRESS_TYPES, default: 'home' },
    isDefault: { type: Boolean, default: false },
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

export const Address = mongoose.model('Address', addressSchema);
