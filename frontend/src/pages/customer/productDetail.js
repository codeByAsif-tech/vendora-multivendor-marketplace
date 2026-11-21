/** Same rule as the backend: a sale price counts only when it is lower than the price. */
export function hasSale(variant) {
  return variant.salePrice != null && variant.salePrice > 0 && variant.salePrice < variant.price
}
