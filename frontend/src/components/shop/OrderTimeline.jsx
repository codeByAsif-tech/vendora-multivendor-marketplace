import { Check, XCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatDateTime } from '@/utils/format'
import { ORDER_STATUS_META, ORDER_STEPS } from './orderStatusMeta'

/** Horizontal progress (Confirmed → Delivered) built from the shipment's status history. */
export default function OrderTimeline({
  status,
  history = [],
  pendingMessage = 'We are verifying your payment. Your order is confirmed as soon as it is verified.',
}) {
  if (status === 'cancelled') {
    const event = [...history].reverse().find((e) => e.status === 'cancelled')
    return (
      <div className="flex items-start gap-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
        <XCircle className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold">Cancelled {event && `on ${formatDateTime(event.at)}`}</p>
          {event?.note && <p className="mt-0.5">{event.note}</p>}
        </div>
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{pendingMessage}</p>
    )
  }

  const currentIndex = ORDER_STEPS.indexOf(status)
  const timeOf = (step) => history.find((e) => e.status === step)?.at

  return (
    <ol className="grid grid-cols-5 gap-1">
      {ORDER_STEPS.map((step, index) => {
        const done = index <= currentIndex
        const at = timeOf(step)
        return (
          <li key={step} className="relative flex flex-col items-center text-center">
            {index > 0 && (
              <span
                className={cn('absolute top-3.5 right-1/2 h-0.5 w-full', index <= currentIndex ? 'bg-emerald-500' : 'bg-slate-200')}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                'relative z-10 flex size-7 items-center justify-center rounded-full border-2',
                done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white',
              )}
            >
              {done && <Check className="size-4" />}
            </span>
            <span className={cn('mt-2 text-[11px] leading-tight font-medium sm:text-xs', done ? 'text-slate-900' : 'text-slate-400')}>
              {ORDER_STATUS_META[step].label}
            </span>
            {at && <span className="mt-0.5 hidden text-[10px] text-slate-400 sm:block">{formatDateTime(at)}</span>}
          </li>
        )
      })}
    </ol>
  )
}
