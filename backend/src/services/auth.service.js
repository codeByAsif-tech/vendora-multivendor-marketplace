import { User } from '../models/user.model.js';
import { emailTemplates } from '../templates/emails/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ROLES, USER_STATUS } from '../utils/constants.js';
import { verificationPath } from './accountSecurity.service.js';
import { queueEmail } from './email.service.js';
import { disconnectUser } from '../realtime/socket.js';
import {
  createSession,
  revokeAllSessions,
  revokeSession,
  rotateSession,
  signAccessToken,
} from './token.service.js';

async function issueTokens(user, meta) {
  const accessToken = signAccessToken(user);
  const { refreshToken } = await createSession(user._id, meta);
  return { user, accessToken, refreshToken };
}

async function register({ name, email, password, phone }, role, meta) {
  const exists = await User.exists({ email });
  if (exists) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({ name, email, password, phone, role });

  const welcome = role === ROLES.SELLER ? emailTemplates.welcomeSeller : emailTemplates.welcomeCustomer;
  queueEmail(user.email, welcome({ name: user.name, verifyPath: await verificationPath(user._id) }));

  return issueTokens(user, meta);
}

export function registerCustomer(input, meta) {
  return register(input, ROLES.CUSTOMER, meta);
}

/** Creates the seller's user account. The store profile is submitted separately (PUT /seller/profile). */
export function registerSeller(input, meta) {
  return register(input, ROLES.SELLER, meta);
}

/**
 * @param portal optional: 'customer' | 'seller' | 'admin'. When given, the account's role
 * must match so that e.g. a customer cannot sign in through the admin login page.
 */
export async function login({ email, password, portal }, meta) {
  const user = await User.findOne({ email }).select('+password');

  // Same message for unknown email and wrong password: do not reveal which accounts exist.
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (portal && user.role !== portal) {
    throw ApiError.forbidden(`This account cannot sign in to the ${portal} portal`);
  }

  if (user.status === USER_STATUS.BLOCKED) {
    throw ApiError.forbidden('Your account has been blocked. Please contact support.');
  }

  user.lastLoginAt = new Date();
  await user.save({ validateModifiedOnly: true });

  return issueTokens(user, meta);
}

export async function refresh(refreshToken, meta) {
  const { userId, refreshToken: newRefreshToken } = await rotateSession(refreshToken, meta);

  const user = await User.findById(userId);
  if (!user || user.status === USER_STATUS.BLOCKED) {
    await revokeSession(newRefreshToken);
    throw ApiError.unauthorized('Account is not available');
  }

  return { user, accessToken: signAccessToken(user), refreshToken: newRefreshToken };
}

export function logout(refreshToken) {
  return revokeSession(refreshToken);
}

export async function getCurrentUser(userId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

/** Own profile: name and phone ('' removes the phone). */
export async function updateMe(userId, { name, phone }) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone || undefined;
  await user.save({ validateModifiedOnly: true });
  return user;
}

/**
 * Signed-in password change. Needs the current password. Every other device is signed out
 * (sessions revoked, older access tokens rejected, live connections closed); this device gets new tokens.
 */
export async function changePassword(userId, { currentPassword, newPassword }, meta) {
  const user = await User.findById(userId).select('+password');
  if (!user) throw ApiError.notFound('User not found');
  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.field('currentPassword', 'Your current password is not correct');
  }

  user.password = newPassword;
  user.passwordChangedAt = new Date();
  await user.save();

  await revokeAllSessions(user._id);
  disconnectUser(user._id);
  queueEmail(user.email, emailTemplates.passwordChanged({ name: user.name }));

  return issueTokens(user, meta);
}
