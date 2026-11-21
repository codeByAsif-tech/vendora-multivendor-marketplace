import { useState } from 'react'
import { Package } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import StatusBadge from '@/components/common/StatusBadge'
import Thumb from '@/components/common/Thumb'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import DataTable from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import Tabs from '@/components/ui/Tabs'
import { useGetAdminProductsQuery } from '@/features/admin/adminApi'
import { formatDate, formatNumber } from '@/utils/format'
import { formatPriceRange } from '@/utils/money'
import ProductReviewModal from './products/ProductReviewModal'

const TABS = [
  { value: 'pending', label: 'Review queue' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
]

export default function AdminProductsPage() {
  const [filters, setFilters] = useState({ status: 'pending', search: '', page: 1 })
  const [selectedId, setSelectedId] = useState(null)
  const { data, isLoading, isFetching } = useGetAdminProductsQuery({ ...filters, limit: 15 })

  const update = (patch) => setFilters((prev) => ({ ...prev, page: 1, ...patch }))

  const columns = [
    {
      key: 'product',
      header: 'Product',
      render: (p) => (
        <div className="flex min-w-64 items-center gap-3">
          <Thumb src={p.images?.[0]?.url} />
          <div className="min-w-0">
            <p className="line-clamp-1 font-medium text-slate-900">{p.name}</p>
            <p className="text-xs text-slate-500">
              {p.category?.name} · {p.variants?.length ?? 0} SKU{p.variants?.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'store',
      header: 'Store',
      render: (p) => (
        <div>
          <p className="text-slate-900">{p.store?.storeName}</p>
          {p.store?.status !== 'approved' && <p className="text-xs text-rose-600">Store {p.store?.status}</p>}
        </div>
      ),
    },
    { key: 'price', header: 'Price', render: (p) => <span className="whitespace-nowrap">{formatPriceRange(p.minPrice, p.maxPrice)}</span> },
    { key: 'stock', header: 'Stock', align: 'right', render: (p) => formatNumber(p.totalStock) },
    { key: 'updated', header: 'Updated', render: (p) => <span className="whitespace-nowrap">{formatDate(p.updatedAt)}</span> },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) => (
        <Button variant="outline" size="sm" onClick={() => setSelectedId(p._id)}>
          {p.status === 'pending' ? 'Review' : 'View'}
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Products" description="Review new and edited products before they appear in the store." />

      <Card>
        <div className="border-b border-slate-200 px-4">
          <Tabs
            tabs={TABS.map((tab) => ({ ...tab, count: data?.counts?.[tab.value || 'all'] }))}
            value={filters.status}
            onChange={(status) => update({ status })}
          />
        </div>
        <div className="p-4">
          <SearchInput className="sm:max-w-sm" placeholder="Search name, brand or SKU" onSearch={(search) => update({ search })} />
        </div>
        <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
          <DataTable
            columns={columns}
            rows={data?.items}
            loading={isLoading}
            onRowClick={(p) => setSelectedId(p._id)}
            emptyState={
              <EmptyState
                icon={Package}
                title={filters.status === 'pending' && !filters.search ? 'Review queue is empty' : 'No products found'}
                description={filters.status === 'pending' && !filters.search ? 'New and edited products appear here.' : 'Try another tab or search.'}
              />
            }
          />
        </div>
        <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />
      </Card>

      {selectedId && <ProductReviewModal productId={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  )
}
