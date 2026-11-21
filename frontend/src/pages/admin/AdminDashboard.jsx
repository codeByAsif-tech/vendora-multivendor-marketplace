import { ArrowRight, Clock, HandCoins, IndianRupee, Package, RefreshCw, ShoppingBag, Store, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import StatCard from '@/components/common/StatCard'
import Button from '@/components/ui/Button'
import Card, { CardHeader } from '@/components/ui/Card'
import SalesChart from '@/components/charts/SalesChart'
import { useGetAdminAnalyticsQuery, useGetAdminOverviewQuery } from '@/features/admin/adminApi'
import { getErrorMessage } from '@/utils/apiError'
import { formatNumber } from '@/utils/format'
import { formatPrice } from '@/utils/money'

function TodoLink({ to, icon: Icon, label, count }) {
  return (
    <Link to={to} className="flex items-center justify-between px-5 py-4 transition hover:bg-slate-50">
      <span className="flex items-center gap-3 text-sm text-slate-700">
        <span className="flex size-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <Icon className="size-4" />
        </span>
        {label}
      </span>
      <span className="flex items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-800">{formatNumber(count)}</span>
        <ArrowRight className="size-4 text-slate-400" />
      </span>
    </Link>
  )
}

export default function AdminDashboard() {
  const { data, isLoading, isFetching, isError, error, refetch } = useGetAdminOverviewQuery()
  const { data: sales, isLoading: salesLoading } = useGetAdminAnalyticsQuery({ range: '30d' })

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Marketplace overview."
        actions={
          <Button variant="outline" onClick={refetch} loading={isFetching && !isLoading}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        }
      />

      {isError && (
        <Card className="mb-6 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {getErrorMessage(error, 'Could not load dashboard data')}
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Customers" value={formatNumber(data?.customers)} icon={Users} tone="brand" loading={isLoading} />
        <StatCard
          label="Active sellers"
          value={formatNumber(data?.approvedSellers)}
          icon={Store}
          tone="emerald"
          loading={isLoading}
          hint={data ? `${formatNumber(data.sellers)} seller accounts in total` : undefined}
        />
        <StatCard label="Products" value={formatNumber(data?.products)} icon={Package} tone="amber" loading={isLoading} />
        <StatCard label="Orders" value={formatNumber(data?.orders)} icon={ShoppingBag} tone="sky" loading={isLoading} />
        <StatCard
          label="Collected"
          value={formatPrice(data?.collected ?? 0)}
          icon={IndianRupee}
          tone="rose"
          loading={isLoading}
          hint="Online + cash on delivery, minus refunds"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Sales, last 30 days"
            description="Cancelled orders not included"
            action={
              <Link to="/admin/reports" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                Full report
              </Link>
            }
          />
          <div className="p-4 sm:p-5">
            <SalesChart series={sales?.series} bucket={sales?.bucket} loading={salesLoading} height={240} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Needs your attention" />
          <div className="divide-y divide-slate-100">
            <TodoLink to="/admin/sellers" icon={Clock} label="Store applications" count={data?.pendingSellers ?? 0} />
            <TodoLink to="/admin/products" icon={Package} label="Products to review" count={data?.pendingProducts ?? 0} />
            <TodoLink to="/admin/payments" icon={IndianRupee} label="Payments to verify" count={data?.paymentsToVerify ?? 0} />
            <TodoLink to="/admin/payouts" icon={HandCoins} label="Sellers to pay" count={data?.sellersDue ?? 0} />
          </div>
        </Card>
      </div>
    </>
  )
}
