import { ApiError } from '../utils/ApiError.js';

/** Use after `authenticate`. Example: router.get('/', authenticate, authorize('admin'), handler) */
export function authorize(...allowedRoles) {
  return function authorizeRole(req, _res, next) {
    if (!req.user) throw ApiError.unauthorized();
    if (!allowedRoles.includes(req.user.role)) throw ApiError.forbidden();
    next();
  };
}
