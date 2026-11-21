import Skeleton from '@/components/ui/Skeleton'
import { cn } from '@/utils/cn'
import ProductCard from './ProductCard'

const gridClasses = 'grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4'

export function ProductGridSkeleton({ count = 8, className }) {
  return (
    <div className={cn(gridClasses, className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ProductGrid({ products, className }) {
  return (
    <div className={cn(gridClasses, className)}>
      {products.map((product) => (
        <ProductCard key={product._id} product={product} />
      ))}
    </div>
  )
}
