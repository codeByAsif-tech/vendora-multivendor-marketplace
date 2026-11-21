import { ApiError } from '../utils/ApiError.js';

function formatIssues(issues) {
  return issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Validates request parts against Zod schemas.
 * Parsed (trimmed / coerced / stripped) values replace req.body and req.params.
 * Express 5 makes req.query read-only, so the parsed query is exposed as req.validatedQuery.
 *
 * Usage: validate({ body: schema, query: schema, params: schema })
 */
export function validate(schemas) {
  return function validateRequest(req, _res, next) {
    const errors = [];

    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        errors.push(...formatIssues(result.error.issues));
        continue;
      }

      if (part === 'query') req.validatedQuery = result.data;
      else req[part] = result.data;
    }

    if (errors.length) throw ApiError.badRequest('Validation failed', errors);
    next();
  };
}
