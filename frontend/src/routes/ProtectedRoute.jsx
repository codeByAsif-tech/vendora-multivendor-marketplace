import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { homePathFor } from '@/utils/roles'

/**
 * UX-only guard. The backend checks auth and roles on every request.
 * - Not logged in → send to this area's login page, remembering where the user was going.
 * - Logged in with another role → send to that role's own home.
 */
export default function ProtectedRoute({ roles, loginPath = '/login' }) {
  const { isAuthenticated, role } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to={loginPath} replace state={{ from: location.pathname + location.search }} />
  }

  if (roles && !roles.includes(role)) {
    return <Navigate to={homePathFor(role)} replace />
  }

  return <Outlet />
}
