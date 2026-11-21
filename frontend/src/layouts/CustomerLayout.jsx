import { Heart, LayoutDashboard, Package, Search, ShoppingCart, Store, User } from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import Logo from '@/components/common/Logo'
import NotificationBell from '@/components/common/NotificationBell'
import ThemeToggle from '@/components/common/ThemeToggle'
import VerifyEmailBanner from '@/components/common/VerifyEmailBanner'
import UserMenu from '@/components/common/UserMenu'
import Button from '@/components/ui/Button'
import { APP_NAME } from '@/config/app'
import { useAuth } from '@/features/auth/useAuth'
import { useGetCartQuery } from '@/features/shop/shopApi'
import { ROLES } from '@/utils/roles'
import { useGetPublicSettingsQuery } from '@/features/settings/settingsApi'
import { formatPrice } from '@/utils/money'

const accountLinks = [
  { to: '/my-account', label: 'My account', icon: User },
  { to: '/my-orders', label: 'My orders', icon: Package },
  { to: '/wishlist', label: 'Wishlist', icon: Heart },
]

function IconLink({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className="relative flex size-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
    >
      <Icon className="size-5" />
    </NavLink>
  )
}

/**
 * Top strip. "Free delivery on your first order" is shown only to guests and to customers who have not ordered yet
 * (the server tells us via the cart summary); everyone else sees the standard delivery offer.
 */
function AnnouncementBar() {
  const { isAuthenticated, role } = useAuth()
  const isCustomer = isAuthenticated && role === ROLES.CUSTOMER
  const { data: cart, isLoading } = useGetCartQuery(undefined, { skip: !isCustomer })
  const { data: settings } = useGetPublicSettingsQuery()
  const shipping = settings?.shipping

  // A custom message from Platform settings wins over the automatic delivery offer.
  let text = settings?.announcement?.message
  if (!text) {
    const thresholdOffer = shipping
      ? `Free delivery on orders above ${formatPrice(shipping.freeThreshold)} from each seller`
      : 'Free delivery on bigger orders'
    const firstOrderOffer = shipping?.firstOrderFree !== false
    let offer = firstOrderOffer ? 'Free delivery on your first order' : thresholdOffer
    if (isCustomer && (isLoading || cart?.summary?.firstOrderFreeDelivery === false)) offer = thresholdOffer
    text = `${offer} · Shop from verified sellers`
  }

  return <div className="keep-colors bg-slate-900 px-4 py-2 text-center text-xs font-medium text-white/85">{text}</div>
}

/** Cart icon with the number of items (customers only). */
function CartLink() {
  const { isAuthenticated, role } = useAuth()
  const { data: cart } = useGetCartQuery(undefined, { skip: !isAuthenticated || role !== ROLES.CUSTOMER })
  const count = cart?.summary?.itemCount ?? 0

  return (
    <NavLink
      to="/cart"
      aria-label={count ? `Cart, ${count} items` : 'Cart'}
      className="relative flex size-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
    >
      <ShoppingCart className="size-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </NavLink>
  )
}

function SearchBar({ className }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const current = params.get('q') ?? ''

  function handleSubmit(event) {
    event.preventDefault()
    const q = String(new FormData(event.currentTarget).get('q') ?? '').trim()
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : '/products')
  }

  return (
    <form onSubmit={handleSubmit} className={className} role="search">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
        <input
          key={current}
          defaultValue={current}
          aria-label="Search products"
          name="q"
          type="search"
          placeholder="Search products, brands and more"
          className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pr-4 pl-10 text-sm transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 focus:outline-none"
        />
      </div>
    </form>
  )
}

/** Sellers and admins can browse the shop, but their menu leads back to their own area. */
const STAFF = {
  [ROLES.ADMIN]: { label: 'admin', home: { to: '/admin/dashboard', label: 'Admin dashboard', icon: LayoutDashboard } },
  [ROLES.SELLER]: { label: 'seller', home: { to: '/seller/dashboard', label: 'Seller Hub', icon: Store } },
}

/** Shown to sellers / admins on the storefront: they are browsing, not shopping. */
function StaffNotice({ staff }) {
  const HomeIcon = staff.home.icon
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-amber-900 sm:px-6 lg:px-8">
        <span>
          You are viewing the shop as {staff.label === 'admin' ? 'an' : 'a'} {staff.label}. Buying needs a separate customer account.
        </span>
        <Link to={staff.home.to} className="inline-flex items-center gap-1.5 font-semibold text-amber-900 underline-offset-2 hover:underline">
          <HomeIcon className="size-4" /> Back to {staff.home.label}
        </Link>
      </div>
    </div>
  )
}

export default function CustomerLayout() {
  const { isAuthenticated, role } = useAuth()
  const staff = isAuthenticated ? STAFF[role] : undefined

  return (
    <div className="storefront flex min-h-screen flex-col">
      <AnnouncementBar />

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Logo />
          <SearchBar className="mx-auto hidden w-full max-w-xl md:block" />
          <nav className="ml-auto flex items-center gap-1 md:ml-0">
            <ThemeToggle className="mr-1" />
            {!staff && (
              <>
                <IconLink to="/wishlist" label="Wishlist" icon={Heart} />
                <CartLink />
              </>
            )}
            <NotificationBell />
            <div className="ml-2">
              {isAuthenticated ? (
                <UserMenu links={staff ? [staff.home] : accountLinks} />
              ) : (
                <Button to="/login" size="sm">
                  Sign in
                </Button>
              )}
            </div>
          </nav>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <SearchBar />
        </div>
        {staff && <StaffNotice staff={staff} />}
        <VerifyEmailBanner />
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div className="space-y-3">
            <Logo />
            <p className="text-sm text-slate-500">
              A marketplace of trusted independent sellers, all in one place.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Shop</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li><Link to="/products" className="hover:text-slate-900">All products</Link></li>
              <li><Link to="/cart" className="hover:text-slate-900">Cart</Link></li>
              <li><Link to="/wishlist" className="hover:text-slate-900">Wishlist</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Account</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              <li><Link to="/my-account" className="hover:text-slate-900">My account</Link></li>
              <li><Link to="/my-orders" className="hover:text-slate-900">Orders</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Sell with us</h4>
            <p className="mt-3 text-sm text-slate-500">Reach thousands of customers.</p>
            <Link
              to="/seller/register"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              <Store className="size-4" /> Become a seller
            </Link>
          </div>
        </div>
        <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
