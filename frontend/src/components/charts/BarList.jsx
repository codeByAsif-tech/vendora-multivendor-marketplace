import { Link } from 'react-router-dom'
import Skeleton from '@/components/ui/Skeleton'
import { cn } from '@/utils/cn'

/**
 * Ranked horizontal bars (top products, top sellers, order status...).
 * One series, so one colour; names and values stay in text ink, the bar only shows size.
 * rows: [{ id, label, value, display, sub?, to?, tone? }]  — tone is a bar class for status rows
 */
export default function BarList({ rows, loading = false, emptyText = 'Nothing to show yet', count = 5 }) {
  if (loading) {
    return (
      <div className="space-y-4 p-5">
        {Array.from({ length: count }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  if (!rows?.length || rows.every((r) => !r.value)) {
    return <p className="px-5 py-10 text-center text-sm text-slate-500">{emptyText}</p>
  }

  const max = Math.max(...rows.map((r) => r.value))

  return (
    <ul className="space-y-3.5 p-5">
      {rows.map((row) => {
        const width = max ? Math.max(2, (row.value / max) * 100) : 0
        const label = row.to ? (
          <Link to={row.to} className="truncate font-medium text-slate-900 hover:text-brand-700">
            {row.label}
          </Link>
        ) : (
          <span className="truncate font-medium text-slate-900">{row.label}</span>
        )
        return (
          <li key={row.id ?? row.label} title={`${row.label}: ${row.display}`}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-baseline gap-2">
                {label}
                {row.sub && <span className="shrink-0 text-xs text-slate-500">{row.sub}</span>}
              </span>
              <span className="shrink-0 font-semibold text-slate-900 tabular-nums">{row.display}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className={cn('h-2 rounded-full', row.tone ?? 'bg-brand-600')} style={{ width: `${width}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
