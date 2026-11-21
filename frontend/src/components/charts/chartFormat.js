/** Short Indian money labels for axes: ₹950, ₹12.5k, ₹3.4L, ₹1.2Cr (input in paise). */
export function compactPrice(paise) {
  const rupees = (paise ?? 0) / 100
  const trim = (n) => (n >= 100 ? Math.round(n) : Number(n.toFixed(1))).toLocaleString('en-IN')
  if (rupees >= 1e7) return `₹${trim(rupees / 1e7)}Cr`
  if (rupees >= 1e5) return `₹${trim(rupees / 1e5)}L`
  if (rupees >= 1e3) return `₹${trim(rupees / 1e3)}k`
  return `₹${Math.round(rupees)}`
}

const dayFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const longDayFormat = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const monthFormat = new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' })
const longMonthFormat = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Bucket keys from the API: "2026-11-20" (day) or "2026-11" (month). Formatted as calendar dates, no timezone shift. */
export function bucketLabel(key, bucket, long = false) {
  const date = new Date(bucket === 'month' ? `${key}-01T00:00:00Z` : `${key}T00:00:00Z`)
  if (bucket === 'month') return (long ? longMonthFormat : monthFormat).format(date)
  return (long ? longDayFormat : dayFormat).format(date)
}

/** Rounds an axis maximum up to 1, 2 or 5 × 10ⁿ so gridlines land on clean numbers. */
export function niceMax(value) {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const scaled = value / power
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return step * power
}

/** "▲ 12% vs previous 30 days" style comparison. null when there is nothing to compare with. */
export function changeVsPrevious(current, previous) {
  if (!previous) return current ? { text: 'New this period', direction: 'up' } : null
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return { text: 'Same as before', direction: 'flat' }
  return { text: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%`, direction: pct > 0 ? 'up' : 'down' }
}

export const RANGE_OPTIONS = [
  { value: '7d', label: '7 days', long: 'last 7 days' },
  { value: '30d', label: '30 days', long: 'last 30 days' },
  { value: '90d', label: '90 days', long: 'last 90 days' },
  { value: '12m', label: '12 months', long: 'last 12 months' },
]

export const rangeLabel = (value) => RANGE_OPTIONS.find((o) => o.value === value)?.long ?? ''
