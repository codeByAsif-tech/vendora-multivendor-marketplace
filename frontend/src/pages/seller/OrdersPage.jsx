import { useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import Thumb from '@/components/common/Thumb'
import { OrderStatusBadge } from '@/components/shop/OrderStatusBadge'
import { ORDER_STATUS_META } from '@/components/shop/orderStatusMeta'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import DataTable from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import Tabs from '@/components/ui/Tabs'
import { useGetSellerOrdersQuery } from '@/features/seller/sellerApi'
import { formatDateTime } from '@/utils/format'
import { formatPrice } from '@/utils/money'
import SellerOrderModal from './orders/SellerOrderModal'

const TABS = [
  { value: '', label: 'All' },
  { value: 'confirmed', label: 'To pack' },
  { value: 'processing', label: ORDER_STATUS_META.processing.label },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'pending', label: 'Awaiting payment' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function SellerOrdersPage() {
  const [filters, setFilters] = useState({ status: '', search: '', page: 1 })
  const [selectedId, setSelectedId] = useState(null)
  const { data, isLoading, isFetching } = useGetSellerOrdersQuery({ ...filters, limit: 15 })
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
      key: 'items',
      header: 'Items',
      render: (o) => (
        <div className="flex min-w-48 items-center gap-2">
          <Thumb src={o.items[0]?.image} className="size-9" />
          <span className="line-clamp-1 text-sm">
            {o.items[0]?.name}
            {o.items.length > 1 && <span className="text-slate-500"> +{o.items.length - 1} more</span>}
          </span>
        </div>
      ),
    },
    { key: 'customer', header: 'Customer', render: (o) => o.shippingAddress?.fullName },
    { key: 'total', header: 'Total', align: 'right', render: (o) => <span className="font-medium">{formatPrice(o.total)}</span> },
    { key: 'payment', header: 'Payment', render: (o) => (o.paymentMethod === 'cod' ? 'COD' : 'Prepaid') },
    { key: 'status', header: 'Status', render: (o) => <OrderStatusBadge status={o.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (o) => (
        <Button variant="outline" size="sm" onClick={() => setSelectedId(o._id)}>
          {o.status === 'confirmed' ? 'Process' : 'View'}
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Orders" description="Pack, ship and track the orders for your products." />
      <Card>
        <div className="border-b border-slate-200 px-4">
          <Tabs
            tabs={TABS.map((tab) => ({ ...tab, count: data?.counts?.[tab.value || 'all'] }))}
            value={filters.status}
            onChange={(status) => update({ status })}
          />
        </div>
        <div className="p-4">
          <SearchInput className="sm:max-w-sm" placeholder="Order number, customer or SKU" onSearch={(search) => update({ search })} />
        </div>
        <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
          <DataTable
            columns={columns}
            rows={data?.items}
            loading={isLoading}
            onRowClick={(o) => setSelectedId(o._id)}
            emptyState={
              <EmptyState
                icon={ShoppingBag}
                title="No orders here"
                description={filters.status || filters.search ? 'Try another tab or search.' : 'New orders appear here as soon as customers buy.'}
              />
            }
          />
        </div>
        <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />
      </Card>

      {selectedId && <SellerOrderModal orderId={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  )
}
