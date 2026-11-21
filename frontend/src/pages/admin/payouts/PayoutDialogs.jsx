import { useState } from 'react'
import toast from 'react-hot-toast'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import { useCreatePayoutMutation, useUpdateSellerCommissionMutation } from '@/features/admin/adminApi'
import { getErrorMessage } from '@/utils/apiError'
import { formatPrice, paiseToRupees, RUPEE_PATTERN, rupeesToPaise } from '@/utils/money'

const METHOD_OPTIONS = [
  { value: 'bank_transfer', label: 'Bank transfer (NEFT / IMPS / RTGS)' },
  { value: 'upi', label: 'UPI' },
]

const RATE_PATTERN = /^\d{1,2}(\.\d{1,2})?$/

/**
 * Record a payout. The admin sends the money from the bank first, then records it here.
 * `wallet` is a row from GET /admin/payouts/balances (store + seller populated).
 */
export function PayoutDialog({ wallet, onClose }) {
  const [createPayout, { isLoading }] = useCreatePayoutMutation()
  const [amount, setAmount] = useState(paiseToRupees(wallet.available))
  const [method, setMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')

  const paise = rupeesToPaise(amount)
  const amountOk = RUPEE_PATTERN.test(amount) && paise >= 100 && paise <= wallet.available
  const referenceOk = /^[A-Za-z0-9\-/]{4,60}$/.test(reference.trim())
  const bank = wallet.store?.bank

  async function submit() {
    try {
      await createPayout({
        storeId: wallet.store._id,
        amount: paise,
        method,
        reference: reference.trim(),
        ...(note.trim() ? { note: note.trim() } : {}),
      }).unwrap()
      toast.success(`Payout of ${formatPrice(paise)} recorded`)
      onClose()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Pay ${wallet.store?.storeName ?? 'seller'}`}
      description={`Send the money from the bank first, then record it here. Available: ${formatPrice(wallet.available)}.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={isLoading} disabled={!amountOk || !referenceOk}>
            Record payout
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {bank ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-slate-50 p-3 text-sm">
            <dt className="text-slate-500">Account holder</dt>
            <dd className="font-medium text-slate-900">{bank.accountHolderName}</dd>
            <dt className="text-slate-500">Bank</dt>
            <dd className="font-medium text-slate-900">{bank.bankName}</dd>
            <dt className="text-slate-500">IFSC</dt>
            <dd className="font-mono text-slate-900">{bank.ifsc}</dd>
            <dt className="text-slate-500">Account</dt>
            <dd className="font-mono text-slate-900">•••• {bank.accountNumberLast4}</dd>
          </dl>
        ) : (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">This seller has no bank details saved.</p>
        )}
        <Input
          label="Amount (₹)"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={amount && !amountOk ? `Enter ₹1 to ${formatPrice(wallet.available)}` : undefined}
        />
        <Select label="Paid by" options={METHOD_OPTIONS} value={method} onChange={(e) => setMethod(e.target.value)} />
        <Input
          label="Bank / UPI reference"
          placeholder="e.g. NEFT UTR or UPI ref number"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          error={reference && !referenceOk ? '4–60 letters or numbers' : undefined}
        />
        <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  )
}

/** Per-seller commission override. Empty = use the platform default. */
export function CommissionDialog({ store, defaultRate, onClose }) {
  const [updateCommission, { isLoading }] = useUpdateSellerCommissionMutation()
  const [rate, setRate] = useState(store.commissionRate == null ? '' : String(store.commissionRate))
  const rateOk = rate === '' || (RATE_PATTERN.test(rate) && Number(rate) <= 50)

  async function save(value) {
    try {
      const res = await updateCommission({ id: store._id, rate: value }).unwrap()
      toast.success(res.message)
      onClose()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Commission for ${store.storeName}`}
      description="Applies to orders placed from now on. Orders already placed keep their rate."
      footer={
        <>
          {store.commissionRate != null && (
            <Button variant="ghost" onClick={() => save(null)} disabled={isLoading} className="mr-auto">
              Use platform rate ({defaultRate}%)
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save(rate === '' ? null : Number(rate))} loading={isLoading} disabled={!rateOk}>
            Save
          </Button>
        </>
      }
    >
      <Input
        label="Commission (%)"
        inputMode="decimal"
        placeholder={`Platform rate: ${defaultRate}%`}
        hint="Leave empty to use the platform rate. 0–50%, up to 2 decimals."
        value={rate}
        onChange={(e) => setRate(e.target.value)}
        error={!rateOk ? 'Enter 0 to 50, up to 2 decimals' : undefined}
      />
    </Modal>
  )
}
