import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { MAX_IMAGE_BYTES } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: [413, `Each image must be ${MAX_IMAGE_BYTES / 1024 / 1024} MB or smaller`],
  LIMIT_FILE_COUNT: [400, 'Too many files'],
  LIMIT_UNEXPECTED_FILE: [400, 'Too many files, or an unexpected file field'],
  LIMIT_PART_COUNT: [400, 'Too many form fields'],
};

function normalizeError(err) {
  if (err instanceof ApiError) return err;

  // Malformed JSON body
  if (err.type === 'entity.parse.failed') return ApiError.badRequest('Malformed JSON body');
  if (err.type === 'entity.too.large') return new ApiError(413, 'Request body too large');

  // File upload limits
  if (err.name === 'MulterError') {
    const [status, message] = MULTER_MESSAGES[err.code] || [400, 'Invalid file upload'];
    return new ApiError(status, message);
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return ApiError.badRequest('Validation failed', errors);
  }

  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${err.path}`);
  }

  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return ApiError.conflict(`A record with this ${field} already exists`);
  }

  return null;
}

// Express recognises error handlers by their 4 arguments, so `_next` must stay.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const apiError = normalizeError(err);

  if (!apiError) {
    logger.error({ err, path: req.originalUrl }, 'Unhandled error');
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
      ...(env.isProduction ? {} : { stack: err.stack }),
    });
  }

  if (apiError.statusCode >= 500) logger.error({ err }, apiError.message);

  return res.status(apiError.statusCode).json({
    success: false,
    message: apiError.message,
    ...(apiError.code ? { code: apiError.code } : {}),
    ...(apiError.errors ? { errors: apiError.errors } : {}),
  });
}
