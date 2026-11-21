import { useSearchParams } from 'react-router-dom'
import Breadcrumbs from '@/components/catalog/Breadcrumbs'
import ProductBrowser from '@/components/catalog/ProductBrowser'
import { useGetCategoryTreeQuery } from '@/features/catalog/catalogApi'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function ProductListPage() {
  const [params] = useSearchParams()
  const q = params.get('q')
  const { data: categories = [] } = useGetCategoryTreeQuery()
  const title = q ? `Results for “${q}”` : 'All products'
  useDocumentTitle(title)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: q ? 'Search' : 'All products' }]} />
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
      <ProductBrowser categories={categories} />
    </div>
  )
}
