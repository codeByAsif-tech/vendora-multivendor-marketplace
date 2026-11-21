/** 'out' | 'low' | 'in' (same rule as the backend's productPricing.stockState). */
export function stockState({ stock, lowStockThreshold = 0 }) {
  if (stock <= 0) return 'out'
  if (stock <= lowStockThreshold) return 'low'
  return 'in'
}

export function variantLabel(attributes = []) {
  return attributes.length ? attributes.map((a) => a.value).join(' / ') : 'Default'
}
