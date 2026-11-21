export function sendSuccess(res, { status = 200, data = null, message } = {}) {
  const body = { success: true };
  if (message) body.message = message;
  body.data = data;
  return res.status(status).json(body);
}
