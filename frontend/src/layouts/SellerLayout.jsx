import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Package,
  RotateCcw,
  Settings,
  ShoppingBag,
  UserRound,
  Wallet,
} from 'lucide-react'
import DashboardLayout from './DashboardLayout'

const sellerNav = [
  {
    label: 'Overview',
    items: [
      { to: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/seller/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/seller/products', label: 'Products', icon: Package, end: false }, // stays active on create/edit pages
      { to: '/seller/inventory', label: 'Inventory', icon: Boxes },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/seller/orders', label: 'Orders', icon: ShoppingBag },
      { to: '/seller/returns', label: 'Returns', icon: RotateCcw },
      { to: '/seller/earnings', label: 'Earnings', icon: Wallet },
    ],
  },
  {
    label: 'Store',
    items: [
      { to: '/seller/settings', label: 'Store settings', icon: Settings },
      { to: '/seller/profile', label: 'My profile & password', icon: UserRound },
    ],
  },
]

export default function SellerLayout() {
  return (
    <DashboardLayout
      navGroups={sellerNav}
      homePath="/seller/dashboard"
      tagline="Seller Hub"
      menuLinks={[
        { to: '/seller/profile', label: 'My profile', icon: UserRound },
        { to: '/seller/settings', label: 'Store settings', icon: Settings },
      ]}
    />
  )
}
