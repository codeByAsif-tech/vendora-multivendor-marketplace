import { useState } from 'react'
import { Ban, CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import ReasonDialog from '@/components/common/ReasonDialog'
import StatusBadge from '@/components/common/StatusBadge'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Modal from '@/components/ui/Modal'
import Skeleton from '@/components/ui/Skeleton'
import { useGetAdminSellerQuery, useGetCommissionSettingsQuery, useUpdateSellerStatusMutation } from '@/features/admin/adminApi'
import { getErrorMessage } from '@/utils/apiError'
import { BUSINESS_TYPE_LABELS, formatDate, formatDateTime, initials } from '@/utils/format'
import { CommissionDialog } from '../payouts/PayoutDialogs'

function Detail({ label, value, mono = false }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-sm text-slate-900 ${mono ? 'font-mono' : ''}`}>{value || '—'}</dd>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">{title}</h3>
      <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
    </section>
  )
}

const ACTIONS = {
  pending: ['reject', 'approve'],
  approved: ['suspend'],
  suspended: ['reinstate'],
  rejected: ['approve'],
}

export default function SellerDetailModal({ sellerId, onClose }) {
  const { data: seller, isLoading } = useGetAdminSellerQuery(sellerId)
  const [updateStatus, { isLoading: saving }] = useUpdateSellerStatusMutation()
  const { data: commission } = useGetCommissionSettingsQuery()
  const [dialog, setDialog] = useState(null) // 'approve' | 'reinstate' | 'reject' | 'suspend' | 'commission'

  async function changeStatus(status, reason) {
    try {
      const result = await updateStatus({ id: sellerId, status, ...(reason ? { reason } : {}) }).unwrap()
      toast.success(result.message)
      setDialog(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const buttons = {
    reject: (
      <Button key="reject" variant="outline" onClick={() => setDialog('reject')}>
        <XCircle className="size-4 text-rose-600" /> Reject
      </Button>
    ),
    approve: (
      <Button key="approve" onClick={() => setDialog('approve')}>
        <CheckCircle2 className="size-4" /> Approve store
      </Button>
    ),
    suspend: (
      <Button key="suspend" variant="danger" onClick={() => setDialog('suspend')}>
        <Ban className="size-4" /> Suspend
      </Button>
    ),
    reinstate: (
      <Button key="reinstate" onClick={() => setDialog('reinstate')}>
        <RotateCcw className="size-4" /> Reinstate
      </Button>
    ),
  }

  const address = seller?.pickupAddress
  const addressText = address
    ? [address.line1, address.line2, `${address.city}, ${address.state} ${address.postalCode}`, address.country]
        .filter(Boolean)
        .join(', ')
    : ''

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="xl"
        title={seller?.storeName ?? 'Seller details'}
        description={seller ? `/${seller.slug} · submitted ${formatDate(seller.submittedAt)}` : undefined}
        footer={seller && (ACTIONS[seller.status] ?? []).map((action) => buttons[action])}
      >
        {isLoading || !seller ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-brand-50 text-lg font-bold text-brand-700">
                {seller.logo?.url ? <img src={seller.logo.url} alt="" className="size-full object-cover" /> : initials(seller.storeName)}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={seller.status} />
                  <span className="text-sm text-slate-500">{seller.productCount} products</span>
                </div>
                {seller.description && <p className="mt-1 text-sm text-slate-600">{seller.description}</p>}
              </div>
            </div>

            {seller.statusReason && (
              <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
                <span className="font-semibold">Current reason: </span>
                {seller.statusReason}
              </div>
            )}

            <Section title="Owner">
              <Detail label="Name" value={seller.user?.name} />
              <Detail label="Account email" value={seller.user?.email} />
              <Detail label="Account status" value={seller.user?.status} />
              <Detail label="Last login" value={formatDateTime(seller.user?.lastLoginAt)} />
            </Section>

            <Section title="Business">
              <Detail label="Business type" value={BUSINESS_TYPE_LABELS[seller.businessType]} />
              <Detail label="PAN" value={seller.pan} mono />
              <Detail label="GSTIN" value={seller.gstin} mono />
              <Detail label="Contact" value={`${seller.contactEmail} · ${seller.contactPhone}`} />
              <div className="sm:col-span-2">
                <Detail label="Pickup address" value={addressText} />
              </div>
            </Section>

            <Section title="Bank account">
              <Detail label="Account holder" value={seller.bank?.accountHolderName} />
              <Detail label="Bank" value={seller.bank?.bankName} />
              <Detail label="IFSC" value={seller.bank?.ifsc} mono />
              <Detail label="Account number" value={`•••• ${seller.bank?.accountNumberLast4}`} mono />
            </Section>

            <section>
              <h3 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">Commission</h3>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-900">
                  <strong>{seller.commissionRate ?? commission?.defaultRate ?? '—'}%</strong>{' '}
                  <span className="text-slate-500">
                    {seller.commissionRate == null ? '(platform rate)' : '(custom rate for this seller)'}
                  </span>
                </p>
                <Button size="sm" variant="outline" onClick={() => setDialog('commission')}>
                  Change
                </Button>
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">History</h3>
              <ol className="space-y-3 border-l border-slate-200 pl-4">
                {[...seller.statusHistory].reverse().map((event, i) => (
                  <li key={i} className="relative">
                    <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-white bg-brand-500" />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={event.status} />
                      <span className="text-xs text-slate-500">
                        {formatDateTime(event.changedAt)}
                        {event.changedBy?.name ? ` · by ${event.changedBy.name}` : ''}
                      </span>
                    </div>
                    {event.reason && <p className="mt-1 text-sm text-slate-600">{event.reason}</p>}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </Modal>

      {dialog === 'commission' && seller && (
        <CommissionDialog store={seller} defaultRate={commission?.defaultRate ?? 0} onClose={() => setDialog(null)} />
      )}

      <ConfirmDialog
        open={dialog === 'approve' || dialog === 'reinstate'}
        onClose={() => setDialog(null)}
        onConfirm={() => changeStatus('approved')}
        loading={saving}
        variant="primary"
        title={dialog === 'reinstate' ? 'Reinstate this store?' : 'Approve this store?'}
        description={
          dialog === 'reinstate'
            ? 'Their approved products become visible to customers again.'
            : 'The seller will be able to list products. They will get an email.'
        }
        confirmLabel={dialog === 'reinstate' ? 'Reinstate' : 'Approve'}
      />

      {(dialog === 'reject' || dialog === 'suspend') && (
        <ReasonDialog
          open
          onClose={() => setDialog(null)}
          loading={saving}
          title={dialog === 'reject' ? 'Reject application' : 'Suspend store'}
          description={
            dialog === 'reject'
              ? 'The seller can fix their details and resubmit.'
              : 'All products of this store will be hidden from customers.'
          }
          confirmLabel={dialog === 'reject' ? 'Reject' : 'Suspend'}
          onConfirm={(reason) => changeStatus(dialog === 'reject' ? 'rejected' : 'suspended', reason)}
        />
      )}
    </>
  )
}
