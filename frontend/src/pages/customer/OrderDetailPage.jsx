import { useState } from 'react'
import { CheckCircle2, RotateCcw, Store, Truck } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link, useLocation, useParams } from 'react-router-dom'
import ReasonDialog from '@/components/common/ReasonDialog'
import Thumb from '@/components/common/Thumb'
import Breadcrumbs from '@/components/catalog/Breadcrumbs'
import AddressText from '@/components/shop/AddressText'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/shop/OrderStatusBadge'
import OrderTimeline from '@/components/shop/OrderTimeline'
import ReturnDialog from '@/components/shop/ReturnDialog'
import { OPEN_RETURN_STATUSES, RETURN_REASONS, RETURN_STATUS_META, returnDeadline } from '@/components/shop/returnMeta'
import { CANCELLABLE_STATUSES, PAYMENT_METHOD_LABELS } from '@/components/shop/orderStatusMeta'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Skeleton from '@/components/ui/Skeleton'
import Input from '@/components/ui/Input'
import { useCancelOrderMutation, useGetMyOrderQuery, useGetMyReturnsQuery, useResubmitPaymentMutation } from '@/features/shop/shopApi'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import NotFoundPage from '@/pages/common/NotFoundPage'
import { getErrorMessage } from '@/utils/apiError'
import { formatDate, formatDateTime } from '@/utils/format'
import { formatPrice } from '@/utils/money'
import { variantLabel } from '@/utils/stock'

const UPI_ID = import.meta.env.VITE_PAYMENT_UPI_ID || 'vendora@upi'

/** Shown when an admin rejected the UTR: explains why and lets the customer send a new one. */
function ResubmitUtr({ orderNumber, reason, total }) {
  const [utr, setUtr] = useState('')
  const [error, setError] = useState(null)
  const [resubmit, { isLoading }] = useResubmitPaymentMutation()

  async function submit(event) {
    event.preventDefault()
    if (!/^[A-Za-z0-9]{6,30}$/.test(utr.trim())) {
      setError('Enter the 6–30 character UTR / transaction ID from your payment app')
      return
    }
    try {
      const result = await resubmit({ orderNumber, utr: utr.trim() }).unwrap()
      toast.success(result.message ?? 'Thanks! We will verify your payment shortly.')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-lg bg-rose-50 p-3">
      <p className="text-sm text-rose-800">
        <span className="font-semibold">We could not verify your payment.</span> {reason}
      </p>
      <p className="text-xs text-slate-600">
        If you have not paid yet, pay {formatPrice(total)} to <span className="font-mono font-semibold">{UPI_ID}</span>, then enter the
        UTR / transaction ID.
      </p>
      <Input
        placeholder="New UTR / transaction ID"
        value={utr}
        onChange={(e) => {
          setUtr(e.target.value)
          setError(null)
        }}
        error={error}
        autoComplete="off"
      />
      <Button type="submit" size="sm" loading={isLoading} fullWidth>
        Submit for verification
      </Button>
    </form>
  )
}

export default function OrderDetailPage() {
  const { orderNumber } = useParams()
  const location = useLocation()
  const justPlaced = Boolean(location.state?.placed)
  useDocumentTitle(`Order ${orderNumber}`)

  const { data: order, isLoading, isError } = useGetMyOrderQuery(orderNumber)
  const [cancelOrder, { isLoading: cancelling }] = useCancelOrderMutation()
  const [cancelTarget, setCancelTarget] = useState(null) // { sellerOrderId? }
  const [returnTarget, setReturnTarget] = useState(null) // shipment
  const { data: returnsData } = useGetMyReturnsQuery({ orderNumber, limit: 50 })
  const returns = returnsData?.items ?? []

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    )
  }
  if (isError || !order) return <NotFoundPage />

  const cancellable = order.sellerOrders.filter((s) => CANCELLABLE_STATUSES.includes(s.status))

  async function confirmCancel(reason) {
    try {
      await cancelOrder({ orderNumber, reason, ...(cancelTarget?.sellerOrderId ? { sellerOrderId: cancelTarget.sellerOrderId } : {}) }).unwrap()
      toast.success('Cancelled. Any stock has been released.')
      setCancelTarget(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: 'My orders', to: '/my-orders' }, { label: order.orderNumber }]} />

      {justPlaced && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-900">Thank you! Your order has been placed.</p>
            <p className="text-sm text-emerald-800">
              {order.payment.method === 'cod'
                ? 'Pay in cash when it arrives. We have emailed you the details.'
                : 'We are verifying your payment and will confirm your order shortly.'}
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Order {order.orderNumber}</h1>
          <p className="mt-1 text-sm text-slate-500">Placed on {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          {cancellable.length > 0 && (
            <Button variant="dangerOutline" size="sm" onClick={() => setCancelTarget({})}>
              Cancel order
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-5 lg:col-span-2">
          {order.sellerOrders.map((shipment, index) => (
            <Card key={shipment._id} className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Shipment {index + 1} of {order.sellerOrders.length}
                  </p>
                  <Link to={`/stores/${shipment.store?.slug}`} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-700">
                    <Store className="size-3.5" /> {shipment.store?.storeName}
                  </Link>
                </div>
                <OrderStatusBadge status={shipment.status} />
              </div>

              <OrderTimeline
                status={shipment.status}
                history={shipment.statusHistory}
                pendingMessage={
                  order.payment.status === 'rejected'
                    ? 'We could not verify your payment. Please enter the correct UTR in the Payment box.'
                    : undefined
                }
              />

              {shipment.tracking?.trackingNumber && (
                <p className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <Truck className="size-4 text-slate-400" />
                  {shipment.tracking.carrier || 'Courier'} · Tracking number{' '}
                  <span className="font-mono font-semibold">{shipment.tracking.trackingNumber}</span>
                </p>
              )}

              <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                {shipment.items.map((item) => (
                  <li key={item._id} className="flex items-center gap-3 py-3">
                    <Thumb src={item.image} />
                    <div className="min-w-0 flex-1">
                      {item.slug ? (
                        <Link to={`/products/${item.slug}`} className="line-clamp-1 text-sm font-medium text-slate-900 hover:text-brand-700">
                          {item.name}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-slate-900">{item.name}</p>
                      )}
                      <p className="text-xs text-slate-500">
                        {item.attributes.length > 0 && `${variantLabel(item.attributes)} · `}
                        {item.quantity} × {formatPrice(item.unitPrice)}
                        {item.returnedQuantity > 0 && <span className="text-sky-700"> · {item.returnedQuantity} returned</span>}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{formatPrice(item.lineTotal)}</p>
                  </li>
                ))}
              </ul>

              <ShipmentReturns
                shipment={shipment}
                returns={returns.filter((r) => r.sellerOrder === shipment._id)}
                windowDays={order.returnWindowDays}
                onReturn={() => setReturnTarget(shipment)}
              />

              {order.sellerOrders.length > 1 && CANCELLABLE_STATUSES.includes(shipment.status) && (
                <button
                  type="button"
                  onClick={() => setCancelTarget({ sellerOrderId: shipment._id })}
                  className="mt-2 text-sm font-medium text-rose-600 hover:text-rose-700"
                >
                  Cancel this shipment only
                </button>
              )}
            </Card>
          ))}
        </div>

        <div className="space-y-5 lg:sticky lg:top-24">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Delivery address</h2>
            <AddressText address={order.shippingAddress} />
          </Card>
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Payment</h2>
              <PaymentStatusBadge payment={order.payment} />
            </div>
            <p className="text-sm text-slate-600">{PAYMENT_METHOD_LABELS[order.payment.method]}</p>
            {order.payment.utr && <p className="text-xs text-slate-500">UTR: {order.payment.utr}</p>}
            {order.payment.status === 'rejected' && (
              <ResubmitUtr key={order.payment.rejectionReason} orderNumber={order.orderNumber} reason={order.payment.rejectionReason} total={order.total} />
            )}
            {order.payment.refundDue > 0 && (
              <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-700">
                {order.payment.refundedAmount >= order.payment.refundDue
                  ? `Refunded ${formatPrice(order.payment.refundedAmount)} for cancelled or returned items.`
                  : `Refund of ${formatPrice(order.payment.refundDue - order.payment.refundedAmount)} for cancelled or returned items is being processed.`}
              </p>
            )}
            <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Items</dt>
                <dd className="text-slate-900">{formatPrice(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Delivery</dt>
                <dd className="text-slate-900">{order.shippingTotal ? formatPrice(order.shippingTotal) : 'Free'}</dd>
              </div>
              {order.discountTotal > 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-600">Coupon{order.coupon?.code ? ` (${order.coupon.code})` : ''}</dt>
                  <dd className="font-medium text-emerald-600">−{formatPrice(order.discountTotal)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-2 font-bold">
                <dt className="text-slate-900">Total</dt>
                <dd className="text-slate-900">{formatPrice(order.total)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      {cancelTarget && (
        <ReasonDialog
          open
          onClose={() => setCancelTarget(null)}
          loading={cancelling}
          title={cancelTarget.sellerOrderId ? 'Cancel this shipment?' : 'Cancel this order?'}
          description="You can cancel anything that has not shipped yet."
          confirmLabel="Cancel order"
          placeholder="Why are you cancelling? (e.g. ordered by mistake)"
          onConfirm={confirmCancel}
        />
      )}

      {returnTarget && (
        <ReturnDialog
          orderNumber={order.orderNumber}
          shipment={returnTarget}
          deadline={returnDeadline(returnTarget, order.returnWindowDays)}
          onClose={() => setReturnTarget(null)}
        />
      )}
    </div>
  )
}

/** Returns of one shipment, plus the "Return items" button while the return window is open. */
function ShipmentReturns({ shipment, returns, windowDays, onReturn }) {
  const deadline = returnDeadline(shipment, windowDays)
  const itemsLeft = shipment.items.some((i) => i.quantity - (i.returnedQuantity ?? 0) > 0)
  const hasOpen = returns.some((r) => OPEN_RETURN_STATUSES.includes(r.status))
  const canReturn = deadline && deadline > new Date() && itemsLeft && !hasOpen

  if (!returns.length && !canReturn) return null

  return (
    <div className="mt-3 space-y-2">
      {returns.map((r) => (
        <div key={r._id} className="rounded-lg border border-slate-200 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-slate-900">
              Return {r.returnNumber} · {r.items.reduce((s, i) => s + i.quantity, 0)} item(s)
            </span>
            <Badge tone={RETURN_STATUS_META[r.status]?.tone}>{RETURN_STATUS_META[r.status]?.label ?? r.status}</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {RETURN_REASONS[r.reason]} · Refund {formatPrice(r.refundAmount)}
          </p>
          {r.status === 'approved' && (
            <p className="mt-2 text-xs text-sky-700">Approved. Pack the items and hand them to the courier; your refund starts when the seller receives them.</p>
          )}
          {r.status === 'rejected' && r.rejectionReason && <p className="mt-2 text-xs text-rose-700">Seller: {r.rejectionReason}</p>}
        </div>
      ))}
      {canReturn && (
        <button type="button" onClick={onReturn} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
          <RotateCcw className="size-4" /> Return items <span className="font-normal text-slate-500">(until {formatDate(deadline)})</span>
        </button>
      )}
    </div>
  )
}
