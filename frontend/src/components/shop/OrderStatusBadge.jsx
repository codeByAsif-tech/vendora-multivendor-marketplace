import Badge from '@/components/ui/Badge'
import { ORDER_STATUS_META, PAYMENT_STATUS_META } from './orderStatusMeta'

export function OrderStatusBadge({ status }) {
  const meta = ORDER_STATUS_META[status] ?? { label: status, tone: 'gray' }
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  )
}

export function PaymentStatusBadge({ payment }) {
  const meta = PAYMENT_STATUS_META[payment?.status] ?? { label: payment?.status, tone: 'gray' }
  return <Badge tone={meta.tone}>{payment?.method === 'cod' && payment.status === 'pending' ? 'Pay on delivery' : meta.label}</Badge>
}
