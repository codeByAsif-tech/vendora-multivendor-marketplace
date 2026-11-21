import PaymentActions from '@/components/admin/PaymentActions'
import Thumb from '@/components/common/Thumb'
import AddressText from '@/components/shop/AddressText'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/shop/OrderStatusBadge'
import OrderTimeline from '@/components/shop/OrderTimeline'
import { PAYMENT_METHOD_LABELS } from '@/components/shop/orderStatusMeta'
import ShipmentActions from '@/components/shop/ShipmentActions'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import Skeleton from '@/components/ui/Skeleton'
import { useAdminUpdateShipmentStatusMutation, useGetAdminOrderQuery } from '@/features/admin/adminApi'
import { formatDateTime } from '@/utils/format'
import { formatPrice } from '@/utils/money'
import { variantLabel } from '@/utils/stock'

export default function AdminOrderModal({ orderId, onClose }) {
  const { data: order, isLoading } = useGetAdminOrderQuery(orderId)
  const [update, { isLoading: busy }] = useAdminUpdateShipmentStatusMutation()

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={order ? `Order ${order.orderNumber}` : 'Order'}
      description={order ? `Placed ${formatDateTime(order.createdAt)} by ${order.customer?.name} (${order.customer?.email})` : undefined}
    >
      {isLoading || !order ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-4">
              <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Status</p>
              <OrderStatusBadge status={order.status} />
            </Card>
            <Card className="p-4">
              <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Payment</p>
              <div className="flex flex-wrap items-center gap-2">
                <PaymentStatusBadge payment={order.payment} />
                <span className="text-sm text-slate-600">{PAYMENT_METHOD_LABELS[order.payment.method]}</span>
              </div>
              {order.payment.utr && <p className="mt-1 font-mono text-xs text-slate-500">UTR {order.payment.utr}</p>}
              {order.paymentId && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <PaymentActions size="sm" payment={{ ...order.payment, _id: order.paymentId, amount: order.total }} />
                </div>
              )}
            </Card>
            <Card className="p-4">
              <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Total</p>
              <p className="text-lg font-bold text-slate-900">{formatPrice(order.total)}</p>
              <p className="text-xs text-slate-500">
                Items {formatPrice(order.subtotal)} · Delivery {order.shippingTotal ? formatPrice(order.shippingTotal) : 'free'}
              </p>
            </Card>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Deliver to</p>
            <AddressText address={order.shippingAddress} />
          </div>

          {order.sellerOrders.map((shipment) => (
            <Card key={shipment._id} className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {shipment.orderNumber} · {shipment.store?.storeName}
                  </p>
                  <p className="text-xs text-slate-500">{formatPrice(shipment.total)}</p>
                </div>
                <OrderStatusBadge status={shipment.status} />
              </div>
              <OrderTimeline status={shipment.status} history={shipment.statusHistory} />
              <ul className="mt-3 space-y-2">
                {shipment.items.map((item) => (
                  <li key={item._id} className="flex items-center gap-3 text-sm">
                    <Thumb src={item.image} className="size-9" />
                    <span className="min-w-0 flex-1 truncate">
                      {item.name}
                      {item.attributes.length > 0 && <span className="text-slate-500"> · {variantLabel(item.attributes)}</span>}
                    </span>
                    <span className="text-slate-500">× {item.quantity}</span>
                    <span className="w-20 text-right font-medium">{formatPrice(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              {['pending', 'confirmed', 'processing'].includes(shipment.status) && (
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <p className="mr-auto text-xs text-slate-500">
                    {shipment.status === 'pending'
                      ? 'Confirmed automatically when the payment is verified.'
                      : 'Packing and shipping are done by the seller.'}
                  </p>
                  <ShipmentActions shipment={shipment} update={update} busy={busy} role="admin" />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </Modal>
  )
}
