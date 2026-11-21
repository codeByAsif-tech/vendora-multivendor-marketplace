import { Minus, Plus } from 'lucide-react'
import { cn } from '@/utils/cn'

export default function QuantityStepper({ value, min = 1, max = 10, onChange, disabled = false, size = 'md' }) {
  const box = size === 'sm' ? 'size-8' : 'size-11'
  return (
    <div className={cn('inline-flex items-center rounded-lg border border-slate-300 bg-white', disabled && 'opacity-60')}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        className={cn(box, 'flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-40')}
        aria-label="Decrease quantity"
      >
        <Minus className="size-4" />
      </button>
      <span className="w-9 text-center text-sm font-semibold text-slate-900" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        className={cn(box, 'flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-40')}
        aria-label="Increase quantity"
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}
