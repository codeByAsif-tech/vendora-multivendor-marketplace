import { cn } from '@/utils/cn'
import Skeleton from './Skeleton'

/**
 * columns: [{ key, header, render?: (row) => node, align?: 'right' | 'center', className? }]
 * Shows skeleton rows while loading and `emptyState` when there are no rows.
 */
export default function DataTable({
  columns,
  rows = [],
  rowKey = '_id',
  loading = false,
  emptyState,
  onRowClick,
  skeletonRows = 6,
}) {
  const alignClass = (align) => (align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left')

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50/70">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'px-4 py-3 text-xs font-semibold tracking-wide whitespace-nowrap text-slate-500 uppercase',
                  alignClass(column.align),
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {loading &&
            Array.from({ length: skeletonRows }, (_, i) => (
              <tr key={`skeleton-${i}`}>
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-4">
                    <Skeleton className="h-4 w-full max-w-40" />
                  </td>
                ))}
              </tr>
            ))}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length}>{emptyState}</td>
            </tr>
          )}

          {!loading &&
            rows.map((row) => (
              <tr
                key={typeof rowKey === 'function' ? rowKey(row) : row[rowKey]}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('transition-colors', onRowClick ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50/60')}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn('px-4 py-3 align-middle text-slate-700', alignClass(column.align), column.className)}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
