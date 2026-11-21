import { useState } from 'react'
import { Banknote, Check, Lock, MapPin, Plus, Smartphone } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Thumb from '@/components/common/Thumb'
import AddressFormModal from '@/components/shop/AddressFormModal'
import AddressText from '@/components/shop/AddressText'
import VerifyEmailModal from '@/components/common/VerifyEmailModal'
import OrderSummaryCard from '@/components/shop/OrderSummaryCard'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Skeleton from '@/components/ui/Skeleton'
import { useAuth } from '@/features/auth/useAuth'
import { useGetAddressesQuery, useGetCartQuery, usePlaceOrderMutation } from '@/features/shop/shopApi'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { getErrorMessage, getFieldErrors } from '@/utils/apiError'
import { cn } from '@/utils/cn'
import { formatPrice } from '@/utils/money'
import { variantLabel } from '@/utils/stock'

const UPI_ID = import.meta.env.VITE_PAYMENT_UPI_ID || 'vendora@upi'

function Step({ number, title, icon: Icon, children, action }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 text-base font-semibold text-slate-900">
          <span className="flex size-7 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{number}</span>
          {Icon && <Icon className="size-4 text-slate-400" />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  )
}

function ChoiceCard({ selected, onSelect, children }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'relative w-full rounded-xl border p-4 text-left transition',
        selected ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-slate-200 bg-white hover:border-slate-300',
      )}
    >
      {selected && (
        <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-brand-600 text-white">
          <Check className="size-3.5" />
        </span>
      )}
      {children}
    </button>
  )
}

export default function CheckoutPage() {
  useDocumentTitle('Checkout')
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: cart, isLoading: cartLoading } = useGetCartQuery()
  const { data: addresses = [], isLoading: addressesLoading } = useGetAddressesQuery()
  const [placeOrder, { isLoading: placing }] = usePlaceOrderMutation()

  const [addressId, setAddressId] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [utr, setUtr] = useState('')
  const [utrError, setUtrError] = useState(null)
  const [showAddressForm, setShowAddressForm] = useState(false)
  // After success the cart refetches as empty; this stops the "empty cart → /cart" redirect from winning.
  const [placed, setPlaced] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  // One key per visit to the checkout page: retries / double clicks never create two orders.
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  if (cartLoading || addressesLoading || placed) {
    return (
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!cart?.items.length) return <Navigate to="/cart" replace />
  if (cart.summary.hasIssues) return <Navigate to="/cart" replace />

  const selectedAddressId = addressId ?? addresses.find((a) => a.isDefault)?._id ?? addresses[0]?._id

  async function submit() {
    if (!selectedAddressId) {
      toast.error('Add a delivery address first')
      return
    }
    if (paymentMethod === 'manual' && !/^[A-Za-z0-9]{6,30}$/.test(utr.trim())) {
      setUtrError('Enter the 6–30 character UTR / transaction reference from your payment app')
      return
    }

    try {
      const order = await placeOrder({
        addressId: selectedAddressId,
        paymentMethod,
        ...(paymentMethod === 'manual' ? { utr: utr.trim() } : {}),
        idempotencyKey,
      }).unwrap()
      setPlaced(true)
      navigate(`/my-orders/${order.orderNumber}`, { replace: true, state: { placed: true } })
    } catch (error) {
      if (error?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setVerifyOpen(true)
        return
      }
      if (error?.data?.code === 'COUPON_INVALID') {
        toast.error(`${getErrorMessage(error)} Remove or change the coupon in your cart.`)
        navigate('/cart')
        return
      }
      if (error?.data?.code === 'CART_CHANGED') {
        toast.error(getErrorMessage(error))
        navigate('/cart')
        return
      }
      const fields = getFieldErrors(error)
      if (fields.utr) setUtrError(fields.utr)
      if (error?.data?.code === 'UTR_USED') setUtrError(error.data.message)
      toast.error(getErrorMessage(error, 'Could not place the order'))
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Checkout</h1>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-5 lg:col-span-2">
          <Step
            number={1}
            title="Delivery address"
            icon={MapPin}
            action={
              addresses.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setShowAddressForm(true)}>
                  <Plus className="size-4" /> New address
                </Button>
              )
            }
          >
            {addresses.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-300 p-6 text-center">
                <p className="text-sm text-slate-600">You have no saved addresses yet.</p>
                <Button className="mt-3" onClick={() => setShowAddressForm(true)}>
                  <Plus className="size-4" /> Add address
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {addresses.map((address) => (
                  <ChoiceCard key={address._id} selected={address._id === selectedAddressId} onSelect={() => setAddressId(address._id)}>
                    <span className="mb-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 uppercase">
                      {address.type}
                    </span>
                    <AddressText address={address} />
                  </ChoiceCard>
                ))}
              </div>
            )}
          </Step>

          <Step number={2} title="Payment" icon={Lock}>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceCard selected={paymentMethod === 'cod'} onSelect={() => setPaymentMethod('cod')}>
                <Banknote className="mb-2 size-6 text-emerald-600" />
                <p className="font-semibold text-slate-900">Cash on Delivery</p>
                <p className="text-sm text-slate-500">Pay in cash when your order arrives.</p>
              </ChoiceCard>
              <ChoiceCard selected={paymentMethod === 'manual'} onSelect={() => setPaymentMethod('manual')}>
                <Smartphone className="mb-2 size-6 text-brand-600" />
                <p className="font-semibold text-slate-900">UPI / Bank transfer</p>
                <p className="text-sm text-slate-500">Pay now and enter the transaction reference.</p>
              </ChoiceCard>
            </div>

            {paymentMethod === 'manual' && (
              <div className="mt-4 space-y-4 rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-700">
                  Pay <span className="font-bold text-slate-900">{formatPrice(cart.summary.total)}</span> to UPI ID{' '}
                  <span className="font-mono font-semibold text-slate-900">{UPI_ID}</span> from any UPI app, then enter the
                  UTR / transaction ID below. Your order is confirmed once we verify the payment.
                </p>
                <Input
                  label="UTR / transaction reference"
                  placeholder="e.g. 412345678901"
                  value={utr}
                  onChange={(e) => {
                    setUtr(e.target.value)
                    setUtrError(null)
                  }}
                  error={utrError}
                  autoComplete="off"
                />
              </div>
            )}
          </Step>

          <Step number={3} title={`Review items (${cart.summary.itemCount})`}>
            <ul className="divide-y divide-slate-100">
              {cart.items.map((item) => (
                <li key={item._id} className="flex items-center gap-3 py-3">
                  <Thumb src={item.image} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.attributes.length > 0 && `${variantLabel(item.attributes)} · `}Qty {item.quantity} · {item.store?.storeName}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{formatPrice(item.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <Link to="/cart" className="mt-2 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
              Change items
            </Link>
          </Step>
        </div>

        <div className="lg:sticky lg:top-24">
          <OrderSummaryCard summary={cart.summary} coupon={cart.coupon}>
            <Button size="lg" fullWidth loading={placing} disabled={!selectedAddressId} onClick={submit}>
              {paymentMethod === 'cod' ? 'Place order' : 'I have paid, place order'}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
              <Lock className="size-3.5" /> Prices and stock are checked again when you place the order.
            </p>
          </OrderSummaryCard>
        </div>
      </div>

      <VerifyEmailModal open={verifyOpen} onClose={() => setVerifyOpen(false)} action="place your order" />

      {showAddressForm && (
        <AddressFormModal
          defaultName={user?.name}
          defaultPhone={user?.phone}
          onClose={() => setShowAddressForm(false)}
          onSaved={(saved) => setAddressId(saved._id)}
        />
      )}
    </div>
  )
}
