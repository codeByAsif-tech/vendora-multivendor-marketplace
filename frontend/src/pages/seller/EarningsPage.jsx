import { useState } from 'react'
import { Banknote, Clock, Landmark, Percent, Wallet } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import StatCard from '@/components/common/StatCard'
import Badge from '@/components/ui/Badge'
import Card, { CardHeader } from '@/components/ui/Card'
import DataTable from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import Tabs from '@/components/ui/Tabs'
import { useGetMyLedgerQuery, useGetMyWalletQuery } from '@/features/seller/sellerApi'
import { formatDate, formatDateTime } from '@/utils/format'
import { formatPrice } from '@/utils/money'

const TABS = [
  { value: '', label: 'All' },
  { value: 'earning', label: 'Earnings' },
  { value: 'payout', label: 'Payouts' },
]

const METHOD_LABELS = { bank_transfer: 'Bank transfer', upi: 'UPI' }

function Description({ entry }) {
  if (entry.type === 'payout') {
    return (
      <div className="min-w-0">
        <p className="font-medium text-slate-900">Payout · {METHOD_LABELS[entry.payout?.method] ?? 'Bank'}</p>
        <p className="truncate font-mono text-xs text-slate-500">{entry.payout?.reference}</p>
      </div>
    )
  }
  return (
    <div className="min-w-0">
      <p className="font-medium text-slate-900">Order {entry.orderNumber}</p>
      <p className="text-xs text-slate-500">
        {formatPrice(entry.gross)} − {entry.commissionRate}% commission ({formatPrice(entry.commission)})
      </p>
    </div>
  )
}

function EntryStatus({ entry }) {
  if (entry.type === 'payout') return <Badge tone="blue">Paid out</Badge>
  if (entry.status === 'available') return <Badge tone="green">Available</Badge>
  return <Badge tone="yellow">On hold until {formatDate(entry.availableAt)}</Badge>
}

export default function EarningsPage() {
  const [filters, setFilters] = useState({ type: '', page: 1 })
  const { data: wallet, isLoading: walletLoading } = useGetMyWalletQuery()
  const { data, isLoading, isFetching } = useGetMyLedgerQuery({ ...filters, limit: 20 })

  const columns = [
    { key: 'date', header: 'Date', render: (e) => <span className="whitespace-nowrap">{formatDateTime(e.createdAt)}</span> },
    { key: 'what', header: 'Details', render: (e) => <Description entry={e} /> },
    { key: 'status', header: 'Status', render: (e) => <EntryStatus entry={e} /> },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (e) => (
        <span className={e.amount >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-slate-900'}>
          {e.amount >= 0 ? '+' : '−'}
          {formatPrice(Math.abs(e.amount))}
        </span>
      ),
    },
  ]

  const holdDays = wallet?.holdDays ?? 0
  const next = wallet?.nextRelease

  return (
    <>
      <PageHeader
        title="Earnings"
        description="What you earn from delivered orders, and the payouts sent to your bank."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Available for payout"
          value={formatPrice(wallet?.available ?? 0)}
          icon={Wallet}
          tone="emerald"
          loading={walletLoading}
          hint="Our team pays this to your bank account"
        />
        <StatCard
          label="On hold"
          value={formatPrice(wallet?.onHold ?? 0)}
          icon={Clock}
          tone="amber"
          loading={walletLoading}
          hint={next ? `${formatPrice(next.amount)} frees up on ${formatDate(next.at)}` : `Held ${holdDays} days after delivery`}
        />
        <StatCard
          label="Paid out so far"
          value={formatPrice(wallet?.totalPaidOut ?? 0)}
          icon={Banknote}
          tone="sky"
          loading={walletLoading}
          hint={wallet?.lastPayoutAt ? `Last payout ${formatDate(wallet.lastPayoutAt)}` : 'No payouts yet'}
        />
        <StatCard
          label="Commission rate"
          value={wallet ? `${wallet.commissionRate}%` : '—'}
          icon={Percent}
          tone="brand"
          loading={walletLoading}
          hint={`${formatPrice(wallet?.totalCommission ?? 0)} paid in commission so far`}
        />
      </div>

      <Card className="mb-6">
        <CardHeader title="How you get paid" />
        <div className="grid gap-4 p-5 text-sm text-slate-600 sm:grid-cols-3">
          <p>
            <strong className="block text-slate-900">1. Order delivered</strong>
            You earn the order total minus {wallet?.commissionRate ?? '—'}% commission on the item price. Shipping is all yours.
          </p>
          <p>
            <strong className="block text-slate-900">2. {holdDays}-day hold</strong>
            The money waits {holdDays} days after delivery, in case the customer has a problem with the order.
          </p>
          <p>
            <strong className="block text-slate-900">3. Payout</strong>
            {wallet?.bank ? (
              <>
                Then it is paid to {wallet.bank.bankName} account ending <span className="font-mono">{wallet.bank.accountNumberLast4}</span>.
              </>
            ) : (
              'Then it is paid to the bank account in your store settings.'
            )}
          </p>
        </div>
        {!walletLoading && !wallet?.bank && (
          <p className="mx-5 mb-5 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <Landmark className="size-4 shrink-0" /> Add your bank account in Settings so we can pay you.
          </p>
        )}
      </Card>

      <Card>
        <div className="border-b border-slate-200 px-4">
          <Tabs tabs={TABS} value={filters.type} onChange={(type) => setFilters({ type, page: 1 })} />
        </div>
        <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
          <DataTable
            columns={columns}
            rows={data?.items}
            loading={isLoading}
            emptyState={
              <EmptyState
                icon={Wallet}
                title="Nothing here yet"
                description="Your earnings show up here as soon as an order is delivered."
              />
            }
          />
        </div>
        <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />
      </Card>
    </>
  )
}
