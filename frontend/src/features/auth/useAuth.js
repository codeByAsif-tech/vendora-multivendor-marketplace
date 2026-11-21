import { useSelector } from 'react-redux'
import { selectAuthInitialized, selectCurrentUser, selectIsAuthenticated } from './authSlice'

export function useAuth() {
  const user = useSelector(selectCurrentUser)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const initialized = useSelector(selectAuthInitialized)
  return { user, role: user?.role ?? null, isAuthenticated, initialized }
}
