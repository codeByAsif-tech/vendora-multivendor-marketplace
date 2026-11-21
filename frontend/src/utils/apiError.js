/** Extracts a readable message from an RTK Query error. */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback
  if (error.status === 'FETCH_ERROR') return 'Cannot reach the server. Check your connection.'
  return error.data?.message || error.error || fallback
}

/** Returns { fieldName: message } from a 400 validation response. */
export function getFieldErrors(error) {
  const list = error?.data?.errors
  if (!Array.isArray(list)) return {}
  return Object.fromEntries(list.map((e) => [e.field, e.message]))
}
