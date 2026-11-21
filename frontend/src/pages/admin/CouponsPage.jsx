import { useState } from 'react'
import { Plus, TicketPercent } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import DataTable from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import Select from '@/components/ui/Select'
import Switch from '@/components/ui/Switch'
import Tabs from '@/components/ui/Tabs'
import { useCreateCouponMutation, useGetCouponsQuery, useUpdateCouponMutation } from '@/features/admin/adminApi'
import { getErrorMessage, getFieldErrors } from '@/utils/apiError'
import { formatDate } from '@/utils/format'
import { paiseToRupees, rupeesToPaise } from '@/utils/money'

const TABS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'disabled', label: 'Disabled' },
]

const TYPE_OPTIONS = [
  { value: 'percent', label: 'Percent off' },
  { value: 'fixed', label: 'Fixed amount off (₹)' },
]

const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '')

function couponState(coupon) {
  const now = new Date()
  if (!coupon.isActive) return { label: 'Disabled', tone: 'gray' }
  if (coupon.endsAt && new Date(coupon.endsAt) < now) return { label: 'Expired', tone: 'gray' }
  if (coupon.startsAt && new Date(coupon.startsAt) > now) return { label: 'Scheduled', tone: 'blue' }
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return { label: 'Used up', tone: 'yellow' }
  return { label: 'Active', tone: 'green' }
}

/** Create / edit form. Money fields are typed in rupees and sent as paise. Code and type are fixed once created. */
function CouponForm({ coupon, onClose }) {
  const editing = Boolean(coupon)
  const [create, { isLoading: creating }] = useCreateCouponMutation()
  const [update, { isLoading: updating }] = useUpdateCouponMutation()
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState({
    code: coupon?.code ?? '',
    type: coupon?.type ?? 'percent',
    value: coupon ? (coupon.type === 'percent' ? String(coupon.value) : paiseToRupees(coupon.value)) : '',
    maxDiscount: paiseToRupees(coupon?.maxDiscount),
    minOrderValue: paiseToRupees(coupon?.minOrderValue || null),
    startsAt: toDateInput(coupon?.startsAt),
    endsAt: toDateInput(coupon?.endsAt),
    usageLimit: coupon?.usageLimit ? String(coupon.usageLimit) : '',
    perUserLimit: String(coupon?.perUserLimit ?? 1),
    description: coupon?.description ?? '',
    firstOrderOnly: coupon?.firstOrderOnly ?? false,
    isActive: coupon?.isActive ?? true,
  })
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const percent = form.type === 'percent'

  async function submit(event) {
    event.preventDefault()
    setErrors({})
    const body = {
      ...(editing ? {} : { code: form.code.trim(), type: form.type }),
      value: percent ? Number(form.value) : rupeesToPaise(form.value),
      maxDiscount: percent && form.maxDiscount ? rupeesToPaise(form.maxDiscount) : null,
      minOrderValue: rupeesToPaise(form.minOrderValue) ?? 0,
      startsAt: form.startsAt ? `${form.startsAt}T00:00:00+05:30` : null,
      endsAt: form.endsAt ? `${form.endsAt}T23:59:59+05:30` : null,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      perUserLimit: Number(form.perUserLimit) || 1,
      description: form.description.trim() || undefined,
      firstOrderOnly: form.firstOrderOnly,
      isActive: form.isActive,
    }
    try {
      const res = editing ? await update({ id: coupon._id, ...body }).unwrap() : await create(body).unwrap()
      toast.success(res.message)
      onClose()
    } catch (error) {
      setErrors(getFieldErrors(error))
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? `Edit ${coupon.code}` : 'New coupon'}
      description="Coupons are paid by the platform: sellers still earn on the full price."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="coupon-form" loading={creating || updating}>
            {editing ? 'Save' : 'Create coupon'}
          </Button>
        </>
      }
    >
      <form id="coupon-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Code"
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
          disabled={editing}
          placeholder="WELCOME10"
          error={errors.code}
          className="font-mono"
        />
        <Select label="Type" options={TYPE_OPTIONS} value={form.type} onChange={set('type')} disabled={editing} />
        <Input
          label={percent ? 'Discount (%)' : 'Discount (₹)'}
          inputMode="decimal"
          value={form.value}
          onChange={set('value')}
          error={errors.value}
        />
        {percent ? (
          <Input label="Maximum discount (₹, optional)" inputMode="decimal" value={form.maxDiscount} onChange={set('maxDiscount')} error={errors.maxDiscount} />
        ) : (
          <div />
        )}
        <Input label="Minimum item total (₹, optional)" inputMode="decimal" value={form.minOrderValue} onChange={set('minOrderValue')} error={errors.minOrderValue} />
        <Input label="Uses per customer" inputMode="numeric" value={form.perUserLimit} onChange={set('perUserLimit')} error={errors.perUserLimit} />
        <Input label="Starts (optional)" type="date" value={form.startsAt} onChange={set('startsAt')} error={errors.startsAt} />
        <Input label="Ends (optional)" type="date" value={form.endsAt} onChange={set('endsAt')} error={errors.endsAt} />
        <Input
          label="Total uses (optional)"
          inputMode="numeric"
          value={form.usageLimit}
          onChange={set('usageLimit')}
          hint={editing ? `Used ${coupon.usedCount} times so far` : 'Empty = unlimited'}
          error={errors.usageLimit}
        />
        <Input label="Description (optional)" value={form.description} onChange={set('description')} placeholder="Shown to customers" />
        <div className="flex flex-col gap-3 sm:col-span-2">
          <Switch
            checked={form.firstOrderOnly}
            onChange={(firstOrderOnly) => setForm((f) => ({ ...f, firstOrderOnly }))}
            label="Only for a customer's first order"
          />
          <Switch checked={form.isActive} onChange={(isActive) => setForm((f) => ({ ...f, isActive }))} label="Active" />
        </div>
      </form>
    </Modal>
  )
}

export default function CouponsPage() {
  const [filters, setFilters] = useState({ status: '', search: '', page: 1 })
  const [editing, setEditing] = useState(null) // coupon | 'new'
  const { data, isLoading, isFetching } = useGetCouponsQuery({ ...filters, limit: 20 })
  const [update] = useUpdateCouponMutation()

  async function toggle(coupon) {
    try {
      await update({ id: coupon._id, isActive: !coupon.isActive }).unwrap()
      toast.success(coupon.isActive ? `${coupon.code} disabled` : `${coupon.code} enabled`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const columns = [
    {
      key: 'code',
      header: 'Coupon',
      render: (c) => (
        <div className="min-w-0">
          <p className="font-mono font-semibold text-slate-900">{c.code}</p>
          <p className="truncate text-xs text-slate-500">{c.description || c.summary}</p>
        </div>
      ),
    },
    { key: 'offer', header: 'Offer', render: (c) => <span className="text-sm">{c.summary}</span> },
    {
      key: 'dates',
      header: 'Valid',
      render: (c) => (
        <span className="text-xs whitespace-nowrap text-slate-600">
          {c.startsAt ? formatDate(c.startsAt) : 'Now'} – {c.endsAt ? formatDate(c.endsAt) : 'No end'}
        </span>
      ),
    },
    { key: 'used', header: 'Used', render: (c) => `${c.usedCount}${c.usageLimit ? ` / ${c.usageLimit}` : ''}` },
    {
      key: 'state',
      header: 'Status',
      render: (c) => {
        const state = couponState(c)
        return <Badge tone={state.tone}>{state.label}</Badge>
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => toggle(c)}>
            {c.isActive ? 'Disable' : 'Enable'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
            Edit
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Discount codes customers enter in their cart."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> New coupon
          </Button>
        }
      />
      <Card>
        <div className="border-b border-slate-200 px-4">
          <Tabs tabs={TABS} value={filters.status} onChange={(status) => setFilters((f) => ({ ...f, status, page: 1 }))} />
        </div>
        <div className="p-4">
          <SearchInput className="sm:max-w-xs" placeholder="Search code" onSearch={(search) => setFilters((f) => ({ ...f, search, page: 1 }))} />
        </div>
        <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
          <DataTable
            columns={columns}
            rows={data?.items}
            loading={isLoading}
            emptyState={<EmptyState icon={TicketPercent} title="No coupons yet" description="Create a code like WELCOME10 to give customers a discount." />}
          />
        </div>
        <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
      </Card>

      {editing && <CouponForm coupon={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
