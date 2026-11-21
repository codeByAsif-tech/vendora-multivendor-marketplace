/**
 * Pure helpers for product prices and stock. All amounts are integers in paise (₹1 = 100).
 * Used by the Product model to keep derived fields (minPrice, totalStock, ...) in sync.
 */

export function hasValidSale(variant) {
  return variant.salePrice != null && variant.salePrice > 0 && variant.salePrice < variant.price;
}

/** What the customer pays for one unit. */
export function effectivePrice(variant) {
  return hasValidSale(variant) ? variant.salePrice : variant.price;
}

export function discountPercent(variant) {
  if (!hasValidSale(variant)) return 0;
  return Math.round((1 - variant.salePrice / variant.price) * 100);
}

/** 'out' | 'low' | 'in' */
export function stockState(variant) {
  if (variant.stock <= 0) return 'out';
  if (variant.stock <= (variant.lowStockThreshold ?? 0)) return 'low';
  return 'in';
}

/**
 * Product-level summary used for listing, sorting and filtering.
 * Inactive variants do not count, unless every variant is inactive (prices still need a value).
 */
export function summarizeVariants(variants = []) {
  if (!variants.length) {
    return { minPrice: 0, maxPrice: 0, compareAtPrice: null, totalStock: 0, maxDiscount: 0 };
  }

  const active = variants.filter((v) => v.isActive !== false);
  const pool = active.length ? active : variants;
  const prices = pool.map(effectivePrice);
  const minPrice = Math.min(...prices);
  const cheapest = pool[prices.indexOf(minPrice)];

  return {
    minPrice,
    maxPrice: Math.max(...prices),
    // Regular price of the cheapest variant when it is on sale (shown struck through on product cards).
    compareAtPrice: hasValidSale(cheapest) ? cheapest.price : null,
    totalStock: active.reduce((sum, v) => sum + (v.stock || 0), 0),
    maxDiscount: Math.max(0, ...pool.map(discountPercent)),
  };
}

/**
 * Builds the option list for the storefront variant picker from the variants' attributes.
 * [{ attributes: [{name:'Size', value:'M'}] }, ...] → [{ name: 'Size', values: ['M', 'L'] }]
 */
export function deriveOptions(variants = []) {
  const options = new Map();
  for (const variant of variants) {
    for (const { name, value } of variant.attributes || []) {
      const key = name.toLowerCase();
      if (!options.has(key)) options.set(key, { name, values: [] });
      const option = options.get(key);
      if (!option.values.some((v) => v.toLowerCase() === value.toLowerCase())) option.values.push(value);
    }
  }
  return [...options.values()];
}
