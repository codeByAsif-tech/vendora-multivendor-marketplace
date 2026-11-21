import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'
import Spinner from './Spinner'

const variants = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secondary: 'bg-slate-900 text-white shadow-sm hover:bg-slate-800 disabled:bg-slate-400',
  outline:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 disabled:text-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-400',
  danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 disabled:bg-rose-300',
  dangerOutline: 'border border-rose-300 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-400 disabled:text-rose-300',
  // For dark / coloured backgrounds
  light: 'bg-white text-brand-700 shadow-sm hover:bg-brand-50',
  glass: 'text-white ring-1 ring-white/30 hover:bg-white/10',
}

const sizes = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'size-10',
}

/**
 * <Button variant="primary" size="md" loading>Save</Button>
 * <Button to="/products">Shop</Button>   renders a router Link
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  to,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}) {
  const classes = cn(
    'inline-flex shrink-0 items-center justify-center rounded-lg font-semibold transition-colors',
    'disabled:cursor-not-allowed',
    variants[variant],
    sizes[size],
    fullWidth && 'w-full',
    className,
  )

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...props}>
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}
