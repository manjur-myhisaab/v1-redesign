import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

// Gate for /admin: must be signed in AND have an active workspace.
export default function RequireAuth() {
  const { token, activeWorkspaceId } = useAuth()
  const location = useLocation()

  if (!token) return <Navigate to="/login" replace />

  if (location.pathname === '/onboarding') {
    if (token === 'temp-onboarding-token') {
      return <Outlet />
    }
    if (activeWorkspaceId) {
      // return <Navigate to="/admin/dashboard" replace />
      return <Navigate to="/admin/employees" replace />
    }
    return <Navigate to="/login" replace />
  }

  if (!activeWorkspaceId && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
