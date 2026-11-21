import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Session } from '../models/session.model.js';
import { ApiError } from '../utils/ApiError.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }
}

/** Creates a new opaque refresh token and stores its hash as a session. */
export async function createSession(userId, meta = {}) {
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  const session = await Session.create({
    user: userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * DAY_MS),
    userAgent: meta.userAgent?.slice(0, 512),
    ip: meta.ip?.slice(0, 64),
  });
  return { refreshToken, session };
}

/**
 * Validates a refresh token and rotates it.
 * If a token that was already rotated is presented again, it was most likely stolen,
 * so every session of that user is revoked.
 */
export async function rotateSession(refreshToken, meta = {}) {
  if (!refreshToken) throw ApiError.unauthorized('Refresh token missing');

  const session = await Session.findOne({ tokenHash: hashToken(refreshToken) });
  if (!session) throw ApiError.unauthorized('Invalid refresh token');

  if (session.revokedAt) {
    const graceMs = env.REFRESH_REUSE_GRACE_SECONDS * 1000;
    const rotatedRecently = session.replacedBy && Date.now() - session.revokedAt.getTime() < graceMs;
    if (rotatedRecently) throw ApiError.unauthorized('Refresh token already used');

    await revokeAllSessions(session.user);
    throw ApiError.unauthorized('Refresh token reuse detected. Please log in again.');
  }

  if (session.expiresAt <= new Date()) {
    throw ApiError.unauthorized('Refresh token expired');
  }

  const { refreshToken: newToken, session: newSession } = await createSession(session.user, meta);

  // Atomic guard: only one concurrent request can rotate the same session.
  const updated = await Session.findOneAndUpdate(
    { _id: session._id, revokedAt: null },
    { revokedAt: new Date(), replacedBy: newSession._id },
  );
  if (!updated) {
    await Session.deleteOne({ _id: newSession._id });
    throw ApiError.unauthorized('Refresh token already used');
  }

  return { userId: session.user, refreshToken: newToken };
}

export async function revokeSession(refreshToken) {
  if (!refreshToken) return;
  await Session.updateOne(
    { tokenHash: hashToken(refreshToken), revokedAt: null },
    { revokedAt: new Date() },
  );
}

export async function revokeAllSessions(userId) {
  await Session.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
}
