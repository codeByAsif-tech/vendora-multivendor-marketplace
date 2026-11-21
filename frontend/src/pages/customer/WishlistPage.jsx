import { Heart, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ProductCard from '@/components/catalog/ProductCard'
import { ProductGridSkeleton } from '@/components/catalog/ProductGrid'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import { useGetWishlistQuery, useRemoveFromWishlistMutation } from '@/features/shop/shopApi'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { getErrorMessage } from '@/utils/apiError'

export default function WishlistPage() {
  useDocumentTitle('Wishlist')
  const { data, isLoading } = useGetWishlistQuery()
  const [removeFromWishlist] = useRemoveFromWishlistMutation()

  async function remove(product) {
    try {
      await removeFromWishlist(product._id).unwrap()
      toast.success('Removed from wishlist')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Wishlist</h1>

      {isLoading ? (
        <ProductGridSkeleton count={4} />
      ) : !data?.items.length ? (
        <Card>
          <EmptyState
            icon={Heart}
            title="Your wishlist is empty"
            description="Tap the heart on a product to save it for later."
            action={<Button to="/products">Browse products</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
          {data.items.map((product) => (
            <div key={product._id} className="relative">
              <ProductCard product={product} />
              <button
                type="button"
                onClick={() => remove(product)}
                className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm hover:text-rose-600"
                aria-label={`Remove ${product.name} from wishlist`}
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
