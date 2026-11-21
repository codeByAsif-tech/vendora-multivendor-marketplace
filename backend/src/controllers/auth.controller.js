import { env } from '../config/env.js';
import * as accountSecurity from '../services/accountSecurity.service.js';
import * as authService from '../services/auth.service.js';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from '../utils/constants.js';
import { sendSuccess } from '../utils/response.js';

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAMESITE,
  path: REFRESH_COOKIE_PATH,
  maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
});

const requestMeta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

function sendAuthResponse(res, { user, accessToken, refreshToken }, status = 200, message) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions());
  return sendSuccess(res, { status, message, data: { user, accessToken } });
}

function clearRefreshCookie(res) {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, options);
}

export async function registerCustomer(req, res) {
  const result = await authService.registerCustomer(req.body, requestMeta(req));
  return sendAuthResponse(res, result, 201, 'Account created successfully');
}

export async function registerSeller(req, res) {
  const result = await authService.registerSeller(req.body, requestMeta(req));
  return sendAuthResponse(res, result, 201, 'Seller account created successfully');
}

export async function login(req, res) {
  const result = await authService.login(req.body, requestMeta(req));
  return sendAuthResponse(res, result, 200, 'Logged in successfully');
}

export async function refresh(req, res) {
  try {
    const result = await authService.refresh(req.cookies?.[REFRESH_COOKIE_NAME], requestMeta(req));
    return sendAuthResponse(res, result);
  } catch (error) {
    clearRefreshCookie(res);
    throw error;
  }
}

export async function logout(req, res) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE_NAME]);
  clearRefreshCookie(res);
  return sendSuccess(res, { message: 'Logged out successfully' });
}

export async function me(req, res) {
  const user = await authService.getCurrentUser(req.user.id);
  return sendSuccess(res, { data: { user } });
}

// ---- Email verification ----
export async function verifyEmail(req, res) {
  const user = await accountSecurity.verifyEmail(req.body);
  return sendSuccess(res, { message: 'Your email is verified. Thank you!', data: { user } });
}

export async function resendVerification(req, res) {
  await accountSecurity.resendVerification(req.user.id);
  return sendSuccess(res, { message: 'We sent a new verification link. Please check your inbox.' });
}

// ---- Forgot / reset password ----
export async function forgotPassword(req, res) {
  await accountSecurity.forgotPassword(req.body);
  // Same answer whether or not the account exists.
  return sendSuccess(res, { message: 'If an account exists for this email, we sent a link to reset the password.' });
}

export async function resetPassword(req, res) {
  const { role } = await accountSecurity.resetPassword(req.body);
  clearRefreshCookie(res);
  // role tells the page which sign-in page to open next (customer / seller / admin).
  return sendSuccess(res, { message: 'Password changed. Please sign in with your new password.', data: { role } });
}

// ---- Own profile ----
export async function updateMe(req, res) {
  const user = await authService.updateMe(req.user.id, req.body);
  return sendSuccess(res, { message: 'Profile updated', data: { user } });
}

export async function changePassword(req, res) {
  const result = await authService.changePassword(req.user.id, req.body, requestMeta(req));
  return sendAuthResponse(res, result, 200, 'Password changed. Other devices were signed out.');
}
