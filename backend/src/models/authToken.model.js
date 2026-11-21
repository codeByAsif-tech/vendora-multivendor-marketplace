import mongoose from 'mongoose';

export const AUTH_TOKEN_TYPES = Object.freeze({
  EMAIL_VERIFY: 'email_verify',
  PASSWORD_RESET: 'password_reset',
});

/**
 * One-time tokens sent by email (verify email, reset password).
 * Only a SHA-256 hash is stored, so a database leak does not reveal usable links.
 * Single use (usedAt is set atomically) and short-lived; expired rows are removed by MongoDB (TTL index).
 */
const authTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(AUTH_TOKEN_TYPES), required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authTokenSchema.index({ user: 1, type: 1, createdAt: -1 });

export const AuthToken = mongoose.model('AuthToken', authTokenSchema);
