import { User } from '../models/user.model.js';
import { verifyAccessToken } from '../services/token.service.js';
import { ApiError } from '../utils/ApiError.js';
import { USER_STATUS } from '../utils/constants.js';

/**
 * Requires a valid `Authorization: Bearer <accessToken>` header.
 * The user is re-loaded on every request so blocked users and role changes take effect immediately.
 */
/** JWT `iat` is in whole seconds, so allow one second of rounding. */
export function issuedBeforePasswordChange(payload, user) {
  return Boolean(user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000);
}

export async function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Authentication required');
  }

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub).lean();

  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (issuedBeforePasswordChange(payload, user)) {
    throw ApiError.unauthorized('Your password was changed. Please sign in again.');
  }
  if (user.status === USER_STATUS.BLOCKED) {
    throw ApiError.forbidden('Your account has been blocked. Please contact support.');
  }

  req.user = {
    id: user._id.toString(),
    role: user.role,
    email: user.email,
    name: user.name,
    emailVerified: Boolean(user.emailVerifiedAt),
  };
  next();
}
