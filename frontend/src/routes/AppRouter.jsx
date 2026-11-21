import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from '@/layouts/AdminLayout'
import CustomerLayout from '@/layouts/CustomerLayout'
import SellerLayout from '@/layouts/SellerLayout'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import CategoriesPage from '@/pages/admin/CategoriesPage'
import AdminProductsPage from '@/pages/admin/ProductsPage'
import SellersPage from '@/pages/admin/SellersPage'
import UsersPage from '@/pages/admin/UsersPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import LoginPage from '@/pages/auth/LoginPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import VerifyEmailPage from '@/pages/auth/VerifyEmailPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import NotFoundPage from '@/pages/common/NotFoundPage'
import ProfilePage from '@/pages/common/ProfilePage'
import AdminOrdersPage from '@/pages/admin/OrdersPage'
import PaymentsPage from '@/pages/admin/PaymentsPage'
import TransactionsPage from '@/pages/admin/TransactionsPage'
import PayoutsPage from '@/pages/admin/PayoutsPage'
import ReportsPage from '@/pages/admin/ReportsPage'
import SettingsPage from '@/pages/admin/SettingsPage'
import CouponsPage from '@/pages/admin/CouponsPage'
import AdminReturnsPage from '@/pages/admin/ReturnsPage'
import ReviewsPage from '@/pages/admin/ReviewsPage'
import SellerReturnsPage from '@/pages/seller/ReturnsPage'
import AnalyticsPage from '@/pages/seller/AnalyticsPage'
import EarningsPage from '@/pages/seller/EarningsPage'
import AccountPage from '@/pages/customer/AccountPage'
import CartPage from '@/pages/customer/CartPage'
import CategoryPage from '@/pages/customer/CategoryPage'
import CheckoutPage from '@/pages/customer/CheckoutPage'
import HomePage from '@/pages/customer/HomePage'
import MyOrdersPage from '@/pages/customer/MyOrdersPage'
import OrderDetailPage from '@/pages/customer/OrderDetailPage'
import WishlistPage from '@/pages/customer/WishlistPage'
import SellerOrdersPage from '@/pages/seller/OrdersPage'
import ProductDetailPage from '@/pages/customer/ProductDetailPage'
import ProductListPage from '@/pages/customer/ProductListPage'
import StorePage from '@/pages/customer/StorePage'
import InventoryPage from '@/pages/seller/InventoryPage'
import ProductFormPage from '@/pages/seller/ProductFormPage'
import ProductsPage from '@/pages/seller/ProductsPage'
import SellerDashboard from '@/pages/seller/SellerDashboard'
import StoreSettingsPage from '@/pages/seller/StoreSettingsPage'
import { ROLES } from '@/utils/roles'
import GuestRoute from './GuestRoute'
import ProtectedRoute from './ProtectedRoute'

export default function AppRouter() {
  return (
    <Routes>
      {/* ---------- Auth pages (logged-out only) ---------- */}
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage portal="customer" />} />
        <Route path="/register" element={<RegisterPage portal="customer" />} />
        <Route path="/seller/login" element={<LoginPage portal="seller" />} />
        <Route path="/seller/register" element={<RegisterPage portal="seller" />} />
        <Route path="/admin/login" element={<LoginPage portal="admin" />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Opened from the verification email, signed in or not */}
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* ---------- Public storefront + customer area ---------- */}
      <Route element={<CustomerLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/products" element={<ProductListPage />} />
        <Route path="/products/:slug" element={<ProductDetailPage />} />
        <Route path="/categories/:slug" element={<CategoryPage />} />
        <Route path="/stores/:slug" element={<StorePage />} />
        <Route element={<ProtectedRoute roles={[ROLES.CUSTOMER]} loginPath="/login" />}>
          <Route path="/my-account" element={<AccountPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/my-orders" element={<MyOrdersPage />} />
          <Route path="/my-orders/:orderNumber" element={<OrderDetailPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* ---------- Seller area ---------- */}
      <Route element={<ProtectedRoute roles={[ROLES.SELLER]} loginPath="/seller/login" />}>
        <Route path="/seller" element={<SellerLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SellerDashboard />} />
          <Route path="settings" element={<StoreSettingsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/create" element={<ProductFormPage />} />
          <Route path="products/:id/edit" element={<ProductFormPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="orders" element={<SellerOrdersPage />} />
          <Route path="earnings" element={<EarningsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="returns" element={<SellerReturnsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      {/* ---------- Admin area ---------- */}
      <Route element={<ProtectedRoute roles={[ROLES.ADMIN]} loginPath="/admin/login" />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="sellers" element={<SellersPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="payouts" element={<PayoutsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="coupons" element={<CouponsPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="returns" element={<AdminReturnsPage />} />
          {/* Old links: commission settings live on the payouts page */}
          <Route path="commissions" element={<Navigate to="/admin/payouts" replace />} />

          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
