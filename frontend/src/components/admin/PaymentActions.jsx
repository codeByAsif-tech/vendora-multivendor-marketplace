import { useState } from 'react'
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import ReasonDialog from '@/components/common/ReasonDialog'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { useRecordRefundMutation, useRejectPaymentMutation, useVerifyPaymentMutation } from '@/features/admin/adminApi'
import { getErrorMessage } from '@/utils/apiError'
import { formatPrice, paiseToRupees, RUPEE_PATTERN, rupeesToPaise } from '@/utils/money'

/** Refund form: remounted each time it opens, so it always starts with the outstanding amount. */
function RefundDialog({ payment, outstanding, onClose }) {
  const [recordRefund, { isLoading }] = useRecordRefundMutation()
  const [amount, setAmount] = useState(paiseToRupees(outstanding))
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')

  const amountOk = RUPEE_PATTERN.test(amount) && rupeesToPaise(amount) >= 100 && rupeesToPaise(amount) <= outstanding
  const referenceOk = reference.trim().length >= 3

  async function submit() {
    try {
      await recordRefund({
        id: payment._id,
        amount: rupeesToPaise(amount),
        reference: reference.trim(),
        ...(note.trim() ? { note: note.trim() } : {}),
      }).unwrap()
      toast.success('Refund recorded and customer notified')
      onClose()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Record a refund"
      description={`Send the money back to the customer by bank / UPI first, then record it here. Outstanding: ${formatPrice(outstanding)}.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={isLoading} disabled={!amountOk || !referenceOk}>
            Record refund
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Amount (₹)"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={amount && !amountOk ? `Enter an amount up to ${formatPrice(outstanding)}` : undefined}
        />
        <Input label="Refund reference (bank / UPI)" placeholder="e.g. UPI ref 412398765432" value={reference} onChange={(e) => setReference(e.target.value)} />
        <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  )
}

/**
 * Verify / reject a manual payment and record refunds.
 * Used on the Payments page and inside the admin order details.
 * `payment` needs: _id, status, method, amount, utr, refundDue, refundedAmount.
 */
export default function PaymentActions({ payment, size = 'md' }) {
  const [dialog, setDialog] = useState(null) // 'verify' | 'reject' | 'refund'
  const [verify, verifyState] = useVerifyPaymentMutation()
  const [reject, rejectState] = useRejectPaymentMutation()

  const outstanding = (payment.refundDue ?? 0) - (payment.refundedAmount ?? 0)
  const awaiting = payment.status === 'pending_verification'

  async function confirmVerify() {
    try {
      await verify(payment._id).unwrap()
      toast.success('Payment verified. The order is confirmed.')
      setDialog(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function confirmReject(reason) {
    try {
      await reject({ id: payment._id, reason }).unwrap()
      toast.success('Payment rejected. The customer was asked for a new reference.')
      setDialog(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  if (!awaiting && outstanding <= 0) return null

  return (
    <>
      {awaiting && (
        <>
          <Button size={size === 'sm' ? 'sm' : 'md'} variant="outline" onClick={() => setDialog('reject')}>
            <XCircle className="size-4 text-rose-600" /> Reject
          </Button>
          <Button size={size === 'sm' ? 'sm' : 'md'} onClick={() => setDialog('verify')}>
            <CheckCircle2 className="size-4" /> Verify
          </Button>
        </>
      )}
      {outstanding > 0 && (
        <Button size={size === 'sm' ? 'sm' : 'md'} variant="outline" onClick={() => setDialog('refund')}>
          <RotateCcw className="size-4" /> Refund {formatPrice(outstanding)}
        </Button>
      )}

      <ConfirmDialog
        open={dialog === 'verify'}
        onClose={() => setDialog(null)}
        onConfirm={confirmVerify}
        loading={verifyState.isLoading}
        variant="primary"
        title="Verify this payment?"
        description={`Only verify after you have found ${formatPrice(payment.amount)} with UTR ${payment.utr} in your bank / UPI statement. The order will be confirmed and sellers can start packing.`}
        confirmLabel="Yes, money received"
      />
      {dialog === 'reject' && (
        <ReasonDialog
          open
          onClose={() => setDialog(null)}
          loading={rejectState.isLoading}
          title="Reject this payment?"
          description="The customer is emailed and can submit a new UTR. This UTR can never be used again."
          confirmLabel="Reject payment"
          placeholder="e.g. No payment with this UTR in our statement"
          onConfirm={confirmReject}
        />
      )}
      {dialog === 'refund' && <RefundDialog payment={payment} outstanding={outstanding} onClose={() => setDialog(null)} />}
    </>
  )
}
