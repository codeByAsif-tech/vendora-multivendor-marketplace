import { useState } from 'react'
import { ChevronRight, Package } from 'lucide-react'
import { Link } from 'react-router-dom'
import Thumb from '@/components/common/Thumb'
import { OrderStatusBadge } from '@/components/shop/OrderStatusBadge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import Skeleton from '@/components/ui/Skeleton'
import { useGetMyOrdersQuery } from '@/features/shop/shopApi'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate } from '@/utils/format'
import { formatPrice } from '@/utils/money'

export default function MyOrdersPage() {
  useDocumentTitle('My orders')
  const [page, setPage] = useState(1)
  const { data, isLoading, isFetching } = useGetMyOrdersQuery({ page, limit: 10 })

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">My orders</h1>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <Card>
          <EmptyState
            icon={Package}
            title="No orders yet"
            description="When you place an order, it will show up here."
            action={<Button to="/products">Start shopping</Button>}
          />
        </Card>
      ) : (
        <div className={isFetching ? 'space-y-4 opacity-70' : 'space-y-4'}>
          {data.items.map((order) => {
            const items = order.sellerOrders.flatMap((s) => s.items)
            return (
              <Link key={order._id} to={`/my-orders/${order.orderNumber}`} className="block">
                <Card className="p-5 transition hover:border-brand-300 hover:shadow-elevated">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Order {order.orderNumber}</p>
                      <p className="text-xs text-slate-500">
                        Placed {formatDate(order.createdAt)} · {order.itemCount} item{order.itemCount === 1 ? '' : 's'} · {formatPrice(order.total)}
                      </p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    {items.slice(0, 5).map((item, i) => (
                      <Thumb key={`${item.name}-${i}`} src={item.image} alt={item.name} />
                    ))}
                    {items.length > 5 && <span className="text-sm text-slate-500">+{items.length - 5} more</span>}
                    <span className="ml-auto flex items-center gap-1 text-sm font-medium text-brand-600">
                      View details <ChevronRight className="size-4" />
                    </span>
                  </div>
                </Card>
              </Link>
            )
          })}
          <Card>
            <Pagination pagination={data.pagination} onPageChange={setPage} />
          </Card>
        </div>
      )}
    </div>
  )
}
