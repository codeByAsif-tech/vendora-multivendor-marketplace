/**
 * Password rules for new passwords (sign-up, reset, change). Must match
 * backend/src/validators/auth.validator.js. Signing in does NOT check these, so older passwords keep working.
 */
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'One capital letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'number', label: 'One number (0–9)', test: (p) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character (! @ # $ …)', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export const PASSWORD_MAX = 72 // bcrypt only uses the first 72 bytes

/** First rule the password breaks, as a message, or null if it is fine. */
export function passwordProblem(password) {
  if (password.length > PASSWORD_MAX) return `At most ${PASSWORD_MAX} characters`
  const broken = PASSWORD_RULES.find((rule) => !rule.test(password))
  return broken ? `Needs ${broken.label.charAt(0).toLowerCase()}${broken.label.slice(1)}` : null
}
