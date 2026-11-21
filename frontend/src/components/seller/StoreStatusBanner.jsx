import { AlertTriangle, Ban, Clock, Store } from 'lucide-react'
import Button from '@/components/ui/Button'
import { cn } from '@/utils/cn'

const VARIANTS = {
  none: {
    icon: Store,
    tone: 'border-brand-200 bg-brand-50 text-brand-900',
    iconTone: 'bg-brand-100 text-brand-700',
    title: 'Set up your store',
    text: 'Add your store, business and bank details. Our team reviews every store before it can sell.',
    action: 'Set up store',
  },
  pending: {
    icon: Clock,
    tone: 'border-amber-200 bg-amber-50 text-amber-900',
    iconTone: 'bg-amber-100 text-amber-700',
    title: 'Your store is under review',
    text: 'We usually review new stores within 1–2 business days. You will get an email when it is done.',
    action: 'View details',
  },
  rejected: {
    icon: AlertTriangle,
    tone: 'border-rose-200 bg-rose-50 text-rose-900',
    iconTone: 'bg-rose-100 text-rose-700',
    title: 'Your store application needs changes',
    text: 'Update your store details and save them to resubmit.',
    action: 'Update details',
  },
  suspended: {
    icon: Ban,
    tone: 'border-slate-300 bg-slate-100 text-slate-900',
    iconTone: 'bg-slate-200 text-slate-700',
    title: 'Your store is suspended',
    text: 'Your products are hidden from customers. Contact support to resolve this.',
    action: null,
  },
}

/** Explains what a non-approved seller must do next. Renders nothing for approved stores. */
export default function StoreStatusBanner({ store, showAction = true, className }) {
  const status = store ? store.status : 'none'
  const variant = VARIANTS[status]
  if (!variant) return null
  const Icon = variant.icon

  return (
    <div className={cn('flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center', variant.tone, className)}>
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', variant.iconTone)}>
        <Icon className="size-5" />
      </span>
      <div className="flex-1">
        <p className="font-semibold">{variant.title}</p>
        <p className="text-sm opacity-80">{variant.text}</p>
        {store?.statusReason && (status === 'rejected' || status === 'suspended') && (
          <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm">
            <span className="font-semibold">Reason: </span>
            {store.statusReason}
          </p>
        )}
      </div>
      {showAction && variant.action && (
        <Button to="/seller/settings" variant="secondary" size="sm">
          {variant.action}
        </Button>
      )}
    </div>
  )
}
