import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useLogoutMutation } from '@/features/auth/authApi'
import { useAuth } from '@/features/auth/useAuth'
import { loginPathFor } from '@/utils/roles'

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

/** Avatar + dropdown with profile links and logout. `links`: [{ to, label, icon }] */
export default function UserMenu({ links = [] }) {
  const { user, role } = useAuth()
  const [open, setOpen] = useState(false)
  const [logout, { isLoading }] = useLogoutMutation()
  const navigate = useNavigate()
  const ref = useRef(null)

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  async function handleLogout() {
    await logout().catch(() => {})
    toast.success('You have been logged out')
    navigate(loginPathFor(role), { replace: true })
  }

  if (!user) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition hover:bg-slate-100"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
          {initials(user.name)}
        </span>
        <span className="hidden max-w-32 truncate text-sm font-medium text-slate-700 sm:block">
          {user.name}
        </span>
        <ChevronDown className="hidden size-4 text-slate-400 sm:block" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-elevated"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <div className="py-1">
            {links.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {Icon && <Icon className="size-4 text-slate-400" />}
                {label}
              </Link>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={isLoading}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="size-4" />
              {isLoading ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
