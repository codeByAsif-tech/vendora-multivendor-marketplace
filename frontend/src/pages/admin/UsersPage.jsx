import { useState } from 'react'
import { Users } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/common/PageHeader'
import ReasonDialog from '@/components/common/ReasonDialog'
import StatusBadge from '@/components/common/StatusBadge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import DataTable from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import Tabs from '@/components/ui/Tabs'
import { useGetAdminUsersQuery, useUpdateUserStatusMutation } from '@/features/admin/adminApi'
import { getErrorMessage } from '@/utils/apiError'
import { cn } from '@/utils/cn'
import { formatDate, formatDateTime, initials } from '@/utils/format'

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'blocked', label: 'Blocked' },
]

const ROLES = [
  { value: 'customer', label: 'Customers' },
  { value: 'seller', label: 'Sellers' },
]

export default function UsersPage() {
  const [filters, setFilters] = useState({ role: 'customer', status: '', search: '', page: 1 })
  const [target, setTarget] = useState(null) // { user, action: 'block' | 'unblock' }
  const { data, isLoading, isFetching } = useGetAdminUsersQuery({ ...filters, limit: 20 })
  const [updateStatus, { isLoading: saving }] = useUpdateUserStatusMutation()

  const update = (patch) => setFilters((prev) => ({ ...prev, page: 1, ...patch }))

  async function changeStatus(status, reason) {
    try {
      const result = await updateStatus({ id: target.user._id, status, ...(reason ? { reason } : {}) }).unwrap()
      toast.success(result.message)
      setTarget(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (u) => (
        <div className="flex min-w-56 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
            {initials(u.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{u.name}</p>
            <p className="truncate text-xs text-slate-500">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (u) => u.phone || '—' },
    { key: 'joined', header: 'Joined', render: (u) => <span className="whitespace-nowrap">{formatDate(u.createdAt)}</span> },
    { key: 'lastLogin', header: 'Last login', render: (u) => <span className="whitespace-nowrap">{formatDateTime(u.lastLoginAt)}</span> },
    { key: 'status', header: 'Status', render: (u) => <StatusBadge status={u.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (u) =>
        u.status === 'active' ? (
          <Button variant="outline" size="sm" onClick={() => setTarget({ user: u, action: 'block' })}>
            Block
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setTarget({ user: u, action: 'unblock' })}>
            Unblock
          </Button>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Users"
        description="Customer and seller accounts. Blocking signs the user out everywhere."
        actions={
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            {ROLES.map((role) => (
              <button
                key={role.value}
                type="button"
                onClick={() => update({ role: role.value })}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition',
                  filters.role === role.value ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {role.label}
              </button>
            ))}
          </div>
        }
      />

      <Card>
        <div className="border-b border-slate-200 px-4">
          <Tabs
            tabs={STATUS_TABS.map((tab) => ({ ...tab, count: data?.counts?.[tab.value || 'all'] }))}
            value={filters.status}
            onChange={(status) => update({ status })}
          />
        </div>
        <div className="p-4">
          <SearchInput className="sm:max-w-sm" placeholder="Search name, email or phone" onSearch={(search) => update({ search })} />
        </div>
        <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
          <DataTable
            columns={columns}
            rows={data?.items}
            loading={isLoading}
            emptyState={<EmptyState icon={Users} title="No users found" description="Try another filter or search." />}
          />
        </div>
        <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />
      </Card>

      {target?.action === 'block' && (
        <ReasonDialog
          open
          onClose={() => setTarget(null)}
          loading={saving}
          title={`Block ${target.user.name}?`}
          description="They are signed out immediately and cannot log in until unblocked. They will get an email."
          confirmLabel="Block account"
          onConfirm={(reason) => changeStatus('blocked', reason)}
        />
      )}

      <ConfirmDialog
        open={target?.action === 'unblock'}
        onClose={() => setTarget(null)}
        onConfirm={() => changeStatus('active')}
        loading={saving}
        variant="primary"
        title={`Unblock ${target?.user.name ?? ''}?`}
        description="They will be able to sign in again."
        confirmLabel="Unblock"
      />
    </>
  )
}
