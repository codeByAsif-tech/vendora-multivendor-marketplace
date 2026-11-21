import { cn } from '@/utils/cn'
import { RANGE_OPTIONS } from './chartFormat'

/** Segmented control for the report period. */
export default function RangePicker({ value, onChange, className }) {
  return (
    <div role="radiogroup" aria-label="Period" className={cn('inline-flex rounded-lg border border-slate-200 bg-white p-0.5', className)}>
      {RANGE_OPTIONS.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition',
              selected ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
