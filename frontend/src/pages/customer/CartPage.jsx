import { AlertTriangle, ShoppingCart, Store, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import Thumb from '@/components/common/Thumb'
import PriceTag from '@/components/catalog/PriceTag'
import CouponBox from '@/components/shop/CouponBox'
import OrderSummaryCard from '@/components/shop/OrderSummaryCard'
import QuantityStepper from '@/components/shop/QuantityStepper'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import { useGetCartQuery, useRemoveCartItemMutation, useUpdateCartItemMutation } from '@/features/shop/shopApi'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { getErrorMessage } from '@/utils/apiError'
import { cn } from '@/utils/cn'
import { formatPrice } from '@/utils/money'
import { variantLabel } from '@/utils/stock'

function CartLine({ item }) {
  const [updateItem, updateState] = useUpdateCartItemMutation()
  const [removeItem, removeState] = useRemoveCartItemMutation()
  const blocked = item.issue === 'unavailable' || item.issue === 'out_of_stock'

  async function changeQuantity(quantity) {
    try {
      await updateItem({ itemId: item._id, quantity }).unwrap()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function remove() {
    try {
      await removeItem(item._id).unwrap()
      toast.success('Removed from cart')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <li className={cn('flex gap-4 py-5', blocked && 'opacity-70')}>
      <Link to={item.slug ? `/products/${item.slug}` : '#'} className="shrink-0">
        <Thumb src={item.image} className="size-20 sm:size-24" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:justify-between">
        <div className="min-w-0 space-y-1">
          {item.slug ? (
            <Link to={`/products/${item.slug}`} className="line-clamp-2 font-medium text-slate-900 hover:text-brand-700">
              {item.name}
            </Link>
          ) : (
            <p className="font-medium text-slate-900">{item.name}</p>
          )}
          {item.attributes.length > 0 && <p className="text-sm text-slate-500">{variantLabel(item.attributes)}</p>}
          {item.issue && (
            <p className={cn('flex items-center gap-1.5 text-sm font-medium', blocked ? 'text-rose-600' : 'text-amber-600')}>
              <AlertTriangle className="size-4" /> {item.issueMessage}
            </p>
          )}
          {!blocked && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <QuantityStepper
                size="sm"
                value={item.quantity}
                max={item.maxQuantity}
                onChange={changeQuantity}
                disabled={updateState.isLoading}
              />
              {item.stock <= 5 && <span className="text-xs text-amber-600">Only {item.stock} left</span>}
            </div>
          )}
        </div>
        <div className="flex items-start justify-between gap-4 sm:flex-col sm:items-end">
          {blocked ? (
            <span className="text-sm text-slate-400">—</span>
          ) : (
            <div className="text-right">
              <p className="font-semibold text-slate-900">{formatPrice(item.lineTotal)}</p>
              {item.quantity > 1 && <PriceTag price={item.unitPrice} compareAt={item.compareAtPrice} className="justify-end text-xs" />}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={remove} loading={removeState.isLoading} aria-label={`Remove ${item.name}`}>
            <Trash2 className="size-4" /> <span className="sm:hidden">Remove</span>
          </Button>
        </div>
      </div>
    </li>
  )
}

export default function CartPage() {
  useDocumentTitle('Your cart')
  const { data: cart, isLoading } = useGetCartQuery()

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">
        <Skeleton className="h-96 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const items = cart?.items ?? []
  if (!items.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Card>
          <EmptyState
            icon={ShoppingCart}
            title="Your cart is empty"
            description="Find something you love and add it here."
            action={<Button to="/products">Start shopping</Button>}
          />
        </Card>
      </div>
    )
  }

  // Group lines by store so customers see they arrive in separate parcels.
  const groups = []
  for (const item of items) {
    const key = item.store?._id ?? 'unavailable'
    let group = groups.find((g) => g.key === key)
    if (!group) {
      group = { key, store: item.store, items: [] }
      groups.push(group)
    }
    group.items.push(item)
  }
  const shipmentFor = (storeId) => cart.shipments.find((s) => s.store._id === storeId)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Shopping cart</h1>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
          {groups.map((group) => {
            const shipment = group.store ? shipmentFor(group.store._id) : null
            return (
              <Card key={group.key} className="px-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-3 text-sm">
                  {group.store ? (
                    <Link to={`/stores/${group.store.slug}`} className="inline-flex items-center gap-2 font-medium text-slate-800 hover:text-brand-700">
                      <Store className="size-4 text-slate-400" /> Sold by {group.store.storeName}
                    </Link>
                  ) : (
                    <span className="font-medium text-slate-500">Unavailable items</span>
                  )}
                  {shipment && (
                    <span className={shipment.shippingFee === 0 ? 'text-emerald-600' : 'text-slate-500'}>
                      {shipment.shippingFee === 0
                        ? cart.summary.firstOrderFreeDelivery
                          ? 'Free delivery (first order)'
                          : 'Free delivery'
                        : `Delivery ${formatPrice(shipment.shippingFee)} · free above ${formatPrice(cart.summary.shippingRule?.freeThreshold ?? 49900)}`}
                    </span>
                  )}
                </div>
                <ul className="divide-y divide-slate-100">
                  {group.items.map((item) => (
                    <CartLine key={item._id} item={item} />
                  ))}
                </ul>
              </Card>
            )
          })}
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <CouponBox coupon={cart.coupon} />
          <OrderSummaryCard summary={cart.summary} coupon={cart.coupon}>
            {cart.summary.hasIssues && (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Remove unavailable items to continue.
              </p>
            )}
            <Button to={cart.summary.hasIssues ? undefined : '/checkout'} size="lg" fullWidth disabled={cart.summary.hasIssues}>
              Proceed to checkout
            </Button>
            <Link to="/products" className="mt-3 block text-center text-sm font-medium text-brand-600 hover:text-brand-700">
              Continue shopping
            </Link>
          </OrderSummaryCard>
        </div>
      </div>
    </div>
  )
}
