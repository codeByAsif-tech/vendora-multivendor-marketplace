import { useState } from 'react'
import { Ban, IndianRupee, Package, Percent, ReceiptText, ShoppingBag, UserPlus, Wallet } from 'lucide-react'
import StatCard from '@/components/common/StatCard'
import { ORDER_STATUS_META, PAYMENT_METHOD_LABELS } from '@/components/shop/orderStatusMeta'
import Card, { CardHeader } from '@/components/ui/Card'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'
import { formatPrice } from '@/utils/money'
import BarList from './BarList'
import { changeVsPrevious, rangeLabel } from './chartFormat'
import SalesChart from './SalesChart'

/** Status bars reuse the status badge colours (each row is also labelled, so colour is never the only cue). */
const TONE_BAR = {
  green: 'bg-emerald-500',
  red: 'bg-rose-500',
  yellow: 'bg-amber-500',
  blue: 'bg-sky-500',
  brand: 'bg-brand-600',
  gray: 'bg-slate-400',
}

const STATUS_ORDER = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled']

function compareHint(current, previous, range) {
  const change = changeVsPrevious(current, previous)
  return change ? `${change.text} vs the previous ${rangeLabel(range).replace('last ', '')}` : `No earlier data to compare`
}

function MetricToggle({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Chart shows" className="inline-flex rounded-lg bg-slate-100 p-0.5 text-sm">
      {[
        ['sales', 'Sales'],
        ['orders', 'Orders'],
      ].map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={cn(
            'rounded-md px-3 py-1 font-medium transition',
            value === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/**
 * The full report: headline cards, sales chart and breakdowns.
 * role = 'admin' (marketplace, shows top sellers / commission / sign-ups) or 'seller' (own store, shows earnings).
 */
export default function ReportView({ report, loading, range, role }) {
  const [metric, setMetric] = useState('sales')
  const t = report?.totals
  const p = report?.previous
  const isAdmin = role === 'admin'

  const cards = [
    { label: 'Sales', value: formatPrice(t?.sales ?? 0), icon: IndianRupee, tone: 'brand', hint: t && compareHint(t.sales, p.sales, range) },
    { label: 'Orders', value: formatNumber(t?.orders ?? 0), icon: ShoppingBag, tone: 'sky', hint: t && compareHint(t.orders, p.orders, range) },
    {
      label: 'Average order',
      value: formatPrice(t?.avgOrderValue ?? 0),
      icon: ReceiptText,
      tone: 'amber',
      hint: t && `${formatNumber(t.units)} item${t.units === 1 ? '' : 's'} sold`,
    },
    isAdmin
      ? { label: 'Commission', value: formatPrice(t?.commission ?? 0), icon: Percent, tone: 'emerald', hint: 'On orders placed in this period' }
      : { label: 'Your earnings', value: formatPrice(t?.earnings ?? 0), icon: Wallet, tone: 'emerald', hint: 'After commission, before delivery' },
  ]

  const statusRows = STATUS_ORDER.map((status) => ({
    id: status,
    label: ORDER_STATUS_META[status]?.label ?? status,
    value: report?.statuses?.[status] ?? 0,
    display: formatNumber(report?.statuses?.[status] ?? 0),
    tone: TONE_BAR[ORDER_STATUS_META[status]?.tone],
  })).filter((row) => row.value > 0)

  const productRows = (report?.topProducts ?? []).map((product) => ({
    id: product.productId,
    label: product.name,
    value: product.revenue,
    display: formatPrice(product.revenue),
    sub: `${formatNumber(product.units)} sold`,
    to: product.slug ? `/products/${product.slug}` : undefined,
  }))

  const paymentRows = (report?.payments ?? []).map((payment) => ({
    id: payment.method,
    label: PAYMENT_METHOD_LABELS[payment.method] ?? payment.method,
    value: payment.amount,
    display: formatPrice(payment.amount),
    sub: `${formatNumber(payment.shipments)} shipment${payment.shipments === 1 ? '' : 's'}`,
  }))

  const sellerRows = (report?.topSellers ?? []).map((seller) => ({
    id: seller.storeId,
    label: seller.storeName,
    value: seller.sales,
    display: formatPrice(seller.sales),
    sub: `${formatNumber(seller.shipments)} order${seller.shipments === 1 ? '' : 's'}`,
    to: seller.slug ? `/stores/${seller.slug}` : undefined,
  }))

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} {...card} loading={loading} />
        ))}
      </div>

      <Card>
        <CardHeader
          title={metric === 'sales' ? 'Sales over time' : 'Orders over time'}
          description={`${rangeLabel(range).replace(/^./, (c) => c.toUpperCase())}, cancelled orders not included`}
          action={<MetricToggle value={metric} onChange={setMetric} />}
        />
        <div className="p-4 sm:p-5">
          <SalesChart series={report?.series} bucket={report?.bucket} metric={metric} loading={loading} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top products" description="By sales in this period" />
          <BarList rows={productRows} loading={loading} emptyText="No products sold in this period" />
        </Card>

        {isAdmin ? (
          <Card>
            <CardHeader title="Top sellers" description="By sales in this period" />
            <BarList rows={sellerRows} loading={loading} emptyText="No sales in this period" />
          </Card>
        ) : (
          <Card>
            <CardHeader title="Order status" description="Where this period's orders are now" />
            <BarList rows={statusRows} loading={loading} count={4} emptyText="No orders in this period" />
          </Card>
        )}

        <Card>
          <CardHeader title="Payment methods" description="Cash on Delivery vs UPI / bank transfer" />
          <BarList rows={paymentRows} loading={loading} count={2} emptyText="No payments in this period" />
        </Card>

        {isAdmin ? (
          <Card>
            <CardHeader title="Order status" description="Where this period's shipments are now" />
            <BarList rows={statusRows} loading={loading} count={4} emptyText="No orders in this period" />
          </Card>
        ) : (
          <Card>
            <CardHeader title="Cancellations" description="Shipments cancelled in this period" />
            <CancelSummary totals={t} loading={loading} />
          </Card>
        )}
      </div>

      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="New customers" value={formatNumber(report?.signups?.customers ?? 0)} icon={UserPlus} tone="sky" loading={loading} hint={rangeLabel(range)} />
          <StatCard label="New sellers" value={formatNumber(report?.signups?.sellers ?? 0)} icon={Package} tone="amber" loading={loading} hint={rangeLabel(range)} />
          <StatCard
            label="Cancel rate"
            value={`${t?.cancelRate ?? 0}%`}
            icon={Ban}
            tone="rose"
            loading={loading}
            hint={t ? `${formatNumber(t.cancelled)} of ${formatNumber(t.shipments)} shipments` : undefined}
          />
        </div>
      )}
    </div>
  )
}

function CancelSummary({ totals, loading }) {
  if (loading || !totals) return <div className="h-24" />
  return (
    <div className="flex items-center gap-6 p-5">
      <p className="text-4xl font-bold tracking-tight text-slate-900">{totals.cancelRate}%</p>
      <p className="text-sm text-slate-600">
        {formatNumber(totals.cancelled)} of {formatNumber(totals.shipments)} shipments were cancelled.
        {totals.cancelRate > 10 && ' Keeping stock counts accurate helps bring this down.'}
      </p>
    </div>
  )
}
