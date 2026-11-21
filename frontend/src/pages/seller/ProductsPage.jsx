import { useState } from 'react'
import { Package, Pencil, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import StatusBadge from '@/components/common/StatusBadge'
import Thumb from '@/components/common/Thumb'
import StoreStatusBanner from '@/components/seller/StoreStatusBanner'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import DataTable from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import Switch from '@/components/ui/Switch'
import Tabs from '@/components/ui/Tabs'
import {
  useDeleteProductMutation,
  useGetMyStoreQuery,
  useGetSellerProductsQuery,
  useSetProductVisibilityMutation,
} from '@/features/seller/sellerApi'
import { getErrorMessage } from '@/utils/apiError'
import { formatNumber } from '@/utils/format'
import { formatPriceRange } from '@/utils/money'

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending review' },
  { value: 'rejected', label: 'Needs changes' },
]

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'stock_asc', label: 'Stock: low to high' },
]

const filterSelect =
  'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none'

export default function ProductsPage() {
  const [filters, setFilters] = useState({ status: '', search: '', stock: '', sort: 'newest', page: 1 })
  const [toDelete, setToDelete] = useState(null)

  const { data: store } = useGetMyStoreQuery()
  const approved = store?.status === 'approved'
  const { data, isLoading, isFetching } = useGetSellerProductsQuery({ ...filters, limit: 10 })
  const [setVisibility] = useSetProductVisibilityMutation()
  const [deleteProduct, { isLoading: deleting }] = useDeleteProductMutation()

  const update = (patch) => setFilters((prev) => ({ ...prev, page: 1, ...patch }))

  async function toggleVisibility(product, isActive) {
    try {
      const result = await setVisibility({ id: product._id, isActive }).unwrap()
      toast.success(result.message)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function confirmDelete() {
    try {
      await deleteProduct(toDelete._id).unwrap()
      toast.success('Product deleted')
      setToDelete(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const columns = [
    {
      key: 'product',
      header: 'Product',
      render: (p) => (
        <div className="flex min-w-64 items-center gap-3">
          <Thumb src={p.images?.[0]?.url} />
          <div className="min-w-0">
            <Link to={`/seller/products/${p._id}/edit`} className="line-clamp-1 font-medium text-slate-900 hover:text-brand-700">
              {p.name}
            </Link>
            <p className="text-xs text-slate-500">
              {p.category?.name ?? 'Uncategorised'} · {p.variants.length} variant{p.variants.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      render: (p) => (
        <div className="whitespace-nowrap">
          <p className="font-medium text-slate-900">{formatPriceRange(p.minPrice, p.maxPrice)}</p>
          {p.maxDiscount > 0 && <p className="text-xs font-medium text-emerald-600">Up to {p.maxDiscount}% off</p>}
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (p) =>
        p.totalStock > 0 ? (
          <span className="font-medium text-slate-900">{formatNumber(p.totalStock)}</span>
        ) : (
          <StatusBadge status="out" />
        ),
    },
    {
      key: 'status',
      header: 'Review',
      render: (p) => (
        <div className="max-w-56 space-y-1">
          <StatusBadge status={p.status} />
          {p.status === 'rejected' && p.rejectionReason && (
            <p className="line-clamp-2 text-xs text-rose-600" title={p.rejectionReason}>
              {p.rejectionReason}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'visible',
      header: 'Visible',
      render: (p) => (
        <Switch checked={p.isActive} disabled={!approved} onChange={(value) => toggleVisibility(p, value)} />
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" to={`/seller/products/${p._id}/edit`} aria-label={`Edit ${p.name}`}>
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!approved}
            onClick={() => setToDelete(p)}
            className="hover:bg-rose-50 hover:text-rose-600"
            aria-label={`Delete ${p.name}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  const counts = data?.counts
  const hasFilters = filters.search || filters.status || filters.stock

  return (
    <>
      <PageHeader
        title="Products"
        description="Manage your catalog. New and edited products are reviewed before they go live."
        actions={
          approved && (
            <Button to="/seller/products/create">
              <Plus className="size-4" /> Add product
            </Button>
          )
        }
      />

      {store !== undefined && !approved && <StoreStatusBanner store={store} className="mb-6" />}

      <Card>
        <div className="border-b border-slate-200 px-4">
          <Tabs
            tabs={STATUS_TABS.map((tab) => ({ ...tab, count: counts?.[tab.value || 'all'] }))}
            value={filters.status}
            onChange={(status) => update({ status })}
          />
        </div>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <SearchInput
            className="sm:max-w-xs sm:flex-1"
            placeholder="Search name, brand or SKU"
            onSearch={(search) => update({ search })}
          />
          <select className={filterSelect} value={filters.stock} onChange={(e) => update({ stock: e.target.value })} aria-label="Stock filter">
            <option value="">All stock</option>
            <option value="in">In stock</option>
            <option value="out">Out of stock</option>
          </select>
          <select className={`${filterSelect} sm:ml-auto`} value={filters.sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort">
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
          <DataTable
            columns={columns}
            rows={data?.items}
            loading={isLoading}
            emptyState={
              <EmptyState
                icon={Package}
                title={hasFilters ? 'No products match your filters' : 'No products yet'}
                description={hasFilters ? 'Try a different search or filter.' : 'Add your first product to start selling.'}
                action={!hasFilters && approved && <Button to="/seller/products/create">Add product</Button>}
              />
            }
          />
        </div>
        <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />
      </Card>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete this product?"
        description={`"${toDelete?.name}" will be removed from your store. This cannot be undone.`}
        confirmLabel="Delete product"
      />
    </>
  )
}
