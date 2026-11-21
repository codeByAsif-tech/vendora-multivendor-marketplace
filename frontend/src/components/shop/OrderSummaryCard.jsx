import Card from '@/components/ui/Card'
import { formatPrice } from '@/utils/money'

/** Price breakdown used on the cart and checkout pages. Amounts in paise. */
export default function OrderSummaryCard({ summary, coupon, children, title = 'Order summary' }) {
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <dl className="mt-4 space-y-2.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-600">Items ({summary.itemCount})</dt>
          <dd className="text-slate-900">{formatPrice(summary.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-600">Delivery</dt>
          <dd className={summary.shipping === 0 ? 'font-medium text-emerald-600' : 'text-slate-900'}>
            {summary.shipping === 0 ? 'Free' : formatPrice(summary.shipping)}
          </dd>
        </div>
        {summary.discount > 0 && (
          <div className="flex justify-between">
            <dt className="text-slate-600">Coupon{coupon?.code ? ` (${coupon.code})` : ''}</dt>
            <dd className="font-medium text-emerald-600">−{formatPrice(summary.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold">
          <dt className="text-slate-900">Total</dt>
          <dd className="text-slate-900">{formatPrice(summary.total)}</dd>
        </div>
      </dl>
      {summary.firstOrderFreeDelivery && (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
          🎉 Your first order ships free
        </p>
      )}
      {summary.savings > 0 && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          You save {formatPrice(summary.savings)} on this order
        </p>
      )}
      {children && <div className="mt-5">{children}</div>}
    </Card>
  )
}
