import { useState } from 'react'
import { SearchX, SlidersHorizontal, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import Pagination from '@/components/ui/Pagination'
import { useGetProductsQuery } from '@/features/catalog/catalogApi'
import { formatNumber } from '@/utils/format'
import { RUPEE_PATTERN, rupeesToPaise } from '@/utils/money'
import FilterPanel from './FilterPanel'
import ProductGrid, { ProductGridSkeleton } from './ProductGrid'

const SORTS = [
  { value: 'relevance', label: 'Best match', searchOnly: true },
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Popular' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'discount', label: 'Biggest discount' },
  { value: 'rating', label: 'Top rated' },
]

const PAGE_SIZE = 24

/**
 * Product listing with filters. All filter state lives in the URL (?q=&brand=&min=&max=&inStock=1&sort=&page=)
 * so results can be shared, bookmarked and navigated with the back button.
 * `scope` fixes the category or store: { category: 'fashion' } or { store: 'urban-threads' }.
 */
export default function ProductBrowser({ scope = {}, categories }) {
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const q = params.get('q') ?? ''
  const brands = (params.get('brand') ?? '').split(',').filter(Boolean)
  const min = params.get('min') ?? ''
  const max = params.get('max') ?? ''
  const inStock = params.get('inStock') === '1'
  const sort = params.get('sort') ?? (q ? 'relevance' : 'newest')
  const page = Math.max(1, Number(params.get('page')) || 1)

  const { data, isLoading, isFetching, isError, refetch } = useGetProductsQuery({
    ...scope,
    search: q,
    brand: brands.join(','),
    minPrice: RUPEE_PATTERN.test(min) ? rupeesToPaise(min) : '',
    maxPrice: RUPEE_PATTERN.test(max) ? rupeesToPaise(max) : '',
    inStock: inStock ? 'true' : '',
    sort,
    page,
    limit: PAGE_SIZE,
  })

  /** Updates URL params; any filter change goes back to page 1. */
  function update(patch) {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
    if (!('page' in patch)) next.delete('page')
    setParams(next)
  }

  const toggleBrand = (brand) =>
    update({ brand: (brands.includes(brand) ? brands.filter((b) => b !== brand) : [...brands, brand]).join(',') })

  const goToPage = (nextPage) => {
    update({ page: nextPage > 1 ? String(nextPage) : '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const chips = [
    q && { key: 'q', label: `“${q}”`, clear: { q: '' } },
    ...brands.map((b) => ({ key: `brand-${b}`, label: b, clear: { brand: brands.filter((x) => x !== b).join(',') } })),
    (min || max) && { key: 'price', label: `₹${min || '0'} – ${max ? `₹${max}` : 'any'}`, clear: { min: '', max: '' } },
    inStock && { key: 'stock', label: 'In stock', clear: { inStock: '' } },
  ].filter(Boolean)

  const filterPanel = (
    <FilterPanel
      facets={data?.facets}
      selectedBrands={brands}
      onToggleBrand={toggleBrand}
      min={min}
      max={max}
      onPrice={(from, to) => update({ min: from, max: to })}
      inStock={inStock}
      onInStock={(checked) => update({ inStock: checked ? '1' : '' })}
      categories={categories}
    />
  )

  const total = data?.pagination?.total ?? 0

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-24">{filterPanel}</div>
      </aside>

      <div className="min-w-0">
        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal className="size-4" /> Filters
          </Button>
          <p className="text-sm text-slate-500">
            {isLoading ? 'Loading…' : `${formatNumber(total)} product${total === 1 ? '' : 's'}`}
          </p>
          <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
            <span className="hidden sm:inline">Sort by</span>
            <select
              value={sort}
              onChange={(e) => update({ sort: e.target.value })}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
            >
              {SORTS.filter((s) => !s.searchOnly || q).map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {chips.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => update(chip.clear)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 hover:border-slate-300"
              >
                {chip.label} <X className="size-3.5 text-slate-400" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => update({ q: '', brand: '', min: '', max: '', inStock: '' })}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Clear all
            </button>
          </div>
        )}

        {/* min-height keeps the footer from jumping when a page has few or no results */}
        <div
          aria-busy={isFetching}
          className={`min-h-[60vh] transition-opacity duration-200 ${isFetching && !isLoading ? 'pointer-events-none opacity-60' : ''}`}
        >
          {isLoading ? (
            <ProductGridSkeleton />
          ) : isError ? (
            <Card>
              <EmptyState
                title="Could not load products"
                description="Please check your connection and try again."
                action={<Button onClick={refetch}>Try again</Button>}
              />
            </Card>
          ) : data.items.length === 0 ? (
            <Card>
              <EmptyState
                icon={SearchX}
                title="No products found"
                description={chips.length ? 'Try removing some filters or searching for something else.' : 'Nothing here yet. Check back soon.'}
                action={
                  chips.length > 0 && (
                    <Button variant="outline" onClick={() => update({ q: '', brand: '', min: '', max: '', inStock: '' })}>
                      Clear filters
                    </Button>
                  )
                }
              />
            </Card>
          ) : (
            <>
              <ProductGrid products={data.items} />
              <Card className="mt-6">
                <Pagination pagination={data.pagination} onPageChange={goToPage} />
              </Card>
            </>
          )}
        </div>
      </div>

      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        footer={<Button onClick={() => setFiltersOpen(false)}>Show {formatNumber(total)} products</Button>}
      >
        {filterPanel}
      </Modal>
    </div>
  )
}
