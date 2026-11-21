import {
  ArrowLeftRight,
  BadgePercent,
  FileBarChart,
  FolderTree,
  HandCoins,
  LayoutDashboard,
  MessageSquareText,
  Package,
  RotateCcw,
  Settings,
  ShoppingBag,
  Store,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'
import DashboardLayout from './DashboardLayout'

const adminNav = [
  {
    label: 'Overview',
    items: [
      { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
    ],
  },
  {
    label: 'Marketplace',
    items: [
      { to: '/admin/sellers', label: 'Sellers', icon: Store },
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/products', label: 'Products', icon: Package },
      { to: '/admin/categories', label: 'Categories', icon: FolderTree },
      { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
      { to: '/admin/returns', label: 'Returns', icon: RotateCcw },
      { to: '/admin/reviews', label: 'Reviews', icon: MessageSquareText },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/admin/payments', label: 'Payments', icon: Wallet },
      { to: '/admin/transactions', label: 'Transactions', icon: ArrowLeftRight },
      { to: '/admin/payouts', label: 'Payouts', icon: HandCoins },
      { to: '/admin/coupons', label: 'Coupons', icon: BadgePercent },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/settings', label: 'Settings', icon: Settings },
      { to: '/admin/profile', label: 'My profile & password', icon: UserRound },
    ],
  },
]

export default function AdminLayout() {
  return (
    <DashboardLayout
      navGroups={adminNav}
      homePath="/admin/dashboard"
      tagline="Admin Console"
      menuLinks={[
        { to: '/admin/profile', label: 'My profile', icon: UserRound },
        { to: '/admin/settings', label: 'Platform settings', icon: Settings },
      ]}
    />
  )
}
