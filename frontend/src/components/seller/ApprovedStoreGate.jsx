import Skeleton from '@/components/ui/Skeleton'
import { useGetMyStoreQuery } from '@/features/seller/sellerApi'
import StoreStatusBanner from './StoreStatusBanner'

/** Renders children only for approved stores; otherwise explains what to do next. */
export default function ApprovedStoreGate({ children }) {
  const { data: store, isLoading } = useGetMyStoreQuery()

  if (isLoading) return <Skeleton className="h-28 w-full rounded-xl" />
  if (store?.status === 'approved') return children
  return <StoreStatusBanner store={store} />
}
