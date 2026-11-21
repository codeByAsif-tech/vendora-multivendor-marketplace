/**
 * Helpers for the product page variant picker.
 * selection = { Size: 'M', Color: 'Black' }
 */

const hasValue = (variant, name, value) => variant.attributes.some((a) => a.name === name && a.value === value)

export const toSelection = (variant) => Object.fromEntries((variant?.attributes ?? []).map((a) => [a.name, a.value]))

/** Variant matching every attribute of the selection (a simple product's only variant matches {}). */
export function findVariant(variants, selection) {
  return variants.find((v) => v.attributes.every((a) => selection[a.name] === a.value)) ?? null
}

/** Start with the first in-stock variant. */
export function initialSelection(variants) {
  return toSelection(variants.find((v) => v.stock > 0) ?? variants[0])
}

/**
 * State of an option button given the other selected options:
 * 'available' | 'soldout' (exists, no stock) | 'switch' (exists with other options) | 'none'
 */
export function valueState(variants, selection, name, value) {
  const match = findVariant(variants, { ...selection, [name]: value })
  if (match) return match.stock > 0 ? 'available' : 'soldout'
  return variants.some((v) => hasValue(v, name, value)) ? 'switch' : 'none'
}

/** Picking a value that does not combine with the current selection jumps to the best variant that has it. */
export function selectValue(variants, selection, name, value) {
  const candidate = { ...selection, [name]: value }
  if (findVariant(variants, candidate)) return candidate
  const withValue = variants.filter((v) => hasValue(v, name, value))
  const best = withValue.find((v) => v.stock > 0) ?? withValue[0]
  return best ? toSelection(best) : candidate
}
