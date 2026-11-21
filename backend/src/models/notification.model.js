import mongoose from 'mongoose';

const { Schema } = mongoose;

/** In-app notification (the bell). Old notifications are removed automatically after 90 days. */
const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, maxlength: 40 }, // e.g. order_status, payout_sent
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, maxlength: 300 },
    link: { type: String, maxlength: 200 }, // in-app path, e.g. /my-orders/MK123
    readAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        delete ret.user;
        return ret;
      },
    },
  },
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Notification = mongoose.model('Notification', notificationSchema);
