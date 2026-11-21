import { Link } from 'react-router-dom'
import { APP_NAME } from '@/config/app'
import { cn } from '@/utils/cn'

/** Shopping-bag mark in the fixed brand colours (oxblood + cream), so it looks the same in light and dark mode. */
function BagMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#92140C" />
      <path d="M9.5 12.5h13l-1 10.2a1.5 1.5 0 0 1-1.5 1.3h-8a1.5 1.5 0 0 1-1.5-1.3Z" fill="#FFF8F0" />
      <path d="M12.8 12.5v-1.2a3.2 3.2 0 0 1 6.4 0v1.2" stroke="#FFF8F0" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  )
}

/** Mark + serif wordmark. `inverted` for dark backgrounds. */
export default function Logo({ to = '/', tagline, className, inverted = false }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2.5', className)}>
      <BagMark />
      <span className="leading-tight">
        <span
          className={cn('block text-xl font-semibold tracking-tight', inverted ? 'text-white' : 'text-slate-900')}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {APP_NAME}
        </span>
        {tagline && (
          <span className={cn('block text-[11px] font-medium', inverted ? 'text-brand-200' : 'text-brand-600')}>{tagline}</span>
        )}
      </span>
    </Link>
  )
}
