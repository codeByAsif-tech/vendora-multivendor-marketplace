import { Link, useParams } from 'react-router-dom'
import Breadcrumbs from '@/components/catalog/Breadcrumbs'
import ProductBrowser from '@/components/catalog/ProductBrowser'
import Skeleton from '@/components/ui/Skeleton'
import { useGetCategoryQuery } from '@/features/catalog/catalogApi'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import NotFoundPage from '@/pages/common/NotFoundPage'
import { cn } from '@/utils/cn'

function CategoryChip({ to, active, children }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-full border px-4 py-1.5 text-sm font-medium transition',
        active
          ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700',
      )}
    >
      {children}
    </Link>
  )
}

export default function CategoryPage() {
  const { slug } = useParams()
  const { data: category, isLoading, isError } = useGetCategoryQuery(slug)
  // On a subcategory page, load the parent too so the same subcategory row stays visible.
  const parentSlug = category?.parent?.slug
  const { data: parent } = useGetCategoryQuery(parentSlug, { skip: !parentSlug })
  useDocumentTitle(category?.name)

  if (isError) return <NotFoundPage />

  const top = parentSlug ? parent : category
  const subcategories = top?.children ?? []

  const crumbs = [{ label: 'Home', to: '/' }, { label: 'All products', to: '/products' }]
  if (category?.parent) crumbs.push({ label: category.parent.name, to: `/categories/${category.parent.slug}` })
  crumbs.push({ label: category?.name ?? '…' })

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={crumbs} />

      {isLoading ? (
        <Skeleton className="mb-6 h-9 w-64" />
      ) : (
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{category.name}</h1>
          {category.description && <p className="mt-2 max-w-3xl text-slate-500">{category.description}</p>}
          {subcategories.length > 0 && (
            <nav aria-label="Subcategories" className="mt-5 flex flex-wrap gap-2">
              <CategoryChip to={`/categories/${top.slug}`} active={!parentSlug}>
                All
              </CategoryChip>
              {subcategories.map((child) => (
                <CategoryChip key={child._id} to={`/categories/${child.slug}`} active={child.slug === slug}>
                  {child.name}
                </CategoryChip>
              ))}
            </nav>
          )}
        </div>
      )}

      {/* Not keyed by slug on purpose: the current products stay visible (faded) while the next
          category loads, so the page height and footer do not jump. Filters live in the URL. */}
      <ProductBrowser scope={{ category: slug }} />
    </div>
  )
}
