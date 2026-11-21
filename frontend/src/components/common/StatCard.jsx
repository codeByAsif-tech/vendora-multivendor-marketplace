import Card from '@/components/ui/Card'
import Skeleton from '@/components/ui/Skeleton'
import { cn } from '@/utils/cn'

const tones = {
  brand: 'bg-brand-50 text-brand-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  sky: 'bg-sky-50 text-sky-600',
  rose: 'bg-rose-50 text-rose-600',
}

export default function StatCard({ label, value, icon: Icon, tone = 'brand', hint, loading }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-24" />
          ) : (
            <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          )}
        </div>
        {Icon && (
          <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', tones[tone])}>
            <Icon className="size-5" />
          </span>
        )}
      </div>
      {hint && <p className="mt-3 text-xs text-slate-500">{hint}</p>}
    </Card>
  )
}
