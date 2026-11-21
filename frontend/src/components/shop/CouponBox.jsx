import { useState } from 'react'
import { TicketPercent, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useApplyCouponMutation, useRemoveCouponMutation } from '@/features/shop/shopApi'
import { getErrorMessage } from '@/utils/apiError'
import { formatPrice } from '@/utils/money'

/** Apply / remove a coupon on the cart page. `coupon` comes from the cart response. */
export default function CouponBox({ coupon }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [apply, { isLoading: applying }] = useApplyCouponMutation()
  const [remove, { isLoading: removing }] = useRemoveCouponMutation()

  async function submit(event) {
    event.preventDefault()
    if (!code.trim()) return
    setError('')
    try {
      await apply(code.trim()).unwrap()
      toast.success('Coupon applied')
      setCode('')
    } catch (err) {
      setError(getErrorMessage(err, 'This coupon could not be applied'))
    }
  }

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <TicketPercent className="size-4 text-brand-600" /> Coupon
      </h2>

      {coupon ? (
        <div className={`mt-3 rounded-lg border px-3 py-2.5 ${coupon.error ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-sm font-semibold text-slate-900">{coupon.code}</span>
            <button
              type="button"
              onClick={() => remove()}
              disabled={removing}
              className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-slate-900"
              aria-label={`Remove coupon ${coupon.code}`}
            >
              <X className="size-4" />
            </button>
          </div>
          {coupon.error ? (
            <p className="mt-1 text-xs text-amber-800">{coupon.error}</p>
          ) : (
            <p className="mt-1 text-xs text-emerald-700">
              You save {formatPrice(coupon.discount)}
              {coupon.description ? ` · ${coupon.description}` : ''}
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3">
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase())
                setError('')
              }}
              placeholder="Enter code"
              aria-label="Coupon code"
              aria-invalid={Boolean(error)}
              maxLength={20}
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 uppercase placeholder:font-sans placeholder:normal-case placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
            />
            <Button type="submit" variant="outline" loading={applying} disabled={!code.trim()}>
              Apply
            </Button>
          </div>
          {error && <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>}
        </form>
      )}
    </Card>
  )
}
