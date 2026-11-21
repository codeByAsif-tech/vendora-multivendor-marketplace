import { useState } from 'react'
import { Store } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import StatusBadge from '@/components/common/StatusBadge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import DataTable from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import Tabs from '@/components/ui/Tabs'
import { useGetAdminSellersQuery } from '@/features/admin/adminApi'
import { BUSINESS_TYPE_LABELS, formatDate, initials } from '@/utils/format'
import SellerDetailModal from './sellers/SellerDetailModal'

const TABS = [
  { value: 'pending', label: 'Pending review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
  { value: '', label: 'All' },
]

export default function SellersPage() {
  const [filters, setFilters] = useState({ status: 'pending', search: '', page: 1 })
  const [selectedId, setSelectedId] = useState(null)
  const { data, isLoading, isFetching } = useGetAdminSellersQuery({ ...filters, limit: 15 })

  const update = (patch) => setFilters((prev) => ({ ...prev, page: 1, ...patch }))

  const columns = [
    {
      key: 'store',
      header: 'Store',
      render: (s) => (
        <div className="flex min-w-52 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-50 text-sm font-bold text-brand-700">
            {s.logo?.url ? <img src={s.logo.url} alt="" className="size-full object-cover" /> : initials(s.storeName)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{s.storeName}</p>
            <p className="truncate text-xs text-slate-500">/{s.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (s) => (
        <div className="min-w-0">
          <p className="truncate text-slate-900">{s.user?.name}</p>
          <p className="truncate text-xs text-slate-500">{s.user?.email}</p>
        </div>
      ),
    },
    { key: 'business', header: 'Business', render: (s) => BUSINESS_TYPE_LABELS[s.businessType] },
    { key: 'submitted', header: 'Submitted', render: (s) => <span className="whitespace-nowrap">{formatDate(s.submittedAt)}</span> },
    { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (s) => (
        <Button variant="outline" size="sm" onClick={() => setSelectedId(s._id)}>
          {s.status === 'pending' ? 'Review' : 'View'}
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Sellers" description="Review store applications and manage seller accounts." />

      <Card>
        <div className="border-b border-slate-200 px-4">
          <Tabs
            tabs={TABS.map((tab) => ({ ...tab, count: data?.counts?.[tab.value || 'all'] }))}
            value={filters.status}
            onChange={(status) => update({ status })}
          />
        </div>
        <div className="p-4">
          <SearchInput className="sm:max-w-sm" placeholder="Search store, owner name or email" onSearch={(search) => update({ search })} />
        </div>
        <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
          <DataTable
            columns={columns}
            rows={data?.items}
            loading={isLoading}
            onRowClick={(s) => setSelectedId(s._id)}
            emptyState={
              <EmptyState
                icon={Store}
                title={filters.status === 'pending' && !filters.search ? 'No applications waiting' : 'No sellers found'}
                description={filters.status === 'pending' && !filters.search ? 'New store applications will appear here.' : 'Try another tab or search.'}
              />
            }
          />
        </div>
        <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />
      </Card>

      {selectedId && <SellerDetailModal sellerId={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  )
}
