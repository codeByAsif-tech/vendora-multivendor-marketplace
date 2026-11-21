import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import ReasonDialog from '@/components/common/ReasonDialog'
import StatusBadge from '@/components/common/StatusBadge'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Skeleton from '@/components/ui/Skeleton'
import { useGetAdminProductQuery, useModerateProductMutation } from '@/features/admin/adminApi'
import { getErrorMessage } from '@/utils/apiError'
import { cn } from '@/utils/cn'
import { formatDateTime } from '@/utils/format'
import { formatPrice } from '@/utils/money'
import { variantLabel } from '@/utils/stock'

function Gallery({ images }) {
  const [active, setActive] = useState(0)
  const current = images[active] ?? images[0]
  return (
    <div>
      <div className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {current && <img src={current.url} alt="" className="size-full object-contain" />}
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {images.map((image, index) => (
            <button
              key={image.publicId}
              type="button"
              onClick={() => setActive(index)}
              className={cn(
                'aspect-square overflow-hidden rounded-lg border-2',
                index === active ? 'border-brand-500' : 'border-transparent opacity-70 hover:opacity-100',
              )}
            >
              <img src={image.url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProductReviewModal({ productId, onClose }) {
  const { data: product, isLoading } = useGetAdminProductQuery(productId)
  const [moderate, { isLoading: saving }] = useModerateProductMutation()
  const [rejecting, setRejecting] = useState(false)

  async function decide(status, reason) {
    try {
      const result = await moderate({ id: productId, status, ...(reason ? { reason } : {}) }).unwrap()
      toast.success(result.message)
      setRejecting(false)
      onClose()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const footer = product && (
    <>
      {product.status !== 'rejected' && (
        <Button variant="outline" onClick={() => setRejecting(true)} disabled={saving}>
          <XCircle className="size-4 text-rose-600" /> Reject
        </Button>
      )}
      {product.status !== 'approved' && (
        <Button onClick={() => decide('approved')} loading={saving && !rejecting}>
          <CheckCircle2 className="size-4" /> Approve
        </Button>
      )}
    </>
  )

  return (
    <>
      <Modal open onClose={onClose} size="xl" title={product?.name ?? 'Loading product…'} footer={footer} loading={isLoading}>
        {isLoading || !product ? (
          // Same shape as the loaded view: gallery + thumbnails on the left, details on the right
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="size-16 rounded-lg" />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <Skeleton className="h-6 w-1/3 rounded-full" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              <Gallery images={product.images} />
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={product.status} />
                  {!product.isActive && <StatusBadge status="hidden" label="Hidden by seller" />}
                  {product.store?.status !== 'approved' && <Badge tone="red">Store {product.store?.status}</Badge>}
                </div>
                {product.rejectionReason && (
                  <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
                    <span className="font-semibold">Rejected: </span>
                    {product.rejectionReason}
                  </p>
                )}
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Store</dt>
                    <dd className="font-medium text-slate-900">{product.store?.storeName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Seller</dt>
                    <dd className="text-slate-900">{product.seller?.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Category</dt>
                    <dd className="text-slate-900">{product.category?.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Brand</dt>
                    <dd className="text-slate-900">{product.brand || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Last updated</dt>
                    <dd className="text-slate-900">{formatDateTime(product.updatedAt)}</dd>
                  </div>
                  {product.moderatedAt && (
                    <div>
                      <dt className="text-xs text-slate-500">Last decision</dt>
                      <dd className="text-slate-900">
                        {formatDateTime(product.moderatedAt)}
                        {product.moderatedBy?.name ? ` · ${product.moderatedBy.name}` : ''}
                      </dd>
                    </div>
                  )}
                </dl>
                {product.highlights?.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {product.highlights.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                )}
                {product.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {product.tags.map((tag) => (
                      <Badge key={tag} tone="gray">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <section>
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Description</h3>
              <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">{product.description}</p>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Variants ({product.variants.length})
              </h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="px-3 py-2">Variant</th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">Sale</th>
                      <th className="px-3 py-2 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {product.variants.map((v) => (
                      <tr key={v._id} className={v.isActive ? '' : 'text-slate-400'}>
                        <td className="px-3 py-2">{variantLabel(v.attributes)}</td>
                        <td className="px-3 py-2 font-mono text-xs">{v.sku}</td>
                        <td className="px-3 py-2 text-right">{formatPrice(v.price)}</td>
                        <td className="px-3 py-2 text-right">{v.salePrice ? formatPrice(v.salePrice) : '—'}</td>
                        <td className="px-3 py-2 text-right">{v.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {product.specifications?.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Specifications</h3>
                <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                  {product.specifications.map((spec) => (
                    <div key={`${spec.key}-${spec.value}`} className="grid grid-cols-3 gap-4 px-3 py-2">
                      <dt className="text-slate-500">{spec.key}</dt>
                      <dd className="col-span-2 text-slate-900">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        )}
      </Modal>

      {rejecting && (
        <ReasonDialog
          open
          onClose={() => setRejecting(false)}
          loading={saving}
          title="Reject product"
          description="The seller sees this reason and can edit the product to resubmit."
          confirmLabel="Reject product"
          onConfirm={(reason) => decide('rejected', reason)}
        />
      )}
    </>
  )
}
