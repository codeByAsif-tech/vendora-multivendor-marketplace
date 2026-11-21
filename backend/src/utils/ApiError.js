/**
 * Operational error with an HTTP status.
 * `errors` = field-level details ([{ field, message }]); `code` = machine-readable reason the
 * frontend can branch on (e.g. STORE_PENDING).
 */
export class ApiError extends Error {
  constructor(statusCode, message, errors = undefined, code = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
    this.isOperational = true;
  }

  static badRequest(message = 'Bad request', errors) {
    return new ApiError(400, message, errors);
  }

  /** 400 with a single field error, shaped like Zod validation errors. */
  static field(field, message) {
    return new ApiError(400, 'Validation failed', [{ field, message }]);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have permission to perform this action', code) {
    return new ApiError(403, message, undefined, code);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Resource already exists', code) {
    return new ApiError(409, message, undefined, code);
  }
}
