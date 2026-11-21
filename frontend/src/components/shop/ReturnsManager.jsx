import { useState } from 'react'
import { PackageCheck, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import ReasonDialog from '@/components/common/ReasonDialog'
import Thumb from '@/components/common/Thumb'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import Skeleton from '@/components/ui/Skeleton'
import Tabs from '@/components/ui/Tabs'
import { getErrorMessage } from '@/utils/apiError'
import { formatDateTime } from '@/utils/format'
import { formatPrice } from '@/utils/money'
import { RETURN_REASONS, RETURN_STATUS_META } from './returnMeta'

const TABS = [
  { value: 'requested', label: 'To review' },
  { value: 'approved', label: 'Awaiting parcel' },
  { value: 'received', label: 'Received' },
  { value: 'rejected', label: 'Declined' },
  { value: '', label: 'All' },
]

/**
 * Return requests list with approve / decline / mark received.
 * Used by sellers (own returns) and admins (all, to step in). The page passes the matching RTK hooks.
 */
export default function ReturnsManager({ useList, useDecide, showStore = false }) {
  const [filters, setFilters] = useState({ status: 'requested', search: '', page: 1 })
  const { data, isLoading, isFetching } = useList({ ...filters, limit: 20 })
  const [decide, { isLoading: saving }] = useDecide()
  const [dialog, setDialog] = useState(null) // { action, ret }

  async function run(action, ret, note) {
    try {
      const res = await decide({ id: ret._id, action, ...(note ? { note } : {}) }).unwrap()
      toast.success(res.message)
      setDialog(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Card>
      <div className="border-b border-slate-200 px-4">
        <Tabs
          tabs={TABS.map((t) => ({ ...t, count: data?.counts?.[t.value || 'all'] }))}
          value={filters.status}
          onChange={(status) => setFilters((f) => ({ ...f, status, page: 1 }))}
        />
      </div>
      <div className="p-4">
        <SearchInput className="sm:max-w-xs" placeholder="Return or order number" onSearch={(search) => setFilters((f) => ({ ...f, search, page: 1 }))} />
      </div>

      <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <EmptyState icon={RotateCcw} title="No returns here" description="Customers can return delivered items within the return window." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.items.map((ret) => (
              <li key={ret._id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {ret.returnNumber} <span className="font-normal text-slate-500">· order {ret.orderNumber}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {ret.customer?.name}
                      {showStore && ret.store?.storeName ? ` → ${ret.store.storeName}` : ''} · {formatDateTime(ret.createdAt)}
                    </p>
                  </div>
                  <Badge tone={RETURN_STATUS_META[ret.status]?.tone}>{RETURN_STATUS_META[ret.status]?.label}</Badge>
                </div>

                <ul className="mt-3 space-y-2">
                  {ret.items.map((item) => (
                    <li key={item.itemId} className="flex items-center gap-3 text-sm">
                      <Thumb src={item.image} className="size-10" />
                      <span className="min-w-0 flex-1 truncate text-slate-900">{item.name}</span>
                      <span className="text-slate-600">
                        {item.quantity} × {formatPrice(item.unitPrice)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-900">{RETURN_REASONS[ret.reason]}</p>
                  {ret.details && <p className="mt-1 text-slate-600">“{ret.details}”</p>}
                  {ret.rejectionReason && <p className="mt-1 text-rose-700">Declined: {ret.rejectionReason}</p>}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-600">
                    Customer refund <strong className="text-slate-900">{formatPrice(ret.refundAmount)}</strong>
                    {' · '}Taken from earnings <strong className="text-slate-900">{formatPrice(ret.sellerDebit)}</strong>
                  </p>
                  <div className="flex gap-2">
                    {ret.status === 'requested' && (
                      <>
                        <Button size="sm" variant="dangerOutline" onClick={() => setDialog({ action: 'reject', ret })}>
                          Decline
                        </Button>
                        <Button size="sm" onClick={() => run('approve', ret)} loading={saving && dialog === null}>
                          Approve
                        </Button>
                      </>
                    )}
                    {ret.status === 'approved' && (
                      <Button size="sm" onClick={() => setDialog({ action: 'receive', ret })}>
                        <PackageCheck className="size-4" /> Mark received
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />

      {dialog?.action === 'reject' && (
        <ReasonDialog
          open
          onClose={() => setDialog(null)}
          loading={saving}
          title={`Decline return ${dialog.ret.returnNumber}?`}
          description="The customer sees this reason."
          confirmLabel="Decline return"
          placeholder="e.g. The photos show the item was used"
          onConfirm={(reason) => run('reject', dialog.ret, reason)}
        />
      )}
      <ConfirmDialog
        open={dialog?.action === 'receive'}
        onClose={() => setDialog(null)}
        onConfirm={() => run('receive', dialog.ret)}
        loading={saving}
        title="Mark the parcel as received?"
        description={
          dialog?.ret
            ? `The items go back into stock, ${formatPrice(dialog.ret.refundAmount)} becomes due to the customer, and ${formatPrice(dialog.ret.sellerDebit)} is taken from the seller's earnings. This cannot be undone.`
            : ''
        }
        confirmLabel="Yes, received"
        variant="primary"
      />
    </Card>
  )
}
