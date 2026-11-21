import { MapPin, Package, Store as StoreIcon } from 'lucide-react'
import { useParams } from 'react-router-dom'
import Breadcrumbs from '@/components/catalog/Breadcrumbs'
import ProductBrowser from '@/components/catalog/ProductBrowser'
import Skeleton from '@/components/ui/Skeleton'
import { useGetStoreQuery } from '@/features/catalog/catalogApi'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import NotFoundPage from '@/pages/common/NotFoundPage'
import { formatDate, formatNumber, initials } from '@/utils/format'

export default function StorePage() {
  const { slug } = useParams()
  const { data: store, isLoading, isError } = useGetStoreQuery(slug)
  useDocumentTitle(store?.storeName)

  if (isError) return <NotFoundPage />

  const location = [store?.pickupAddress?.city, store?.pickupAddress?.state].filter(Boolean).join(', ')

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Stores' }, { label: store?.storeName ?? '…' }]} />

      {isLoading ? (
        <Skeleton className="mb-8 h-56 w-full rounded-2xl" />
      ) : (
        <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
          {/* Same 4:1 shape as the banner preview in Store settings, so the whole banner shows at any width. */}
          <div className="relative aspect-[4/1] min-h-28 bg-brand-200">
            {store.banner?.url && <img src={store.banner.url} alt="" className="size-full object-cover" />}
          </div>
          <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
            <span className="relative z-10 -mt-10 flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-brand-50 text-2xl font-bold text-brand-700 shadow-sm">
              {store.logo?.url ? <img src={store.logo.url} alt="" className="size-full object-cover" /> : initials(store.storeName)}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{store.storeName}</h1>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Package className="size-4" /> {formatNumber(store.productCount)} products
                </span>
                {location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" /> {location}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <StoreIcon className="size-4" /> Selling since {formatDate(store.createdAt)}
                </span>
              </div>
            </div>
          </div>
          {store.description && <p className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600">{store.description}</p>}
        </section>
      )}

      <ProductBrowser scope={{ store: slug }} />
    </div>
  )
}
