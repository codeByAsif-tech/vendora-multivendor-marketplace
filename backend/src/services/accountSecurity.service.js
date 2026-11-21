import crypto from 'node:crypto';
import { AUTH_TOKEN_TYPES, AuthToken } from '../models/authToken.model.js';
import { User } from '../models/user.model.js';
import { disconnectUser } from '../realtime/socket.js';
import { emailTemplates } from '../templates/emails/index.js';
import { ApiError } from '../utils/ApiError.js';
import { USER_STATUS } from '../utils/constants.js';
import { queueEmail } from './email.service.js';
import { hashToken, revokeAllSessions } from './token.service.js';

const MINUTE_MS = 60 * 1000;
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * MINUTE_MS; // 24 hours
export const RESET_TOKEN_TTL_MS = 60 * MINUTE_MS; // 1 hour
const RESEND_COOLDOWN_MS = MINUTE_MS;

const invalidLink = () =>
  new ApiError(400, 'This link is invalid or has expired. Please request a new one.', undefined, 'TOKEN_INVALID');

/**
 * Issues a new one-time token. Older unused tokens of the same type stop working,
 * so only the most recent email link is valid.
 */
async function issueToken(userId, type, ttlMs) {
  await AuthToken.deleteMany({ user: userId, type, usedAt: null });
  const token = crypto.randomBytes(32).toString('base64url');
  await AuthToken.create({ user: userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

/** Marks the token used in one atomic step (a link can never be used twice, even by two clicks at once). */
async function consumeToken(token, type) {
  const record = await AuthToken.findOneAndUpdate(
    { tokenHash: hashToken(token), type, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true },
  );
  if (!record) throw invalidLink();
  return record;
}

/* ------------------------------------------------------------------ */
/* Email verification                                                  */
/* ------------------------------------------------------------------ */

/** Path of the link in the email (the frontend page reads the token and calls POST /auth/verify-email). */
export async function verificationPath(userId) {
  const token = await issueToken(userId, AUTH_TOKEN_TYPES.EMAIL_VERIFY, VERIFY_TOKEN_TTL_MS);
  return `/verify-email?token=${token}`;
}

export async function verifyEmail({ token }) {
  const record = await consumeToken(token, AUTH_TOKEN_TYPES.EMAIL_VERIFY);
  const user = await User.findById(record.user);
  if (!user) throw invalidLink();
  if (!user.emailVerifiedAt) {
    user.emailVerifiedAt = new Date();
    await user.save({ validateModifiedOnly: true });
  }
  return user;
}

/** Signed-in user asks for a new link (e.g. the first one expired or went to spam). */
export async function resendVerification(userId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  if (user.emailVerifiedAt) throw ApiError.conflict('Your email is already verified', 'ALREADY_VERIFIED');

  const recent = await AuthToken.exists({
    user: user._id,
    type: AUTH_TOKEN_TYPES.EMAIL_VERIFY,
    createdAt: { $gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
  });
  if (recent) throw new ApiError(429, 'We just sent a link. Please wait a minute before asking again.', undefined, 'TOO_SOON');

  queueEmail(user.email, emailTemplates.verifyEmail({ name: user.name, path: await verificationPath(user._id) }));
}

/* ------------------------------------------------------------------ */
/* Forgot / reset password                                             */
/* ------------------------------------------------------------------ */

/**
 * Always "succeeds" with the same answer, whether or not the email exists,
 * so this endpoint cannot be used to find out who has an account.
 * Blocked accounts get no email.
 */
export async function forgotPassword({ email }) {
  const user = await User.findOne({ email }).select('name email status').lean();
  if (!user || user.status === USER_STATUS.BLOCKED) return;

  const token = await issueToken(user._id, AUTH_TOKEN_TYPES.PASSWORD_RESET, RESET_TOKEN_TTL_MS);
  queueEmail(user.email, emailTemplates.passwordReset({ name: user.name, path: `/reset-password?token=${token}`, minutes: 60 }));
}

/**
 * Sets the new password, then signs the user out everywhere: all refresh sessions are revoked,
 * access tokens issued before now stop working (passwordChangedAt) and live connections are closed.
 * Opening the link proves the user owns the mailbox, so the email counts as verified too.
 */
export async function resetPassword({ token, password }) {
  const record = await consumeToken(token, AUTH_TOKEN_TYPES.PASSWORD_RESET);
  const user = await User.findById(record.user).select('+password');
  if (!user) throw invalidLink();

  user.password = password;
  user.passwordChangedAt = new Date();
  if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
  await user.save();

  await AuthToken.deleteMany({ user: user._id, type: AUTH_TOKEN_TYPES.PASSWORD_RESET, usedAt: null });
  await revokeAllSessions(user._id);
  disconnectUser(user._id);

  queueEmail(user.email, emailTemplates.passwordChanged({ name: user.name }));
  return { role: user.role };
}
