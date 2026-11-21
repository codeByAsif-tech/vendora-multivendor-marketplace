import { useState } from 'react'
import { AlertTriangle, Boxes, IndianRupee, Layers, Package, PackageX } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/common/PageHeader'
import StatCard from '@/components/common/StatCard'
import StatusBadge from '@/components/common/StatusBadge'
import Thumb from '@/components/common/Thumb'
import StoreStatusBanner from '@/components/seller/StoreStatusBanner'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import DataTable from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import Tabs from '@/components/ui/Tabs'
import {
  useGetInventoryQuery,
  useGetInventoryStatsQuery,
  useGetMyStoreQuery,
  useUpdateVariantStockMutation,
} from '@/features/seller/sellerApi'
import { getErrorMessage } from '@/utils/apiError'
import { formatNumber } from '@/utils/format'
import { formatPrice } from '@/utils/money'
import { stockState, variantLabel } from '@/utils/stock'

/** Inline stock editor. Remounted (via row key) when the saved stock changes, so no syncing effect is needed. */
function StockEditor({ row, disabled }) {
  const [value, setValue] = useState(String(row.stock))
  const [updateStock, { isLoading }] = useUpdateVariantStockMutation()
  const valid = /^\d+$/.test(value) && Number(value) <= 1_000_000
  const changed = value !== String(row.stock)

  async function save() {
    if (!valid || !changed) return
    try {
      await updateStock({ productId: row.productId, variantId: row.variantId, stock: Number(value) }).unwrap()
      toast.success(`Stock for ${row.sku} set to ${value}`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        disabled={disabled}
        inputMode="numeric"
        aria-label={`Stock for ${row.sku}`}
        className={`h-9 w-24 rounded-md border px-2 text-right text-sm focus:ring-2 focus:outline-none ${
          valid ? 'border-slate-300 focus:border-brand-500 focus:ring-brand-100' : 'border-rose-400 focus:ring-rose-100'
        }`}
      />
      <Button size="sm" variant={changed ? 'primary' : 'outline'} disabled={disabled || !changed || !valid} loading={isLoading} onClick={save}>
        Save
      </Button>
    </div>
  )
}

const TABS = [
  { value: '', label: 'All SKUs' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Out of stock' },
]

export default function InventoryPage() {
  const [filters, setFilters] = useState({ stock: '', search: '', page: 1 })
  const { data: store } = useGetMyStoreQuery()
  const approved = store?.status === 'approved'
  const { data: stats, isLoading: statsLoading } = useGetInventoryStatsQuery()
  const { data, isLoading } = useGetInventoryQuery({ ...filters, limit: 20 })

  const update = (patch) => setFilters((prev) => ({ ...prev, page: 1, ...patch }))

  const columns = [
    {
      key: 'product',
      header: 'Product',
      render: (row) => (
        <div className="flex min-w-60 items-center gap-3">
          <Thumb src={row.image} />
          <div className="min-w-0">
            <p className="line-clamp-1 font-medium text-slate-900">{row.name}</p>
            <p className="text-xs text-slate-500">
              {variantLabel(row.attributes)}
              {!row.variantActive && ' · inactive'}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'sku', header: 'SKU', render: (row) => <span className="font-mono text-xs text-slate-600">{row.sku}</span> },
    {
      key: 'price',
      header: 'Price',
      render: (row) => (
        <span className="whitespace-nowrap">{formatPrice(row.salePrice ?? row.price)}</span>
      ),
    },
    {
      key: 'state',
      header: 'Status',
      render: (row) => (
        <div>
          <StatusBadge status={stockState(row)} />
          <p className="mt-1 text-[11px] text-slate-400">Alert at {row.lowStockThreshold}</p>
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      render: (row) => <StockEditor row={row} disabled={!approved} />,
    },
  ]

  return (
    <>
      <PageHeader title="Inventory" description="Stock levels for every SKU. Lowest stock is shown first." />

      {store !== undefined && !approved && <StoreStatusBanner store={store} className="mb-6" />}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Products" value={formatNumber(stats?.products)} icon={Package} loading={statsLoading} />
        <StatCard label="SKUs" value={formatNumber(stats?.skus)} icon={Layers} tone="sky" loading={statsLoading} />
        <StatCard label="Units in stock" value={formatNumber(stats?.units)} icon={Boxes} tone="emerald" loading={statsLoading} />
        <StatCard label="Low / out of stock" value={`${formatNumber(stats?.lowStock)} / ${formatNumber(stats?.outOfStock)}`} icon={AlertTriangle} tone="amber" loading={statsLoading} />
        <StatCard label="Stock value" value={formatPrice(stats?.stockValue ?? 0)} icon={IndianRupee} tone="rose" loading={statsLoading} />
      </div>

      <Card>
        <div className="border-b border-slate-200 px-4">
          <Tabs tabs={TABS} value={filters.stock} onChange={(stock) => update({ stock })} />
        </div>
        <div className="p-4">
          <SearchInput className="sm:max-w-xs" placeholder="Search product or SKU" onSearch={(search) => update({ search })} />
        </div>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(row) => `${row.variantId}-${row.stock}`}
          loading={isLoading}
          emptyState={
            <EmptyState
              icon={PackageX}
              title={filters.stock || filters.search ? 'Nothing here' : 'No inventory yet'}
              description={
                filters.stock === 'low'
                  ? 'No SKUs are running low. Nice!'
                  : filters.stock === 'out'
                    ? 'Everything is in stock.'
                    : 'Add products to start tracking stock.'
              }
            />
          }
        />
        <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />
      </Card>
    </>
  )
}
