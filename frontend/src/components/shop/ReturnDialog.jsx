import { useState } from 'react'
import toast from 'react-hot-toast'
import Thumb from '@/components/common/Thumb'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import { useRequestReturnMutation } from '@/features/shop/shopApi'
import { getErrorMessage, getFieldErrors } from '@/utils/apiError'
import { formatDate } from '@/utils/format'
import { formatPrice } from '@/utils/money'
import { REASONS_NEEDING_DETAILS, RETURN_REASONS } from './returnMeta'

const reasonOptions = Object.entries(RETURN_REASONS).map(([value, label]) => ({ value, label }))

/** Customer picks items + quantities from one delivered shipment and says why. */
export default function ReturnDialog({ orderNumber, shipment, deadline, onClose }) {
  const [requestReturn, { isLoading }] = useRequestReturnMutation()
  const returnable = shipment.items
    .map((item) => ({ ...item, left: item.quantity - (item.returnedQuantity ?? 0) }))
    .filter((item) => item.left > 0)

  // itemId → quantity to return (0 = not selected). One item: preselected.
  const [qty, setQty] = useState(() => Object.fromEntries(returnable.map((i) => [i._id, returnable.length === 1 ? i.left : 0])))
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [refundUpi, setRefundUpi] = useState('')
  const [errors, setErrors] = useState({})

  const selected = returnable.filter((i) => qty[i._id] > 0)
  const value = selected.reduce((sum, i) => sum + i.unitPrice * qty[i._id], 0)
  const needsDetails = REASONS_NEEDING_DETAILS.includes(reason)
  const canSubmit = selected.length > 0 && reason && (!needsDetails || details.trim().length >= 10)

  async function submit() {
    setErrors({})
    try {
      await requestReturn({
        orderNumber,
        sellerOrderId: shipment._id,
        items: selected.map((i) => ({ itemId: i._id, quantity: qty[i._id] })),
        reason,
        ...(details.trim() ? { details: details.trim() } : {}),
        ...(refundUpi.trim() ? { refundUpi: refundUpi.trim() } : {}),
      }).unwrap()
      toast.success('Return requested. The seller will reply soon.')
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
      title="Return items"
      description={deadline ? `Returns for this shipment are open until ${formatDate(deadline)}.` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={isLoading} disabled={!canSubmit}>
            Request return{value ? ` · ${formatPrice(value)}` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Which items?</legend>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {returnable.map((item) => (
              <li key={item._id} className="flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  className="size-4 accent-brand-600"
                  checked={qty[item._id] > 0}
                  onChange={(e) => setQty((q) => ({ ...q, [item._id]: e.target.checked ? item.left : 0 }))}
                  aria-label={`Return ${item.name}`}
                />
                <Thumb src={item.image} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">{formatPrice(item.unitPrice)} each</p>
                </div>
                {item.left > 1 && qty[item._id] > 0 && (
                  <select
                    value={qty[item._id]}
                    onChange={(e) => setQty((q) => ({ ...q, [item._id]: Number(e.target.value) }))}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900"
                    aria-label={`How many ${item.name}`}
                  >
                    {Array.from({ length: item.left }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
          {errors.items && <p className="mt-1 text-xs font-medium text-rose-600">{errors.items}</p>}
        </fieldset>

        <Select label="Reason" placeholder="Choose a reason" options={reasonOptions} value={reason} onChange={(e) => setReason(e.target.value)} error={errors.reason} />
        <Textarea
          label={needsDetails ? 'What is wrong?' : 'Anything else? (optional)'}
          rows={3}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={needsDetails ? 'Tell the seller what happened (at least 10 characters)' : ''}
          error={errors.details}
        />
        <Input
          label="UPI ID for your refund (optional)"
          placeholder="name@bank"
          hint="Speeds up your refund. Otherwise we contact you."
          value={refundUpi}
          onChange={(e) => setRefundUpi(e.target.value)}
          error={errors.refundUpi}
        />
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          After the seller approves, pack the items in their original packaging. Your refund is sent once the seller receives them.
        </p>
      </div>
    </Modal>
  )
}
