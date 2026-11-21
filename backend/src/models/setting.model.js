import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Platform-wide settings an admin can change at runtime (one document per key).
 * Keys used today: 'commission' → { defaultRate }.
 */
const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
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

export const Setting = mongoose.model('Setting', settingSchema);
