import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Blocks the action until the user has verified their email, when REQUIRE_VERIFIED_EMAIL=true.
 * Use after `authenticate`. Off by default so existing accounts keep working.
 */
export function requireVerifiedEmail(req, _res, next) {
  if (env.REQUIRE_VERIFIED_EMAIL && !req.user?.emailVerified) {
    throw ApiError.forbidden('Please verify your email address first. Check your inbox or ask for a new link.', 'EMAIL_NOT_VERIFIED');
  }
  next();
}
