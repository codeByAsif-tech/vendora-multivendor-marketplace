import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { homePathFor } from '@/utils/roles'

/**
 * Login/register pages: logged-in users are sent on.
 * Goes back to the page they first wanted (set by ProtectedRoute), or to their role's home.
 * ProtectedRoute corrects the target if it belongs to a different role.
 */
export default function GuestRoute() {
  const { isAuthenticated, role } = useAuth()
  const location = useLocation()

  if (isAuthenticated) {
    return <Navigate to={location.state?.from || homePathFor(role)} replace />
  }
  return <Outlet />
}
