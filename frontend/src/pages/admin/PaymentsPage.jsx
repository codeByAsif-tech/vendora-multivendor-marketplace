import { useState } from 'react'
import { Wallet } from 'lucide-react'
import PaymentActions from '@/components/admin/PaymentActions'
import PageHeader from '@/components/common/PageHeader'
import { PaymentStatusBadge } from '@/components/shop/OrderStatusBadge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import DataTable from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import Tabs from '@/components/ui/Tabs'
import { useGetAdminPaymentsQuery } from '@/features/admin/adminApi'
import { formatDateTime } from '@/utils/format'
import { formatPrice } from '@/utils/money'
import PaymentModal from './payments/PaymentModal'

const TABS = [
  { value: 'pending_verification', label: 'To verify' },
  { value: 'refund_due', label: 'Refunds due' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'pending', label: 'COD pending' },
  { value: 'paid', label: 'Paid' },
  { value: '', label: 'All' },
]

export default function PaymentsPage() {
  const [filters, setFilters] = useState({ status: 'pending_verification', search: '', page: 1 })
  const [selectedId, setSelectedId] = useState(null)
  const { data, isLoading, isFetching } = useGetAdminPaymentsQuery({ ...filters, limit: 15 })
  const update = (patch) => setFilters((prev) => ({ ...prev, page: 1, ...patch }))

  const columns = [
    {
      key: 'order',
      header: 'Order',
      render: (p) => (
        <div className="min-w-36">
          <p className="font-medium text-slate-900">{p.orderNumber}</p>
          <p className="text-xs text-slate-500">{formatDateTime(p.submittedAt ?? p.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (p) => (
        <div className="min-w-0">
          <p className="truncate text-slate-900">{p.customer?.name}</p>
          <p className="truncate text-xs text-slate-500">{p.customer?.email}</p>
        </div>
      ),
    },
    { key: 'method', header: 'Method', render: (p) => (p.method === 'cod' ? 'COD' : 'UPI / Bank') },
    { key: 'utr', header: 'UTR', render: (p) => (p.utr ? <span className="font-mono text-xs">{p.utr}</span> : '—') },
    { key: 'amount', header: 'Amount', align: 'right', render: (p) => <span className="font-semibold">{formatPrice(p.amount)}</span> },
    { key: 'status', header: 'Status', render: (p) => <PaymentStatusBadge payment={p} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) => (
        // Stop row clicks from also opening the details.
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <PaymentActions payment={p} size="sm" />
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(p._id)}>
            Details
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Payments"
        description="Verify UPI / bank transfers against your statement, and record refunds for cancelled paid items."
      />
      <Card>
        <div className="border-b border-slate-200 px-4">
          <Tabs
            tabs={TABS.map((tab) => ({ ...tab, count: data?.counts?.[tab.value || 'all'] }))}
            value={filters.status}
            onChange={(status) => update({ status })}
          />
        </div>
        <div className="p-4">
          <SearchInput className="sm:max-w-sm" placeholder="Order number or UTR" onSearch={(search) => update({ search })} />
        </div>
        <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
          <DataTable
            columns={columns}
            rows={data?.items}
            loading={isLoading}
            onRowClick={(p) => setSelectedId(p._id)}
            emptyState={
              <EmptyState
                icon={Wallet}
                title={filters.status === 'pending_verification' ? 'Nothing to verify' : 'No payments here'}
                description={filters.status === 'pending_verification' ? 'New UPI / bank payments appear here.' : 'Try another tab or search.'}
              />
            }
          />
        </div>
        <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />
      </Card>

      {selectedId && <PaymentModal paymentId={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  )
}
