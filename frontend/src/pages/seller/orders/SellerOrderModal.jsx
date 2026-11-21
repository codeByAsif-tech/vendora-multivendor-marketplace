import Thumb from '@/components/common/Thumb'
import AddressText from '@/components/shop/AddressText'
import { OrderStatusBadge } from '@/components/shop/OrderStatusBadge'
import OrderTimeline from '@/components/shop/OrderTimeline'
import { PAYMENT_METHOD_LABELS } from '@/components/shop/orderStatusMeta'
import ShipmentActions from '@/components/shop/ShipmentActions'
import Modal from '@/components/ui/Modal'
import Skeleton from '@/components/ui/Skeleton'
import { useGetSellerOrderQuery, useUpdateSellerOrderStatusMutation } from '@/features/seller/sellerApi'
import { formatDateTime } from '@/utils/format'
import { formatPrice } from '@/utils/money'
import { variantLabel } from '@/utils/stock'

export default function SellerOrderModal({ orderId, onClose }) {
  const { data: order, isLoading } = useGetSellerOrderQuery(orderId)
  const [update, { isLoading: busy }] = useUpdateSellerOrderStatusMutation()

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={order ? `Order ${order.orderNumber}` : 'Order'}
      description={order ? `Placed ${formatDateTime(order.createdAt)}` : undefined}
      footer={order && <ShipmentActions shipment={order} update={update} busy={busy} />}
    >
      {isLoading || !order ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <OrderStatusBadge status={order.status} />
            <span className="text-sm text-slate-500">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</span>
            {order.status === 'pending' && (
              <span className="text-sm text-amber-700">Waiting for the customer’s payment to be verified. Do not ship yet.</span>
            )}
          </div>

          <OrderTimeline status={order.status} history={order.statusHistory} />

          {order.tracking?.trackingNumber && (
            <p className="text-sm text-slate-600">
              {order.tracking.carrier || 'Courier'}: <span className="font-mono font-semibold">{order.tracking.trackingNumber}</span>
            </p>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Items to pack</h3>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {order.items.map((item) => (
                  <li key={item._id} className="flex items-center gap-3 p-3">
                    <Thumb src={item.image} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        SKU {item.sku}
                        {item.attributes.length > 0 && ` · ${variantLabel(item.attributes)}`}
                      </p>
                    </div>
                    <p className="text-sm text-slate-700">× {item.quantity}</p>
                    <p className="w-24 text-right text-sm font-semibold text-slate-900">{formatPrice(item.lineTotal)}</p>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Items</dt>
                  <dd>{formatPrice(order.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Delivery charged</dt>
                  <dd>{order.shippingFee ? formatPrice(order.shippingFee) : 'Free'}</dd>
                </div>
                <div className="flex justify-between font-semibold text-slate-900">
                  <dt>Order total</dt>
                  <dd>{formatPrice(order.total)}</dd>
                </div>
              </dl>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Ship to</h3>
              <AddressText address={order.shippingAddress} />
              {order.cancelReason && (
                <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
                  <span className="font-semibold">Cancelled: </span>
                  {order.cancelReason}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
