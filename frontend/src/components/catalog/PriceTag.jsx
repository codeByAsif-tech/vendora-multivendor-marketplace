import { cn } from '@/utils/cn'
import { formatPrice } from '@/utils/money'

/** Selling price, struck-through regular price and % off. Amounts in paise. */
export default function PriceTag({ price, compareAt, size = 'md', className }) {
  const onSale = compareAt != null && compareAt > price
  const percent = onSale ? Math.round((1 - price / compareAt) * 100) : 0

  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2', className)}>
      <span className={cn('font-bold text-slate-900', size === 'lg' ? 'text-3xl' : 'text-base')}>{formatPrice(price)}</span>
      {onSale && (
        <>
          <span className={cn('text-slate-400 line-through', size === 'lg' ? 'text-lg' : 'text-sm')}>
            {formatPrice(compareAt)}
          </span>
          <span className={cn('font-semibold text-emerald-600', size === 'lg' ? 'text-base' : 'text-sm')}>{percent}% off</span>
        </>
      )}
    </div>
  )
}
