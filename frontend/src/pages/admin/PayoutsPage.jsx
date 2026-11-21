import { useState } from 'react'
import { Banknote, Clock, HandCoins, Percent, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/common/PageHeader'
import StatCard from '@/components/common/StatCard'
import Button from '@/components/ui/Button'
import Card, { CardHeader } from '@/components/ui/Card'
import DataTable from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import Input from '@/components/ui/Input'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import Skeleton from '@/components/ui/Skeleton'
import Tabs from '@/components/ui/Tabs'
import {
  useGetCommissionSettingsQuery,
  useGetPayoutBalancesQuery,
  useGetPayoutsQuery,
  useUpdateCommissionSettingsMutation,
} from '@/features/admin/adminApi'
import { getErrorMessage } from '@/utils/apiError'
import { formatDate, formatDateTime } from '@/utils/format'
import { formatPrice } from '@/utils/money'
import { CommissionDialog, PayoutDialog } from './payouts/PayoutDialogs'

const VIEWS = [
  { value: 'due', label: 'Ready to pay' },
  { value: 'all', label: 'All sellers' },
  { value: 'history', label: 'Payout history' },
]

const METHOD_LABELS = { bank_transfer: 'Bank transfer', upi: 'UPI' }

/** Platform default commission. Remounted (via key) when the saved value changes. */
function CommissionForm({ settings }) {
  const [update, { isLoading }] = useUpdateCommissionSettingsMutation()
  const [rate, setRate] = useState(String(settings.defaultRate))
  const rateOk = /^\d{1,2}(\.\d{1,2})?$/.test(rate) && Number(rate) <= 50
  const changed = rateOk && Number(rate) !== settings.defaultRate

  async function save(event) {
    event.preventDefault()
    try {
      const res = await update({ defaultRate: Number(rate) }).unwrap()
      toast.success(res.message)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
      <Input
        className="sm:w-48"
        label="Platform commission (%)"
        inputMode="decimal"
        value={rate}
        onChange={(e) => setRate(e.target.value)}
        error={!rateOk ? '0 to 50, up to 2 decimals' : undefined}
      />
      <Button type="submit" loading={isLoading} disabled={!changed}>
        Save rate
      </Button>
      <p className="text-sm text-slate-500 sm:ml-2 sm:pb-2.5">
        Charged on the item price of new orders. Seller earnings are held {settings.holdDays} days after delivery.
        {settings.updatedAt && ` Last changed ${formatDate(settings.updatedAt)}${settings.updatedBy?.name ? ` by ${settings.updatedBy.name}` : ''}.`}
      </p>
    </form>
  )
}

function BalancesTable({ due, defaultRate }) {
  const [filters, setFilters] = useState({ search: '', page: 1 })
  const [paying, setPaying] = useState(null)
  const [editingRate, setEditingRate] = useState(null)
  const { data, isLoading, isFetching } = useGetPayoutBalancesQuery({ ...filters, due: due ? 'true' : '', limit: 20 })

  const columns = [
    {
      key: 'store',
      header: 'Seller',
      render: (w) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{w.store?.storeName}</p>
          <p className="truncate text-xs text-slate-500">{w.seller?.email}</p>
        </div>
      ),
    },
    {
      key: 'rate',
      header: 'Commission',
      render: (w) => (
        <button
          type="button"
          onClick={() => setEditingRate(w.store)}
          className="rounded-md px-1.5 py-0.5 text-left text-sm font-medium text-brand-600 hover:bg-brand-50"
          title="Change this seller's commission"
        >
          {w.commissionRate}%{w.store?.commissionRate == null ? <span className="ml-1 text-xs font-normal text-slate-500">default</span> : null}
        </button>
      ),
    },
    { key: 'earned', header: 'Earned', align: 'right', render: (w) => formatPrice(w.totalEarned) },
    { key: 'paid', header: 'Paid out', align: 'right', render: (w) => formatPrice(w.totalPaidOut) },
    { key: 'hold', header: 'On hold', align: 'right', render: (w) => <span className="text-amber-600">{formatPrice(w.onHold)}</span> },
    {
      key: 'available',
      header: 'Available',
      align: 'right',
      render: (w) => <span className="font-semibold text-emerald-600">{formatPrice(w.available)}</span>,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (w) => (
        <Button size="sm" disabled={w.available < 100} onClick={() => setPaying(w)}>
          Pay
        </Button>
      ),
    },
  ]

  return (
    <>
      <div className="p-4">
        <SearchInput
          className="sm:max-w-xs"
          placeholder="Store, seller name or email"
          onSearch={(search) => setFilters({ search, page: 1 })}
        />
      </div>
      <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={isLoading}
          emptyState={
            <EmptyState
              icon={HandCoins}
              title={due ? 'Nobody to pay right now' : 'No seller earnings yet'}
              description="Sellers earn when an order is delivered. Money becomes payable after the hold period."
            />
          }
        />
      </div>
      <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />

      {paying && <PayoutDialog wallet={paying} onClose={() => setPaying(null)} />}
      {editingRate && <CommissionDialog store={editingRate} defaultRate={defaultRate} onClose={() => setEditingRate(null)} />}
    </>
  )
}

function PayoutHistory() {
  const [filters, setFilters] = useState({ search: '', page: 1 })
  const { data, isLoading, isFetching } = useGetPayoutsQuery({ ...filters, limit: 20 })

  const columns = [
    { key: 'date', header: 'Paid on', render: (p) => <span className="whitespace-nowrap">{formatDateTime(p.paidAt)}</span> },
    { key: 'store', header: 'Seller', render: (p) => <span className="font-medium text-slate-900">{p.store?.storeName}</span> },
    { key: 'method', header: 'Method', render: (p) => METHOD_LABELS[p.method] ?? p.method },
    { key: 'reference', header: 'Reference', render: (p) => <span className="font-mono text-xs">{p.reference}</span> },
    { key: 'to', header: 'To account', render: (p) => (p.bank?.accountNumberLast4 ? `•••• ${p.bank.accountNumberLast4}` : '—') },
    { key: 'by', header: 'Recorded by', render: (p) => p.paidBy?.name ?? '—' },
    { key: 'amount', header: 'Amount', align: 'right', render: (p) => <span className="font-semibold text-slate-900">{formatPrice(p.amount)}</span> },
  ]

  return (
    <>
      <div className="p-4">
        <SearchInput className="sm:max-w-xs" placeholder="Store or reference" onSearch={(search) => setFilters({ search, page: 1 })} />
      </div>
      <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={isLoading}
          emptyState={<EmptyState icon={Banknote} title="No payouts yet" description="Payouts you record show up here." />}
        />
      </div>
      <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />
    </>
  )
}

export default function PayoutsPage() {
  const [view, setView] = useState('due')
  const { data: settings, isLoading: settingsLoading } = useGetCommissionSettingsQuery()
  // Totals come with the balances list (shared cache with the "Ready to pay" tab).
  const { data: balances, isLoading: totalsLoading } = useGetPayoutBalancesQuery({ due: 'true', search: '', page: 1, limit: 20 })
  const totals = balances?.totals

  return (
    <>
      <PageHeader title="Payouts" description="Platform commission, seller balances and the money paid out to sellers." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ready to pay"
          value={formatPrice(totals?.available ?? 0)}
          icon={Wallet}
          tone="emerald"
          loading={totalsLoading}
          hint={`${totals?.sellersDue ?? 0} seller${totals?.sellersDue === 1 ? '' : 's'} waiting`}
        />
        <StatCard label="On hold" value={formatPrice(totals?.onHold ?? 0)} icon={Clock} tone="amber" loading={totalsLoading} hint="Inside the hold period" />
        <StatCard label="Paid out" value={formatPrice(totals?.totalPaidOut ?? 0)} icon={Banknote} tone="sky" loading={totalsLoading} />
        <StatCard label="Commission earned" value={formatPrice(totals?.totalCommission ?? 0)} icon={Percent} tone="brand" loading={totalsLoading} hint="From delivered orders" />
      </div>

      <Card className="mb-6">
        <CardHeader title="Commission" description="The platform's share of each sale. You can set a different rate per seller in the table below." />
        {settingsLoading || !settings ? (
          <div className="p-5">
            <Skeleton className="h-11 w-64" />
          </div>
        ) : (
          <CommissionForm key={`${settings.defaultRate}-${settings.updatedAt}`} settings={settings} />
        )}
      </Card>

      <Card>
        <div className="border-b border-slate-200 px-4">
          <Tabs tabs={VIEWS} value={view} onChange={setView} />
        </div>
        {view === 'history' ? (
          <PayoutHistory />
        ) : (
          <BalancesTable key={view} due={view === 'due'} defaultRate={settings?.defaultRate ?? 0} />
        )}
      </Card>
    </>
  )
}
