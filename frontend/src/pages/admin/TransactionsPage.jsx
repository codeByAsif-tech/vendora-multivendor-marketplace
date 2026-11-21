import { useState } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, Wallet } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import StatCard from '@/components/common/StatCard'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import DataTable from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import Tabs from '@/components/ui/Tabs'
import { useGetTransactionsQuery } from '@/features/admin/adminApi'
import { formatDateTime } from '@/utils/format'
import { formatPrice } from '@/utils/money'
import { TRANSACTION_META } from './payments/transactionMeta'

const TABS = [
  { value: '', label: 'All' },
  { value: 'payment_received', label: 'Online' },
  { value: 'cod_collected', label: 'Cash (COD)' },
  { value: 'refund', label: 'Refunds' },
]

const dateInput =
  'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none'

export default function TransactionsPage() {
  const [filters, setFilters] = useState({ type: '', search: '', from: '', to: '', page: 1 })
  const { data, isLoading, isFetching } = useGetTransactionsQuery({ ...filters, limit: 20 })
  const update = (patch) => setFilters((prev) => ({ ...prev, page: 1, ...patch }))
  const summary = data?.summary

  const columns = [
    { key: 'date', header: 'Date', render: (t) => <span className="whitespace-nowrap">{formatDateTime(t.createdAt)}</span> },
    {
      key: 'type',
      header: 'Type',
      render: (t) => <Badge tone={TRANSACTION_META[t.type]?.tone}>{TRANSACTION_META[t.type]?.label ?? t.type}</Badge>,
    },
    { key: 'order', header: 'Order', render: (t) => <span className="font-medium text-slate-900">{t.orderNumber}</span> },
    {
      key: 'party',
      header: 'Customer / store',
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate text-slate-900">{t.customer?.name}</p>
          {t.store?.storeName && <p className="truncate text-xs text-slate-500">{t.store.storeName}</p>}
        </div>
      ),
    },
    { key: 'reference', header: 'Reference', render: (t) => <span className="font-mono text-xs">{t.reference ?? '—'}</span> },
    { key: 'by', header: 'Recorded by', render: (t) => t.createdBy?.name ?? 'System' },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (t) => (
        <span className={t.direction === 'in' ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>
          {t.direction === 'in' ? '+' : '−'}
          {formatPrice(t.amount)}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Transactions" description="Every rupee in and out. Records are never edited; corrections are new entries." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Online received" value={formatPrice(summary?.received ?? 0)} icon={ArrowDownLeft} tone="emerald" loading={isLoading} />
        <StatCard label="Cash collected" value={formatPrice(summary?.codCollected ?? 0)} icon={Banknote} tone="sky" loading={isLoading} />
        <StatCard label="Refunded" value={formatPrice(summary?.refunded ?? 0)} icon={ArrowUpRight} tone="rose" loading={isLoading} />
        <StatCard label="Net collected" value={formatPrice(summary?.net ?? 0)} icon={Wallet} tone="brand" loading={isLoading} hint="For the selected dates" />
      </div>

      <Card>
        <div className="border-b border-slate-200 px-4">
          <Tabs tabs={TABS} value={filters.type} onChange={(type) => update({ type })} />
        </div>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <SearchInput className="sm:max-w-xs sm:flex-1" placeholder="Order number or reference" onSearch={(search) => update({ search })} />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            From <input type="date" className={dateInput} value={filters.from} onChange={(e) => update({ from: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            To <input type="date" className={dateInput} value={filters.to} onChange={(e) => update({ to: e.target.value })} />
          </label>
        </div>
        <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
          <DataTable
            columns={columns}
            rows={data?.items}
            loading={isLoading}
            emptyState={<EmptyState icon={ArrowLeftRight} title="No transactions" description="Money movements appear here as orders are paid, delivered or refunded." />}
          />
        </div>
        <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />
      </Card>
    </>
  )
}
