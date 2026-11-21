import { AlertTriangle, Boxes, IndianRupee, Package, ShoppingBag, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import StatCard from '@/components/common/StatCard'
import StoreStatusBanner from '@/components/seller/StoreStatusBanner'
import Button from '@/components/ui/Button'
import Card, { CardHeader } from '@/components/ui/Card'
import { useAuth } from '@/features/auth/useAuth'
import SalesChart from '@/components/charts/SalesChart'
import { changeVsPrevious } from '@/components/charts/chartFormat'
import { useGetInventoryStatsQuery, useGetMyStoreQuery, useGetMyWalletQuery, useGetSellerAnalyticsQuery } from '@/features/seller/sellerApi'
import { formatNumber } from '@/utils/format'
import { formatPrice } from '@/utils/money'

export default function SellerDashboard() {
  const { user } = useAuth()
  const { data: store, isLoading: storeLoading } = useGetMyStoreQuery()
  const { data: stats, isLoading: statsLoading } = useGetInventoryStatsQuery()
  const { data: wallet, isLoading: walletLoading } = useGetMyWalletQuery()
  const { data: report, isLoading: reportLoading } = useGetSellerAnalyticsQuery({ range: '30d' })
  const vsBefore = (current, previous) => {
    const change = changeVsPrevious(current, previous)
    return change ? `${change.text} vs the 30 days before` : 'Last 30 days'
  }
  const approved = store?.status === 'approved'

  return (
    <>
      <PageHeader
        title={`Hello, ${user?.name?.split(' ')[0] ?? 'there'}`}
        description={store ? `Here is how ${store.storeName} is doing.` : 'Welcome to your Seller Hub.'}
        actions={
          approved && <Button to="/seller/products/create">Add product</Button>
        }
      />

      {!storeLoading && !approved && <StoreStatusBanner store={store} className="mb-6" />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sales (30 days)"
          value={formatPrice(report?.totals.sales ?? 0)}
          icon={IndianRupee}
          tone="brand"
          loading={reportLoading}
          hint={report ? vsBefore(report.totals.sales, report.previous.sales) : undefined}
        />
        <StatCard
          label="Orders (30 days)"
          value={formatNumber(report?.totals.orders ?? 0)}
          icon={ShoppingBag}
          tone="sky"
          loading={reportLoading}
          hint={report ? vsBefore(report.totals.orders, report.previous.orders) : undefined}
        />
        <StatCard
          label="Net earnings"
          value={formatPrice(wallet?.totalEarned ?? 0)}
          icon={Wallet}
          tone="emerald"
          loading={walletLoading}
          hint={wallet ? `${formatPrice(wallet.available)} ready for payout` : undefined}
        />
        <StatCard
          label="Products"
          value={formatNumber(stats?.products)}
          icon={Package}
          tone="amber"
          loading={statsLoading}
          hint={stats ? `${formatNumber(stats.skus)} SKUs · ${formatNumber(stats.units)} units in stock` : undefined}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Sales, last 30 days"
            action={
              <Link to="/seller/analytics" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                Analytics
              </Link>
            }
          />
          <div className="p-4 sm:p-5">
            <SalesChart series={report?.series} bucket={report?.bucket} loading={reportLoading} height={240} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Inventory health"
            action={
              <Link to="/seller/inventory" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                View
              </Link>
            }
          />
          <div className="divide-y divide-slate-100">
            <div className="flex items-center justify-between px-5 py-4">
              <span className="flex items-center gap-2 text-sm text-slate-600">
                <AlertTriangle className="size-4 text-amber-500" /> Low stock SKUs
              </span>
              <span className="font-semibold text-slate-900">{formatNumber(stats?.lowStock)}</span>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <span className="flex items-center gap-2 text-sm text-slate-600">
                <Boxes className="size-4 text-rose-500" /> Out of stock SKUs
              </span>
              <span className="font-semibold text-slate-900">{formatNumber(stats?.outOfStock)}</span>
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-sm text-slate-600">Stock value</span>
              <span className="font-semibold text-slate-900">{formatPrice(stats?.stockValue ?? 0)}</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}
