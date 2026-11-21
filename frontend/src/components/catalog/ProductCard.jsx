import { ImageOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import PriceTag from './PriceTag'
import RatingStars from './RatingStars'

export default function ProductCard({ product }) {
  const [cover, hover] = product.images ?? []
  const outOfStock = product.totalStock <= 0

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-elevated"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-50">
        {cover ? (
          <>
            <img
              src={cover.url}
              alt={product.name}
              loading="lazy"
              className="size-full object-cover transition duration-300 group-hover:scale-105"
            />
            {hover && (
              <img
                src={hover.url}
                alt=""
                loading="lazy"
                className="absolute inset-0 size-full object-cover opacity-0 transition duration-300 group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          <div className="flex size-full items-center justify-center">
            <ImageOff className="size-8 text-slate-300" />
          </div>
        )}
        {product.maxDiscount > 0 && (
          <span className="absolute top-3 left-3 rounded-md bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
            {product.maxDiscount}% OFF
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-x-0 bottom-0 bg-slate-900/80 py-1.5 text-center text-xs font-semibold text-white">
            Out of stock
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="truncate text-xs font-medium tracking-wide text-slate-500 uppercase">
          {product.brand || product.store?.storeName}
        </p>
        <h3 className="line-clamp-2 min-h-10 text-sm font-medium text-slate-900 group-hover:text-brand-700">
          {product.name}
        </h3>
        <RatingStars value={product.ratingAvg} count={product.ratingCount} />
        <PriceTag price={product.minPrice} compareAt={product.compareAtPrice} className="mt-auto pt-1" />
        {product.maxPrice > product.minPrice && <p className="text-xs text-slate-500">More options available</p>}
      </div>
    </Link>
  )
}
