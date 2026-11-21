import { useState } from 'react'
import { Plus, Sparkles, Trash2, X } from 'lucide-react'
import { useFieldArray, useWatch } from 'react-hook-form'
import toast from 'react-hot-toast'
import FormSection from '@/components/common/FormSection'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Switch from '@/components/ui/Switch'
import { cn } from '@/utils/cn'
import {
  buildCombinations,
  emptyVariant,
  MAX_OPTIONS,
  MAX_VARIANTS,
  mergeVariants,
  skuBaseFromName,
} from './productForm'

const cellInput = (error) =>
  cn(
    'h-9 w-full min-w-20 rounded-md border bg-white px-2 text-sm focus:ring-2 focus:outline-none',
    error ? 'border-rose-400 focus:ring-rose-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100',
  )

function firstVariantError(errors) {
  if (!errors) return null
  if (errors.message) return errors.message
  if (errors.root?.message) return errors.root.message
  if (Array.isArray(errors)) {
    for (const row of errors) {
      if (!row) continue
      const field = Object.values(row).find((value) => value?.message)
      if (field) return field.message
    }
  }
  return null
}

/** Pricing & inventory: one simple variant, or options (Size, Color…) → generated variant table. */
export default function VariantsSection({ form }) {
  const {
    control,
    register,
    setValue,
    getValues,
    clearErrors,
    formState: { errors },
  } = form

  const { fields: optionFields, append: appendOption, remove: removeOption, replace: replaceOptions } =
    useFieldArray({ control, name: 'options' })
  const { fields: variantFields, remove: removeVariant, replace: replaceVariants } = useFieldArray({
    control,
    name: 'variants',
  })
  const hasVariants = useWatch({ control, name: 'hasVariants' })
  const [bulk, setBulk] = useState({ price: '', salePrice: '', stock: '' })

  function toggleVariants(enabled) {
    if (enabled) {
      setValue('hasVariants', true, { shouldDirty: true })
      if (!getValues('options').length) replaceOptions([{ name: 'Size', values: '' }])
    } else {
      const first = getValues('variants.0') ?? emptyVariant()
      replaceVariants([{ ...first, attributes: [], isActive: true }])
      replaceOptions([])
      setValue('hasVariants', false, { shouldDirty: true })
      clearErrors('variants')
    }
  }

  function generateVariants() {
    const combinations = buildCombinations(getValues('options'))
    if (!combinations.length) {
      toast.error('Add at least one option with a name and values')
      return
    }
    if (combinations.length > MAX_VARIANTS) {
      toast.error(`That makes ${combinations.length} variants. The limit is ${MAX_VARIANTS}.`)
      return
    }
    const base = skuBaseFromName(getValues('name')) || 'SKU'
    replaceVariants(mergeVariants(combinations, getValues('variants'), base))
    clearErrors('variants')
    toast.success(`${combinations.length} variant${combinations.length === 1 ? '' : 's'} ready`)
  }

  function applyToAll() {
    const count = getValues('variants').length
    for (let i = 0; i < count; i += 1) {
      for (const field of ['price', 'salePrice', 'stock']) {
        if (bulk[field] !== '') setValue(`variants.${i}.${field}`, bulk[field], { shouldDirty: true, shouldValidate: true })
      }
    }
    setBulk({ price: '', salePrice: '', stock: '' })
  }

  const variantErrors = errors.variants
  const tableError = firstVariantError(variantErrors)

  return (
    <FormSection
      title="Pricing & inventory"
      description="Prices in ₹. Use variants when the product comes in sizes, colours or other options."
      actions={<Switch checked={hasVariants} onChange={toggleVariants} label="Has variants" />}
    >
      {!hasVariants ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="SKU" placeholder="TSHIRT-001" error={errors.variants?.[0]?.sku?.message} {...register('variants.0.sku')} />
          <Input label="Price (₹)" inputMode="decimal" placeholder="999" error={errors.variants?.[0]?.price?.message} {...register('variants.0.price')} />
          <Input
            label="Sale price (₹, optional)"
            inputMode="decimal"
            placeholder="799"
            error={errors.variants?.[0]?.salePrice?.message}
            {...register('variants.0.salePrice')}
          />
          <Input label="Stock" inputMode="numeric" error={errors.variants?.[0]?.stock?.message} {...register('variants.0.stock')} />
          <Input
            label="Low-stock alert at"
            inputMode="numeric"
            hint="Flag the SKU when stock drops to this number."
            error={errors.variants?.[0]?.lowStockThreshold?.message}
            {...register('variants.0.lowStockThreshold')}
          />
        </div>
      ) : (
        <>
          {/* Options */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Options</p>
            {optionFields.map((field, index) => (
              <div key={field.id} className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
                <Input placeholder="Option name, e.g. Size" {...register(`options.${index}.name`)} />
                <Input placeholder="Values, comma separated: S, M, L, XL" {...register(`options.${index}.values`)} />
                <Button variant="ghost" size="icon" onClick={() => removeOption(index)} aria-label="Remove option">
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-3">
              {optionFields.length < MAX_OPTIONS && (
                <Button variant="outline" size="sm" onClick={() => appendOption({ name: '', values: '' })}>
                  <Plus className="size-4" /> Add option
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={generateVariants}>
                <Sparkles className="size-4" /> Generate variants
              </Button>
            </div>
          </div>

          {/* Bulk edit */}
          {variantFields.length > 1 && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3">
              <p className="w-full text-xs font-semibold tracking-wide text-slate-500 uppercase">Set for all variants</p>
              {[
                ['price', 'Price ₹'],
                ['salePrice', 'Sale ₹'],
                ['stock', 'Stock'],
              ].map(([field, label]) => (
                <input
                  key={field}
                  value={bulk[field]}
                  onChange={(e) => setBulk((prev) => ({ ...prev, [field]: e.target.value }))}
                  placeholder={label}
                  inputMode="decimal"
                  className={cn(cellInput(false), 'w-28')}
                />
              ))}
              <Button size="sm" variant="outline" onClick={applyToAll}>
                Apply
              </Button>
            </div>
          )}

          {/* Variant table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <th className="px-3 py-2">Variant</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Price ₹</th>
                  <th className="px-3 py-2">Sale ₹</th>
                  <th className="px-3 py-2">Stock</th>
                  <th className="px-3 py-2 text-center">Active</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {variantFields.map((field, index) => {
                  const rowErrors = variantErrors?.[index]
                  return (
                    <tr key={field.id}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {field.attributes?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {field.attributes.map((a) => (
                              <span key={a.name} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                                {a.value}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600">Not generated</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className={cn(cellInput(rowErrors?.sku), 'min-w-36')}
                          title={rowErrors?.sku?.message}
                          {...register(`variants.${index}.sku`)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input inputMode="decimal" className={cellInput(rowErrors?.price)} title={rowErrors?.price?.message} {...register(`variants.${index}.price`)} />
                      </td>
                      <td className="px-3 py-2">
                        <input inputMode="decimal" className={cellInput(rowErrors?.salePrice)} title={rowErrors?.salePrice?.message} {...register(`variants.${index}.salePrice`)} />
                      </td>
                      <td className="px-3 py-2">
                        <input inputMode="numeric" className={cellInput(rowErrors?.stock)} title={rowErrors?.stock?.message} {...register(`variants.${index}.stock`)} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" className="size-4 accent-brand-600" {...register(`variants.${index}.isActive`)} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeVariant(index)}
                          disabled={variantFields.length === 1}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                          aria-label="Remove variant"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {tableError && <p className="text-xs font-medium text-rose-600">{tableError}</p>}
        </>
      )}
    </FormSection>
  )
}
