import { useEffect, useId, useRef, useState } from 'react'
import Skeleton from '@/components/ui/Skeleton'
import { formatNumber } from '@/utils/format'
import { formatPrice } from '@/utils/money'
import { bucketLabel, compactPrice, niceMax } from './chartFormat'

const PAD = { top: 12, right: 12, bottom: 28, left: 56 }
const GRID_LINES = 4

/** Width of the element, kept up to date (charts redraw at the new size). */
function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

/**
 * Single-series line + area chart for sales or order counts over time.
 * One series → no legend; the card title names it. Hover / arrow keys show the exact value.
 * Colour follows the theme (brand-600 via currentColor), so dark mode uses the dark brand step.
 *
 * series: [{ key, sales, orders }]   metric: 'sales' | 'orders'   bucket: 'day' | 'month'
 */
export default function SalesChart({ series, metric = 'sales', bucket = 'day', height = 260, loading = false }) {
  const [ref, width] = useWidth()
  const [active, setActive] = useState(null)
  const gradientId = useId()

  // The measured div must stay the same element while loading, so the ResizeObserver keeps working.
  if (loading || !series) {
    return (
      <div ref={ref} style={{ height }}>
        <Skeleton className="size-full" />
      </div>
    )
  }

  const values = series.map((s) => s[metric] ?? 0)
  const highest = Math.max(...values)
  // Orders are whole numbers: keep gridlines on integers.
  const max = metric === 'orders' ? Math.max(GRID_LINES, Math.ceil(highest / GRID_LINES) * GRID_LINES) : niceMax(highest)
  const empty = values.every((v) => v === 0)
  const format = metric === 'sales' ? formatPrice : formatNumber
  const axisFormat = metric === 'sales' ? compactPrice : (v) => formatNumber(Math.round(v))

  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom
  const step = series.length > 1 ? plotW / (series.length - 1) : 0
  const x = (i) => PAD.left + (series.length > 1 ? i * step : plotW / 2)
  const y = (v) => PAD.top + plotH - (v / max) * plotH

  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(values.length - 1).toFixed(1)},${PAD.top + plotH} L${x(0).toFixed(1)},${PAD.top + plotH} Z`

  // ~6 x-axis labels, always including the last bucket
  const every = Math.max(1, Math.ceil(series.length / 6))
  const ticks = series.map((s, i) => i).filter((i) => (series.length - 1 - i) % every === 0)

  function pick(clientX) {
    const box = ref.current.getBoundingClientRect()
    const i = Math.round((clientX - box.left - PAD.left) / (step || 1))
    setActive(Math.min(series.length - 1, Math.max(0, i)))
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      setActive((current) => Math.min(series.length - 1, Math.max(0, (current ?? series.length - 1) + delta)))
    }
    if (event.key === 'Escape') setActive(null)
  }

  const point = active != null ? series[active] : null
  const tooltipLeft = active != null ? Math.min(Math.max(x(active), 80), width - 80) : 0

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="block text-brand-600 outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          role="img"
          aria-label={`${metric === 'sales' ? 'Sales' : 'Orders'} over time. Use the left and right arrow keys to read each value.`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          onPointerMove={(e) => pick(e.clientX)}
          onPointerLeave={() => setActive(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Recessive grid + y labels */}
          {Array.from({ length: GRID_LINES + 1 }, (_, i) => {
            const value = (max / GRID_LINES) * i
            const gy = y(value)
            return (
              <g key={i}>
                <line x1={PAD.left} x2={PAD.left + plotW} y1={gy} y2={gy} className="stroke-slate-200" strokeWidth="1" />
                <text x={PAD.left - 8} y={gy} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[11px]">
                  {axisFormat(value)}
                </text>
              </g>
            )
          })}

          {/* x labels */}
          {ticks.map((i) => (
            <text key={series[i].key} x={x(i)} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
              {bucketLabel(series[i].key, bucket)}
            </text>
          ))}

          {!empty && <path d={area} fill={`url(#${gradientId})`} />}
          <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity={empty ? 0.35 : 1} />

          {point && (
            <g pointerEvents="none">
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotH} className="stroke-slate-400" strokeWidth="1" strokeDasharray="3 3" />
              {/* 2px surface ring keeps the marker readable on top of the line */}
              <circle cx={x(active)} cy={y(values[active])} r="5" fill="currentColor" stroke="var(--surface, #fff)" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}

      {empty && (
        <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm text-slate-500">No sales in this period yet</p>
      )}

      {point && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-elevated"
          style={{ left: tooltipLeft }}
          role="status"
        >
          <p className="font-medium text-slate-500">{bucketLabel(point.key, bucket, true)}</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">{format(point[metric])}</p>
          <p className="text-slate-500">
            {metric === 'sales' ? `${formatNumber(point.orders)} order${point.orders === 1 ? '' : 's'}` : formatPrice(point.sales)}
          </p>
        </div>
      )}

      {/* Same numbers as a table, for screen readers */}
      <table className="sr-only">
        <caption>{metric === 'sales' ? 'Sales' : 'Orders'} by {bucket}</caption>
        <thead>
          <tr>
            <th scope="col">{bucket === 'month' ? 'Month' : 'Day'}</th>
            <th scope="col">Sales</th>
            <th scope="col">Orders</th>
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.key}>
              <td>{bucketLabel(s.key, bucket, true)}</td>
              <td>{formatPrice(s.sales)}</td>
              <td>{s.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
