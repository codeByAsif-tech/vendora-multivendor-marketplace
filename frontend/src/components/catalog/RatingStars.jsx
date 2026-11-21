import { Star } from 'lucide-react'
import { cn } from '@/utils/cn'

export default function RatingStars({ value = 0, count = 0, size = 'sm', className }) {
  if (!count) return <span className={cn('text-xs text-slate-400', className)}>No reviews yet</span>

  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-label={`Rated ${value.toFixed(1)} out of 5`}>
      <span className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(size === 'lg' ? 'size-5' : 'size-3.5', i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300')}
          />
        ))}
      </span>
      <span className="text-xs text-slate-500">({count})</span>
    </span>
  )
}
