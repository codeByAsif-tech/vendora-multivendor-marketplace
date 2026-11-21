import { useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/shop/OrderStatusBadge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import DataTable from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import Tabs from '@/components/ui/Tabs'
import { useGetAdminOrdersQuery } from '@/features/admin/adminApi'
import { formatDateTime } from '@/utils/format'
import { formatPrice } from '@/utils/money'
import AdminOrderModal from './orders/AdminOrderModal'

const TABS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Awaiting payment' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Packing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function AdminOrdersPage() {
  const [filters, setFilters] = useState({ status: '', search: '', page: 1 })
  const [selectedId, setSelectedId] = useState(null)
  const { data, isLoading, isFetching } = useGetAdminOrdersQuery({ ...filters, limit: 15 })
  const update = (patch) => setFilters((prev) => ({ ...prev, page: 1, ...patch }))

  const columns = [
    {
      key: 'order',
      header: 'Order',
      render: (o) => (
        <div className="min-w-40">
          <p className="font-medium text-slate-900">{o.orderNumber}</p>
          <p className="text-xs text-slate-500">{formatDateTime(o.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (o) => (
        <div className="min-w-0">
          <p className="truncate text-slate-900">{o.customer?.name}</p>
          <p className="truncate text-xs text-slate-500">{o.customer?.email}</p>
        </div>
      ),
    },
    {
      key: 'sellers',
      header: 'Stores',
      render: (o) => <span className="text-sm">{o.sellerOrders.map((s) => s.store?.storeName).filter(Boolean).join(', ')}</span>,
    },
    { key: 'total', header: 'Total', align: 'right', render: (o) => <span className="font-medium">{formatPrice(o.total)}</span> },
    { key: 'payment', header: 'Payment', render: (o) => <PaymentStatusBadge payment={o.payment} /> },
    { key: 'status', header: 'Status', render: (o) => <OrderStatusBadge status={o.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (o) => (
        <Button variant="outline" size="sm" onClick={() => setSelectedId(o._id)}>
          View
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Orders" description="Every order on the marketplace, split into shipments per seller." />
      <Card>
        <div className="border-b border-slate-200 px-4">
          <Tabs
            tabs={TABS.map((tab) => ({ ...tab, count: data?.counts?.[tab.value || 'all'] }))}
            value={filters.status}
            onChange={(status) => update({ status })}
          />
        </div>
        <div className="p-4">
          <SearchInput className="sm:max-w-sm" placeholder="Order number, customer name or email" onSearch={(search) => update({ search })} />
        </div>
        <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
          <DataTable
            columns={columns}
            rows={data?.items}
            loading={isLoading}
            onRowClick={(o) => setSelectedId(o._id)}
            emptyState={<EmptyState icon={ShoppingBag} title="No orders found" description="Try another tab or search." />}
          />
        </div>
        <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />
      </Card>

      {selectedId && <AdminOrderModal orderId={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  )
}
