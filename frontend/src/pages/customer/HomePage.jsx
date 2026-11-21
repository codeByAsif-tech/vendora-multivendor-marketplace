import { ArrowRight, BadgeCheck, RotateCcw, ShieldCheck, Store, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import ProductGrid, { ProductGridSkeleton } from '@/components/catalog/ProductGrid'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import { useGetCategoryTreeQuery, useGetProductsQuery } from '@/features/catalog/catalogApi'

/**
 * Hero banner photo. To use your own: put a wide image (about 2000×900) in
 * frontend/public/images/hero-banner.jpg and change this to '/images/hero-banner.jpg'.
 */
const HERO_BANNER = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=2000&q=80'

const perks = [
  { icon: ShieldCheck, title: 'Secure checkout', text: 'Your payment details stay protected' },
  { icon: BadgeCheck, title: 'Verified sellers', text: 'Every store is reviewed' },
  { icon: Truck, title: 'Fast delivery', text: 'Track every order live' },
  { icon: RotateCcw, title: 'Easy returns', text: 'Hassle-free refunds' },
]

export default function HomePage() {
  return (
    <>
      <section
        className="keep-colors relative bg-slate-900 bg-cover bg-center"
        style={{ backgroundImage: `url(${HERO_BANNER})` }}
      >
        {/* Dark scrim so the text stays readable on any photo */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(90deg, rgba(30,30,36,0.88) 0%, rgba(30,30,36,0.6) 55%, rgba(30,30,36,0.25) 100%)' }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/30">
              Independent sellers · one checkout
            </span>
            <h1 className="mt-6 text-4xl leading-[1.1] text-white sm:text-5xl lg:text-[3.5rem]">
              Good things, from people who make them.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-white/85">
              Clothing, home goods, gadgets and more from verified small businesses. Fill one cart, pay once, and track
              every parcel.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/products" size="lg">
                Start shopping <ArrowRight className="size-4" />
              </Button>
              <Button to="/seller/register" size="lg" variant="glass">
                <Store className="size-4" /> Sell with us
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-4 lg:px-8">
          {perks.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="text-xs text-slate-500">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <ShopByCategory />
      <ProductRail title="New arrivals" query={{ sort: 'newest' }} link="/products?sort=newest" />
      <ProductRail title="Best deals" query={{ sort: 'discount' }} link="/products?sort=discount" onlyDeals />
    </>
  )
}

function SectionHeader({ title, link }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 className="text-2xl text-slate-900 sm:text-3xl">{title}</h2>
      {link && (
        <Link to={link} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
          View all <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  )
}

function ShopByCategory() {
  const { data: categories = [], isLoading } = useGetCategoryTreeQuery()
  if (!isLoading && categories.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8">
      <SectionHeader title="Shop by category" link="/products" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {isLoading
          ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          : categories.slice(0, 12).map((category) => (
              <Link
                key={category._id}
                to={`/categories/${category.slug}`}
                className="group flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-card transition hover:-translate-y-0.5 hover:border-brand-300"
              >
                <span className="flex size-14 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-lg font-bold text-brand-700">
                  {category.image?.url ? (
                    <img src={category.image.url} alt="" className="size-full object-cover" />
                  ) : (
                    category.name.charAt(0)
                  )}
                </span>
                <span className="text-sm font-medium text-slate-800 group-hover:text-brand-700">{category.name}</span>
              </Link>
            ))}
      </div>
    </section>
  )
}

const NEW_ARRIVALS = { sort: 'newest', limit: 8 }

function ProductRail({ title, query, link, onlyDeals = false }) {
  // Deals fetch extra so there are still 8 left after skipping what "New arrivals" already shows.
  const { data, isLoading: listLoading } = useGetProductsQuery({ ...query, limit: onlyDeals ? 16 : 8 })
  // Same arguments as the "New arrivals" rail, so this reuses its cached result (no extra request).
  const { data: newest, isLoading: newestLoading } = useGetProductsQuery(NEW_ARRIVALS, { skip: !onlyDeals })
  const isLoading = listLoading || (onlyDeals && newestLoading)

  const shownAbove = new Set(onlyDeals ? (newest?.items ?? []).map((p) => p._id) : [])
  const items = (data?.items ?? [])
    .filter((p) => !onlyDeals || (p.maxDiscount > 0 && !shownAbove.has(p._id)))
    .slice(0, 8)

  if (!isLoading && items.length === 0) {
    if (onlyDeals) return null
    return (
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionHeader title={title} />
        <Card>
          <EmptyState title="Products are on their way" description="The catalog opens once sellers start listing. Check back soon." />
        </Card>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pt-14 last:pb-14 sm:px-6 lg:px-8">
      <SectionHeader title={title} link={link} />
      {isLoading ? <ProductGridSkeleton count={4} /> : <ProductGrid products={items} />}
    </section>
  )
}
