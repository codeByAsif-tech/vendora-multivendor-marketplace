import { useState } from 'react'
import { BadgeCheck, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import Pagination from '@/components/ui/Pagination'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Skeleton from '@/components/ui/Skeleton'
import Textarea from '@/components/ui/Textarea'
import { useAuth } from '@/features/auth/useAuth'
import {
  useDeleteMyReviewMutation,
  useGetMyReviewQuery,
  useGetProductReviewsQuery,
  useSaveMyReviewMutation,
} from '@/features/shop/shopApi'
import { getErrorMessage } from '@/utils/apiError'
import { cn } from '@/utils/cn'
import { formatDate } from '@/utils/format'
import { ROLES } from '@/utils/roles'

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'highest', label: 'Highest rated' },
  { value: 'lowest', label: 'Lowest rated' },
]

function Stars({ value, className = 'size-4' }) {
  return (
    <span className="flex" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(className, i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
      ))}
    </span>
  )
}

/** Clickable 1–5 star input (radio group, keyboard friendly). */
function StarInput({ value, onChange }) {
  const [hover, setHover] = useState(0)
  const labels = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent']
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="Your rating" className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}: ${labels[n - 1]}`}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            className="rounded p-0.5"
          >
            <Star className={cn('size-7 transition', n <= (hover || value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
          </button>
        ))}
      </div>
      <span className="text-sm text-slate-600">{labels[(hover || value) - 1] ?? 'Tap to rate'}</span>
    </div>
  )
}

/** Remounted (key) when the saved review changes, so the form starts from it. */
function ReviewForm({ slug, existing, onDone }) {
  const [save, { isLoading }] = useSaveMyReviewMutation()
  const [remove, { isLoading: deleting }] = useDeleteMyReviewMutation()
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [body, setBody] = useState(existing?.body ?? '')

  async function submit(event) {
    event.preventDefault()
    try {
      const res = await save({ slug, rating, ...(title.trim() ? { title: title.trim() } : {}), ...(body.trim() ? { body: body.trim() } : {}) }).unwrap()
      toast.success(res.message)
      onDone()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function handleDelete() {
    try {
      await remove(slug).unwrap()
      toast.success('Review deleted')
      onDone()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <StarInput value={rating} onChange={setRating} />
      <Input label="Title (optional)" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sum it up in a few words" />
      <Textarea label="Your review (optional)" rows={4} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did you like or dislike? How was the fit, quality, delivery?" />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={isLoading} disabled={!rating}>
          {existing ? 'Update review' : 'Post review'}
        </Button>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        {existing && (
          <Button variant="ghost" onClick={handleDelete} loading={deleting} className="ml-auto text-rose-600">
            Delete
          </Button>
        )}
      </div>
    </form>
  )
}

/** Rating summary, the customer's own review, and the review list for one product. */
export default function ProductReviews({ slug }) {
  const { isAuthenticated, role } = useAuth()
  const isCustomer = isAuthenticated && role === ROLES.CUSTOMER
  const [params, setParams] = useState({ sort: 'newest', rating: '', page: 1 })
  const [writing, setWriting] = useState(false)

  const { data, isLoading, isFetching } = useGetProductReviewsQuery({
    slug,
    sort: params.sort,
    page: params.page,
    ...(params.rating ? { rating: params.rating } : {}),
  })
  const { data: mine } = useGetMyReviewQuery(slug, { skip: !isCustomer })
  const summary = data?.summary

  return (
    <section id="reviews" className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Ratings & reviews</h2>
        {isCustomer && mine?.canReview && !writing && mine.review?.status !== 'hidden' && (
          <Button size="sm" variant="outline" onClick={() => setWriting(true)}>
            {mine.review ? 'Edit your review' : 'Write a review'}
          </Button>
        )}
      </div>

      {writing && (
        <div className="mb-6">
          <ReviewForm key={mine?.review?.updatedAt ?? 'new'} slug={slug} existing={mine?.review} onDone={() => setWriting(false)} />
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : !summary?.count ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No reviews yet.{' '}
          {isCustomer && mine?.canReview ? 'Be the first to share what you think.' : 'Reviews come from customers who bought this product.'}
        </p>
      ) : (
        <>
          <div className="grid gap-6 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-[auto_1fr]">
            <div className="text-center sm:pr-6 sm:text-left">
              <p className="text-4xl font-bold text-slate-900">{summary.average.toFixed(1)}</p>
              <Stars value={summary.average} />
              <p className="mt-1 text-xs text-slate-500">
                {summary.count} review{summary.count === 1 ? '' : 's'}
              </p>
            </div>
            {/* Distribution: click a row to filter by that rating */}
            <ul className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = summary.distribution[stars] ?? 0
                const active = Number(params.rating) === stars
                return (
                  <li key={stars}>
                    <button
                      type="button"
                      onClick={() => setParams((p) => ({ ...p, rating: active ? '' : stars, page: 1 }))}
                      disabled={!count}
                      aria-pressed={active}
                      className={cn('flex w-full items-center gap-3 rounded-md px-1 text-sm disabled:cursor-default', active && 'bg-brand-50')}
                    >
                      <span className="w-8 text-slate-600 tabular-nums">{stars}★</span>
                      <span className="h-2 flex-1 rounded-full bg-slate-100">
                        <span className="block h-2 rounded-full bg-amber-400" style={{ width: `${(count / summary.count) * 100}%` }} />
                      </span>
                      <span className="w-8 text-right text-slate-500 tabular-nums">{count}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {params.rating ? `Showing ${params.rating}-star reviews` : 'All reviews are from verified buyers'}
            </p>
            <select
              value={params.sort}
              onChange={(e) => setParams((p) => ({ ...p, sort: e.target.value, page: 1 }))}
              aria-label="Sort reviews"
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <ul className={cn('mt-3 divide-y divide-slate-200', isFetching && 'opacity-60 transition-opacity')}>
            {data.items.map((review) => (
              <li key={review._id} className="py-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars value={review.rating} className="size-3.5" />
                  {review.title && <p className="text-sm font-semibold text-slate-900">{review.title}</p>}
                </div>
                {review.body && <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate-700">{review.body}</p>}
                <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{review.author}</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <BadgeCheck className="size-3.5" /> Verified purchase
                  </span>
                  <span>· {formatDate(review.createdAt)}</span>
                  {review.variantLabel && <span>· {review.variantLabel}</span>}
                </p>
              </li>
            ))}
          </ul>
          <Pagination pagination={data.pagination} onPageChange={(page) => setParams((p) => ({ ...p, page }))} />
        </>
      )}
      {isCustomer && mine?.review?.status === 'hidden' && (
        <p className="mt-3 text-xs text-slate-500">Your review was hidden by our team because it broke the review guidelines.</p>
      )}
    </section>
  )
}
