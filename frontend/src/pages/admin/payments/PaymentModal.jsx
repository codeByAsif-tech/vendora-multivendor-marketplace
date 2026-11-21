import PaymentActions from '@/components/admin/PaymentActions'
import { PaymentStatusBadge } from '@/components/shop/OrderStatusBadge'
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_META } from '@/components/shop/orderStatusMeta'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import Skeleton from '@/components/ui/Skeleton'
import { useGetAdminPaymentQuery } from '@/features/admin/adminApi'
import { formatDateTime } from '@/utils/format'
import { formatPrice } from '@/utils/money'
import { TRANSACTION_META } from './transactionMeta'

function Amount({ label, value, tone }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone ?? 'text-slate-900'}`}>{formatPrice(value)}</p>
    </Card>
  )
}

export default function PaymentModal({ paymentId, onClose }) {
  const { data: payment, isLoading } = useGetAdminPaymentQuery(paymentId)

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={payment ? `Payment for order ${payment.orderNumber}` : 'Payment'}
      description={payment ? `${payment.customer?.name} · ${payment.customer?.email}` : undefined}
      footer={payment && <PaymentActions payment={payment} />}
    >
      {isLoading || !payment ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <PaymentStatusBadge payment={payment} />
            <span className="text-sm text-slate-600">{PAYMENT_METHOD_LABELS[payment.method]}</span>
            {payment.utr && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-sm text-slate-800">UTR {payment.utr}</span>
            )}
          </div>

          {payment.status === 'pending_verification' && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Open your bank / UPI app and look for <strong>{formatPrice(payment.amount)}</strong> with reference{' '}
              <strong className="font-mono">{payment.utr}</strong>. Verify only if you find it.
            </p>
          )}
          {payment.rejectionReason && (
            <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
              <strong>Rejected:</strong> {payment.rejectionReason}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-4">
            <Amount label="Order total" value={payment.amount} />
            <Amount label="Received" value={payment.amountPaid} tone="text-emerald-600" />
            <Amount label="Refund due" value={payment.refundDue} tone={payment.refundDue > payment.refundedAmount ? 'text-amber-600' : undefined} />
            <Amount label="Refunded" value={payment.refundedAmount} />
          </div>

          {payment.rejectedUtrs?.length > 0 && (
            <p className="text-xs text-slate-500">Previously rejected UTRs: {payment.rejectedUtrs.join(', ')}</p>
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Transactions</h3>
            {payment.transactions.length === 0 ? (
              <p className="text-sm text-slate-500">No money has moved yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {payment.transactions.map((t) => (
                  <li key={t._id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>
                      {TRANSACTION_META[t.type]?.label}
                      <span className="ml-2 text-xs text-slate-500">{formatDateTime(t.createdAt)}</span>
                    </span>
                    <span className={t.direction === 'in' ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>
                      {t.direction === 'in' ? '+' : '−'}
                      {formatPrice(t.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">History</h3>
            <ol className="space-y-2 border-l border-slate-200 pl-4">
              {[...payment.history].reverse().map((event, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium text-slate-900">{PAYMENT_STATUS_META[event.status]?.label ?? event.status}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    {formatDateTime(event.at)}
                    {event.by?.name ? ` · ${event.by.name}` : ''}
                  </span>
                  {event.note && <p className="text-slate-600">{event.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Modal>
  )
}
