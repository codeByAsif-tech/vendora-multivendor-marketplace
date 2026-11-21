// The API stores and returns money as integer paise (₹1 = 100 paise).

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatPrice(paise) {
  if (paise == null || Number.isNaN(paise)) return '—'
  return inr.format(paise / 100)
}

export function formatPriceRange(min, max) {
  if (min == null) return '—'
  return min === max || max == null ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`
}

/** "799.5" → 79950. Empty → null. */
export function rupeesToPaise(value) {
  if (value === '' || value == null) return null
  return Math.round(Number(value) * 100)
}

/** 79950 → "799.50", 79900 → "799". null → "". */
export function paiseToRupees(paise) {
  if (paise == null) return ''
  const rupees = paise / 100
  return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2)
}

export const RUPEE_PATTERN = /^\d+(\.\d{1,2})?$/
