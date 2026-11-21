import { useState } from 'react'
import { BadgeCheck, Heart, Minus, Plus, RotateCcw, ShieldCheck, ShoppingCart, Store, Truck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Breadcrumbs from '@/components/catalog/Breadcrumbs'
import PriceTag from '@/components/catalog/PriceTag'
import ProductGrid from '@/components/catalog/ProductGrid'
import ProductReviews from '@/components/catalog/ProductReviews'
import RatingStars from '@/components/catalog/RatingStars'
import { findVariant, initialSelection, selectValue, valueState } from '@/components/catalog/variantSelection'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { useGetProductQuery } from '@/features/catalog/catalogApi'
import { useShopActions } from '@/features/shop/useShopActions'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import NotFoundPage from '@/pages/common/NotFoundPage'
import { cn } from '@/utils/cn'
import { initials } from '@/utils/format'
import { hasSale } from './productDetail'

const MAX_QTY = 10

function Gallery({ images, name }) {
  const [active, setActive] = useState(0)
  const current = images[active] ?? images[0]

  return (
    <div className="flex flex-col gap-3 md:sticky md:top-24">
      <div className="aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {current && <img src={current.url} alt={name} className="size-full object-contain" />}
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {images.map((image, index) => (
            <button
              key={image.publicId}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Show image ${index + 1}`}
              className={cn(
                'aspect-square overflow-hidden rounded-lg border-2 bg-white transition',
                index === active ? 'border-brand-500' : 'border-transparent opacity-70 hover:opacity-100',
              )}
            >
              <img src={image.url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function OptionPicker({ option, variants, selection, onSelect }) {
  return (
    <div>
      <p className="mb-2 text-sm text-slate-600">
        {option.name}: <span className="font-semibold text-slate-900">{selection[option.name] ?? 'Choose'}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {option.values.map((value) => {
          const state = valueState(variants, selection, option.name, value)
          const selected = selection[option.name] === value
          if (state === 'none') return null
          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(option.name, value)}
              aria-pressed={selected}
              title={state === 'soldout' ? 'Out of stock' : undefined}
              className={cn(
                'min-w-12 rounded-lg border px-3.5 py-2 text-sm font-medium transition',
                selected
                  ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400',
                state === 'soldout' && 'text-slate-400 line-through',
                state === 'switch' && !selected && 'border-dashed',
              )}
            >
              {value}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StockNote({ variant }) {
  if (!variant) return <p className="text-sm font-medium text-rose-600">This combination is not available</p>
  if (variant.stock <= 0) return <p className="text-sm font-medium text-rose-600">Out of stock</p>
  if (variant.stock <= (variant.lowStockThreshold || 5)) {
    return <p className="text-sm font-medium text-amber-600">Only {variant.stock} left. Order soon!</p>
  }
  return <p className="text-sm font-medium text-emerald-600">In stock</p>
}

function ProductDetail({ product, related }) {
  const variants = product.variants
  const [selection, setSelection] = useState(() => initialSelection(variants))
  const [quantity, setQuantity] = useState(1)

  const variant = findVariant(variants, selection)
  const maxQty = Math.max(1, Math.min(variant?.stock ?? 0, MAX_QTY))
  const qty = Math.min(quantity, maxQty)
  const canBuy = Boolean(variant && variant.stock > 0)
  const price = variant ? (hasSale(variant) ? variant.salePrice : variant.price) : product.minPrice
  const compareAt = variant && hasSale(variant) ? variant.price : null

  const category = product.category
  const crumbs = [{ label: 'Home', to: '/' }]
  if (category?.parent) crumbs.push({ label: category.parent.name, to: `/categories/${category.parent.slug}` })
  if (category) crumbs.push({ label: category.name, to: `/categories/${category.slug}` })
  crumbs.push({ label: product.name })

  const { addToCart, addingToCart, toggleWishlist, isWishlisted, wishlistBusy } = useShopActions()
  const wishlisted = isWishlisted(product._id)
  const buy = (goToCart) => addToCart({ productId: product._id, variantId: variant._id, quantity: qty, goToCart })

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={crumbs} />

      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        <Gallery images={product.images} name={product.name} />

        <div className="space-y-6">
          <div>
            {product.brand && <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">{product.brand}</p>}
            <h1 className="mt-1 text-2xl leading-tight font-bold tracking-tight text-slate-900 sm:text-3xl">{product.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <a href="#reviews" className="hover:opacity-80">
                <RatingStars value={product.ratingAvg} count={product.ratingCount} />
              </a>
              <Link to={`/stores/${product.store.slug}`} className="inline-flex items-center gap-1.5 text-slate-600 hover:text-brand-700">
                <Store className="size-4" /> Sold by <span className="font-medium">{product.store.storeName}</span>
              </Link>
            </div>
          </div>

          <div className="space-y-1 border-y border-slate-200 py-5">
            <PriceTag price={price} compareAt={compareAt} size="lg" />
            <p className="text-xs text-slate-500">Inclusive of all taxes</p>
          </div>

          {product.variantOptions.length > 0 && (
            <div className="space-y-5">
              {product.variantOptions.map((option) => (
                <OptionPicker
                  key={option.name}
                  option={option}
                  variants={variants}
                  selection={selection}
                  onSelect={(name, value) => setSelection(selectValue(variants, selection, name, value))}
                />
              ))}
            </div>
          )}

          <div className="space-y-4">
            <StockNote variant={variant} />
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, qty - 1))}
                  disabled={!canBuy || qty <= 1}
                  className="flex size-11 items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-40"
                  aria-label="Decrease quantity"
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-10 text-center text-sm font-semibold text-slate-900" aria-live="polite">
                  {canBuy ? qty : 0}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(maxQty, qty + 1))}
                  disabled={!canBuy || qty >= maxQty}
                  className="flex size-11 items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-40"
                  aria-label="Increase quantity"
                >
                  <Plus className="size-4" />
                </button>
              </div>
              <Button size="lg" className="flex-1 sm:flex-none sm:px-8" disabled={!canBuy} loading={addingToCart} onClick={() => buy(false)}>
                <ShoppingCart className="size-5" /> Add to cart
              </Button>
              <Button size="lg" variant="secondary" className="flex-1 sm:flex-none sm:px-8" disabled={!canBuy || addingToCart} onClick={() => buy(true)}>
                Buy now
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => toggleWishlist(product._id)}
                disabled={wishlistBusy}
                aria-pressed={wishlisted}
                aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <Heart className={cn('size-5', wishlisted && 'fill-rose-500 text-rose-500')} />
              </Button>
            </div>
            {variant && <p className="text-xs text-slate-400">SKU: {variant.sku}</p>}
          </div>

          {product.highlights?.length > 0 && (
            <ul className="space-y-2">
              {product.highlights.map((highlight) => (
                <li key={highlight} className="flex items-start gap-2 text-sm text-slate-700">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  {highlight}
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-100/70 p-4 text-center text-xs text-slate-600">
            <div className="flex flex-col items-center gap-1.5">
              <Truck className="size-5 text-brand-600" /> Fast delivery
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <RotateCcw className="size-5 text-brand-600" /> Easy returns
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <ShieldCheck className="size-5 text-brand-600" /> Secure checkout
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        <section className="space-y-8 lg:col-span-2">
          <div>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Description</h2>
            <p className="leading-relaxed whitespace-pre-line text-slate-700">{product.description}</p>
          </div>
          {product.specifications?.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Specifications</h2>
              <dl className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
                {product.specifications.map((spec) => (
                  <div key={`${spec.key}-${spec.value}`} className="grid grid-cols-3 gap-4 px-4 py-3">
                    <dt className="text-slate-500">{spec.key}</dt>
                    <dd className="col-span-2 text-slate-900">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <ProductReviews slug={product.slug} />
        </section>

        <aside>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <p className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">Sold by</p>
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-50 font-bold text-brand-700">
                {product.store.logo?.url ? (
                  <img src={product.store.logo.url} alt="" className="size-full object-cover" />
                ) : (
                  initials(product.store.storeName)
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{product.store.storeName}</p>
                {product.store.pickupAddress?.city && (
                  <p className="text-xs text-slate-500">
                    {product.store.pickupAddress.city}, {product.store.pickupAddress.state}
                  </p>
                )}
              </div>
            </div>
            <Button to={`/stores/${product.store.slug}`} variant="outline" fullWidth className="mt-4">
              Visit store
            </Button>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 text-xl font-bold tracking-tight text-slate-900">You may also like</h2>
          <ProductGrid products={related.slice(0, 4)} />
        </section>
      )}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-2 lg:gap-12 lg:px-8">
      <Skeleton className="aspect-square w-full rounded-2xl" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}

export default function ProductDetailPage() {
  const { slug } = useParams()
  const { data, isLoading, isError } = useGetProductQuery(slug)
  useDocumentTitle(data?.product?.name)

  if (isLoading) return <DetailSkeleton />
  if (isError || !data) return <NotFoundPage />
  // key: reset the selected variant and quantity when navigating to another product
  return <ProductDetail key={data.product._id} product={data.product} related={data.related} />
}
