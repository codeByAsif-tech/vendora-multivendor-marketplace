import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { cn } from '@/utils/cn'
import { formatPrice, RUPEE_PATTERN } from '@/utils/money'

function Section({ title, children }) {
  return (
    <div className="border-b border-slate-200 py-5 first:pt-0 last:border-b-0">
      <h3 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">{title}</h3>
      {children}
    </div>
  )
}

/** Local inputs; remounted (via key) when the URL values change, so no syncing effect is needed. */
function PriceFilter({ min, max, range, onApply }) {
  const [from, setFrom] = useState(min)
  const [to, setTo] = useState(max)
  const valid = (v) => v === '' || RUPEE_PATTERN.test(v)
  const canApply = valid(from) && valid(to) && (from === '' || to === '' || Number(from) <= Number(to))

  const input =
    'h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none'

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input className={input} inputMode="decimal" placeholder="Min ₹" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Minimum price" />
        <span className="text-slate-400">–</span>
        <input className={input} inputMode="decimal" placeholder="Max ₹" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Maximum price" />
      </div>
      {range?.max > 0 && (
        <p className="text-xs text-slate-500">
          Prices from {formatPrice(range.min)} to {formatPrice(range.max)}
        </p>
      )}
      <Button size="sm" variant="outline" fullWidth disabled={!canApply} onClick={() => onApply(from, to)}>
        Apply price
      </Button>
    </div>
  )
}

/**
 * Sidebar filters. `categories` (optional) shows category links on the all-products page.
 */
export default function FilterPanel({
  facets,
  selectedBrands,
  onToggleBrand,
  min,
  max,
  onPrice,
  inStock,
  onInStock,
  categories,
}) {
  return (
    <div>
      {categories?.length > 0 && (
        <Section title="Categories">
          <ul className="space-y-1.5 text-sm">
            {categories.map((category) => (
              <li key={category._id}>
                <Link to={`/categories/${category.slug}`} className="text-slate-700 hover:text-brand-700">
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Price">
        <PriceFilter key={`${min}-${max}`} min={min} max={max} range={facets?.priceRange} onApply={onPrice} />
      </Section>

      <Section title="Availability">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
          <input type="checkbox" className="size-4 accent-brand-600" checked={inStock} onChange={(e) => onInStock(e.target.checked)} />
          In stock only
        </label>
      </Section>

      {facets?.brands?.length > 0 && (
        <Section title="Brand">
          <BrandFilter brands={facets.brands} selected={selectedBrands} onToggle={onToggleBrand} />
        </Section>
      )}
    </div>
  )
}

const VISIBLE_BRANDS = 6
const SEARCH_FROM = 10

/**
 * Short list instead of a scrolling box: selected brands first, then the rest, 6 at a time
 * with "Show all". Long lists also get a search box.
 */
function BrandFilter({ brands, selected, onToggle }) {
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const ordered = [...brands.filter((b) => selected.includes(b)), ...brands.filter((b) => !selected.includes(b))]
  const matches = q ? ordered.filter((b) => b.toLowerCase().includes(q)) : ordered
  const shown = expanded || q ? matches : matches.slice(0, Math.max(VISIBLE_BRANDS, selected.length))
  const hiddenCount = matches.length - shown.length

  return (
    <div className="space-y-3">
      {brands.length >= SEARCH_FROM && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search brands"
          aria-label="Search brands"
          className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
        />
      )}
      <ul className="space-y-2">
        {shown.map((brand) => {
          const checked = selected.includes(brand)
          return (
            <li key={brand}>
              <label className={cn('flex cursor-pointer items-center gap-2.5 text-sm', checked ? 'font-medium text-slate-900' : 'text-slate-700')}>
                <input type="checkbox" className="size-4 shrink-0 accent-brand-600" checked={checked} onChange={() => onToggle(brand)} />
                <span className="truncate">{brand}</span>
              </label>
            </li>
          )
        })}
        {q && !matches.length && <li className="text-sm text-slate-500">No brand matches “{query}”</li>}
      </ul>
      {!q && (hiddenCount > 0 || expanded) && matches.length > VISIBLE_BRANDS && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-sm font-semibold text-brand-600 hover:text-brand-700"
          aria-expanded={expanded}
        >
          {expanded ? 'Show fewer' : `Show all ${matches.length} brands`}
        </button>
      )}
    </div>
  )
}
