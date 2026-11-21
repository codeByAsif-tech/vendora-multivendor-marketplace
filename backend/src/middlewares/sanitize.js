/**
 * NoSQL injection protection.
 * Removes keys that start with "$" or contain "." from req.body and req.params, so payloads like
 * { "email": { "$gt": "" } } can never reach a Mongo query as operators.
 *
 * (express-mongo-sanitize is not compatible with Express 5, whose req.query is a getter.
 * Express 5's default "simple" query parser does not build nested objects, so query strings
 * like ?email[$gt]= stay plain strings. Zod validation adds a second layer on every route.)
 */
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete value[key];
      } else {
        value[key] = clean(value[key]);
      }
    }
  }
  return value;
}

export function sanitizeRequest(req, _res, next) {
  if (req.body) clean(req.body);
  if (req.params) clean(req.params);
  next();
}
