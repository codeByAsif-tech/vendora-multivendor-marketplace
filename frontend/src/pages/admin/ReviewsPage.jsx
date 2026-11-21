import { useState } from 'react'
import { Eye, EyeOff, MessageSquareText, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import PageHeader from '@/components/common/PageHeader'
import ReasonDialog from '@/components/common/ReasonDialog'
import Thumb from '@/components/common/Thumb'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import SearchInput from '@/components/ui/SearchInput'
import Skeleton from '@/components/ui/Skeleton'
import Tabs from '@/components/ui/Tabs'
import { useGetAdminReviewsQuery, useModerateReviewMutation } from '@/features/admin/adminApi'
import { getErrorMessage } from '@/utils/apiError'
import { cn } from '@/utils/cn'
import { formatDateTime } from '@/utils/format'

const TABS = [
  { value: '', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'hidden', label: 'Hidden' },
]

export default function ReviewsPage() {
  const [filters, setFilters] = useState({ status: '', rating: '', search: '', page: 1 })
  const { data, isLoading, isFetching } = useGetAdminReviewsQuery({ ...filters, limit: 20 })
  const [moderate, { isLoading: saving }] = useModerateReviewMutation()
  const [hiding, setHiding] = useState(null)
  const update = (patch) => setFilters((f) => ({ ...f, page: 1, ...patch }))

  async function setStatus(review, status, reason) {
    try {
      const res = await moderate({ id: review._id, status, ...(reason ? { reason } : {}) }).unwrap()
      toast.success(res.message)
      setHiding(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <>
      <PageHeader title="Reviews" description="Every review is from a verified buyer. Hide reviews that break the guidelines (spam, abuse, personal details)." />
      <Card>
        <div className="border-b border-slate-200 px-4">
          <Tabs tabs={TABS.map((t) => ({ ...t, count: data?.counts?.[t.value || 'all'] }))} value={filters.status} onChange={(status) => update({ status })} />
        </div>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <SearchInput className="sm:max-w-xs sm:flex-1" placeholder="Product or review text" onSearch={(search) => update({ search })} />
          <select
            value={filters.rating}
            onChange={(e) => update({ rating: e.target.value })}
            aria-label="Filter by rating"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800"
          >
            <option value="">Any rating</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} star{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : !data?.items.length ? (
            <EmptyState icon={MessageSquareText} title="No reviews" description="Reviews appear here when customers rate products they received." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.items.map((review) => (
                <li key={review._id} className={cn('flex gap-4 p-4 sm:p-5', review.status === 'hidden' && 'bg-slate-50/70')}>
                  <Thumb src={review.product?.image} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {review.product?.slug ? (
                        <Link to={`/products/${review.product.slug}`} className="truncate text-sm font-semibold text-slate-900 hover:text-brand-700">
                          {review.product.name}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-slate-900">Deleted product</span>
                      )}
                      <span className="inline-flex items-center gap-0.5 text-sm font-medium text-amber-600">
                        {review.rating} <Star className="size-3.5 fill-amber-400 text-amber-400" />
                      </span>
                      {review.status === 'hidden' && <Badge tone="gray">Hidden</Badge>}
                    </div>
                    {review.title && <p className="mt-1 text-sm font-medium text-slate-800">{review.title}</p>}
                    {review.body && <p className="mt-1 line-clamp-3 text-sm text-slate-600">{review.body}</p>}
                    <p className="mt-1.5 text-xs text-slate-500">
                      {review.user?.name} ({review.user?.email}) · {review.store?.storeName} · {formatDateTime(review.createdAt)}
                    </p>
                    {review.hiddenReason && <p className="mt-1 text-xs text-rose-700">Hidden: {review.hiddenReason}</p>}
                  </div>
                  <div className="shrink-0">
                    {review.status === 'published' ? (
                      <Button size="sm" variant="outline" onClick={() => setHiding(review)}>
                        <EyeOff className="size-4" /> Hide
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setStatus(review, 'published')} disabled={saving}>
                        <Eye className="size-4" /> Publish
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Pagination pagination={data?.pagination} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} />
      </Card>

      {hiding && (
        <ReasonDialog
          open
          onClose={() => setHiding(null)}
          loading={saving}
          title="Hide this review?"
          description="It stops showing on the product and no longer counts in the rating. The customer is told why."
          confirmLabel="Hide review"
          placeholder="e.g. Contains a phone number / not about the product"
          onConfirm={(reason) => setStatus(hiding, 'hidden', reason)}
        />
      )}
    </>
  )
}
