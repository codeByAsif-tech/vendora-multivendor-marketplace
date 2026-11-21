import { z } from 'zod'
import { paiseToRupees, RUPEE_PATTERN, rupeesToPaise } from '@/utils/money'

export const MAX_IMAGES = 8
export const MAX_VARIANTS = 50
export const MAX_OPTIONS = 3

// Form values are strings (what inputs give us). They are converted to paise / numbers in toPayload().
const money = z
  .string()
  .trim()
  .regex(RUPEE_PATTERN, 'Enter an amount like 499 or 499.50')
  .refine((v) => Number(v) >= 1, 'Minimum is ₹1')

const optionalMoney = z
  .string()
  .trim()
  .refine((v) => v === '' || RUPEE_PATTERN.test(v), 'Enter an amount like 399 or 399.50')

const wholeNumber = (label) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `${label} must be a whole number`)
    .refine((v) => Number(v) <= 1_000_000, `${label} is too large`)

const variantSchema = z
  .object({
    _id: z.string().optional(),
    sku: z
      .string()
      .trim()
      .min(1, 'SKU is required')
      .max(40, 'Max 40 characters')
      .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Use letters, numbers, - and _'),
    attributes: z.array(z.object({ name: z.string(), value: z.string() })),
    price: money,
    salePrice: optionalMoney,
    stock: wholeNumber('Stock'),
    lowStockThreshold: wholeNumber('Threshold'),
    isActive: z.boolean(),
  })
  .refine((v) => v.salePrice === '' || !RUPEE_PATTERN.test(v.price) || Number(v.salePrice) < Number(v.price), {
    path: ['salePrice'],
    message: 'Must be lower than the price',
  })

export const productFormSchema = z
  .object({
    name: z.string().trim().min(3, 'Name must be at least 3 characters').max(150),
    brand: z.string().trim().max(60),
    category: z.string().min(1, 'Choose a category'),
    description: z.string().trim().min(20, 'Write at least 20 characters').max(5000),
    highlights: z.array(z.object({ value: z.string().trim().max(200, 'Max 200 characters') })).max(8),
    tags: z.string().trim(),
    images: z
      .array(z.object({ url: z.string(), publicId: z.string() }))
      .min(1, 'Add at least one image')
      .max(MAX_IMAGES),
    hasVariants: z.boolean(),
    options: z.array(z.object({ name: z.string().trim().max(30), values: z.string() })).max(MAX_OPTIONS),
    variants: z.array(variantSchema).min(1).max(MAX_VARIANTS, `Up to ${MAX_VARIANTS} variants`),
    specifications: z
      .array(z.object({ key: z.string().trim().max(50), value: z.string().trim().max(200) }))
      .max(30),
    isActive: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: 'custom', path, message })

    const seen = new Set()
    data.variants.forEach((variant, i) => {
      const sku = variant.sku.trim().toUpperCase()
      if (seen.has(sku)) issue(['variants', i, 'sku'], 'Duplicate SKU')
      seen.add(sku)
    })

    if (data.hasVariants && data.variants.some((v) => v.attributes.length === 0)) {
      issue(['variants'], 'Define your options and click "Generate variants"')
    }

    parseTags(data.tags).forEach((tag) => {
      if (tag.length > 30) issue(['tags'], `"${tag.slice(0, 20)}…" is longer than 30 characters`)
    })
    if (parseTags(data.tags).length > 15) issue(['tags'], 'Up to 15 tags')

    data.specifications.forEach((spec, i) => {
      if (Boolean(spec.key) !== Boolean(spec.value)) {
        issue(['specifications', i, spec.key ? 'value' : 'key'], 'Fill in both fields or remove the row')
      }
    })
  })

export function parseTags(text) {
  return [...new Set(text.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))]
}

export const emptyVariant = () => ({
  sku: '',
  attributes: [],
  price: '',
  salePrice: '',
  stock: '0',
  lowStockThreshold: '5',
  isActive: true,
})

export const emptyProductForm = () => ({
  name: '',
  brand: '',
  category: '',
  description: '',
  highlights: [],
  tags: '',
  images: [],
  hasVariants: false,
  options: [],
  variants: [emptyVariant()],
  specifications: [],
  isActive: true,
})

/** API product → form values (paise → rupee strings). */
export function toFormValues(product) {
  const hasVariants = product.variants.length > 1 || product.variants.some((v) => v.attributes?.length)
  return {
    name: product.name,
    brand: product.brand ?? '',
    category: product.category?._id ?? product.category ?? '',
    description: product.description,
    highlights: (product.highlights ?? []).map((value) => ({ value })),
    tags: (product.tags ?? []).join(', '),
    images: product.images.map(({ url, publicId }) => ({ url, publicId })),
    hasVariants,
    options: hasVariants
      ? (product.variantOptions ?? []).map((o) => ({ name: o.name, values: o.values.join(', ') }))
      : [],
    variants: product.variants.map((v) => ({
      _id: v._id,
      sku: v.sku,
      attributes: (v.attributes ?? []).map(({ name, value }) => ({ name, value })),
      price: paiseToRupees(v.price),
      salePrice: paiseToRupees(v.salePrice),
      stock: String(v.stock),
      lowStockThreshold: String(v.lowStockThreshold ?? 5),
      isActive: v.isActive !== false,
    })),
    specifications: (product.specifications ?? []).map(({ key, value }) => ({ key, value })),
    isActive: product.isActive,
  }
}

/** Form values → API body (rupees → paise, strings → numbers). */
export function toPayload(values) {
  return {
    name: values.name.trim(),
    brand: values.brand.trim(),
    category: values.category,
    description: values.description.trim(),
    highlights: values.highlights.map((h) => h.value.trim()).filter(Boolean),
    tags: parseTags(values.tags),
    images: values.images,
    variants: values.variants.map((v) => ({
      ...(v._id ? { _id: v._id } : {}),
      sku: v.sku.trim().toUpperCase(),
      attributes: values.hasVariants ? v.attributes : [],
      price: rupeesToPaise(v.price),
      salePrice: v.salePrice ? rupeesToPaise(v.salePrice) : null,
      stock: Number(v.stock),
      lowStockThreshold: Number(v.lowStockThreshold || 0),
      isActive: values.hasVariants ? v.isActive : true,
    })),
    specifications: values.specifications
      .filter((s) => s.key.trim() && s.value.trim())
      .map((s) => ({ key: s.key.trim(), value: s.value.trim() })),
    isActive: values.isActive,
  }
}

/** [{ name: 'Size', values: 'S, M' }, { name: 'Color', values: 'Red' }] → [[Size=S, Color=Red], [Size=M, Color=Red]] */
export function buildCombinations(options) {
  const seenNames = new Set()
  const clean = options
    .map((o) => ({
      name: o.name.trim(),
      values: [...new Map(o.values.split(',').map((v) => v.trim()).filter(Boolean).map((v) => [v.toLowerCase(), v])).values()],
    }))
    .filter((o) => {
      const key = o.name.toLowerCase()
      if (!o.name || !o.values.length || seenNames.has(key)) return false
      seenNames.add(key)
      return true
    })

  if (!clean.length) return []
  return clean.reduce(
    (combos, option) => combos.flatMap((attrs) => option.values.map((value) => [...attrs, { name: option.name, value }])),
    [[]],
  )
}

const comboKey = (attributes) =>
  attributes
    .map((a) => `${a.name.toLowerCase()}=${a.value.toLowerCase()}`)
    .sort()
    .join('|')

export function suggestSku(base, attributes) {
  return [base || 'SKU', ...attributes.map((a) => a.value)]
    .join('-')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

/** New variant rows for the combinations, keeping existing rows (and their ids/prices/stock) that still match. */
export function mergeVariants(combinations, existing, baseSku) {
  const byKey = new Map(existing.filter((v) => v.attributes.length).map((v) => [comboKey(v.attributes), v]))
  const template = existing[0] ?? emptyVariant()

  return combinations.map((attributes) => {
    const match = byKey.get(comboKey(attributes))
    if (match) return { ...match, attributes }
    return {
      ...emptyVariant(),
      sku: suggestSku(baseSku, attributes),
      attributes,
      price: template.price,
      salePrice: template.salePrice,
      lowStockThreshold: template.lowStockThreshold || '5',
    }
  })
}

export function skuBaseFromName(name) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, '').slice(0, 4))
    .filter(Boolean)
    .join('-')
    .toUpperCase()
}
