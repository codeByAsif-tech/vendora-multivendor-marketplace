import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/features/theme/useTheme'
import { cn } from '@/utils/cn'

const OPTIONS = [
  { value: 'light', label: 'Light theme', icon: Sun, activeColor: 'text-amber-500' },
  { value: 'dark', label: 'Dark theme', icon: Moon, activeColor: 'text-brand-500' },
]

/** Sun / moon switch. The active theme is highlighted; click the other icon to switch. */
export default function ThemeToggle({ className }) {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn('inline-flex items-center rounded-full border border-slate-200 bg-slate-100 p-0.5', className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon, activeColor }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              'flex size-8 items-center justify-center rounded-full transition',
              active ? cn('bg-white shadow-sm', activeColor) : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <Icon className="size-4" />
          </button>
        )
      })}
    </div>
  )
}
