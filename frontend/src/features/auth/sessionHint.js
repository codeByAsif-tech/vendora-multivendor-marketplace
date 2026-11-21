/**
 * A non-secret hint that this browser probably has a refresh cookie.
 * The refresh cookie itself is httpOnly (JavaScript cannot see it), so without this hint
 * every guest page load would call /auth/refresh and get a harmless but noisy 401.
 * This is only a hint, not a credential: the server still decides with the real cookie.
 */
const KEY = 'hasSession'

export function markSession() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // storage blocked: nothing to do
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // storage blocked: nothing to do
  }
}

export function mightHaveSession() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true // storage blocked: just try the refresh
  }
}
