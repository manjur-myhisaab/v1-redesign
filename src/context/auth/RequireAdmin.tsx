import { Outlet, useLocation } from 'react-router-dom'
import { useUserPermissions } from '@/features/roles/hooks/useUserPermissions'
import { useAuth } from '@/context/auth/AuthContext'
import { isRoleAdmin, isRoleManager } from '@/constants/roles'
import NotFound from '@/pages/NotFound'
import { Loader2 } from 'lucide-react'

/**
 * Route guard that strictly controls access to /admin/* routes:
 * 1. Owners: Full unrestricted access.
 * 2. Pure Employees (role="MEMBER" & roles=[]): Completely blocked -> 404 Not Found.
 * 3. Custom Role Members (role="MEMBER" & roles=[...]): Checked against role permissions.
 */
export default function RequireAdmin() {
  const location = useLocation()
  const { user, activeWorkspace } = useAuth()
  const { isOwner, isPureEmployee, canAccessRoute, isLoading } = useUserPermissions()

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Check if session user has admin/owner privileges from v1 role UUID or workspace
  const userRole = user?.role
  const isDirectAdmin =
    isOwner ||
    Boolean(user?.isSuperAdmin) ||
    Boolean(user?.is_admin) ||
    isRoleAdmin(userRole) ||
    String(activeWorkspace?.role || '').toUpperCase() === 'OWNER' ||
    String(activeWorkspace?.role || '').toUpperCase() === 'ADMIN'

  if (isDirectAdmin) {
    return <Outlet />
  }

  // Managers have access to /admin/staff and /admin/attendance
  const isManager = isRoleManager(userRole)

  if (
    isManager &&
    (location.pathname.startsWith('/admin/staff') ||
      location.pathname.startsWith('/admin/attendance') ||
      location.pathname.startsWith('/attendance/staff'))
  ) {
    return <Outlet />
  }

  // 1. Pure employees are strictly shown 404
  if (isPureEmployee) {
    return <NotFound />
  }

  // 2. If user is not Owner, verify they have permission for the specific route
  if (!canAccessRoute(location.pathname)) {
    return <NotFound />
  }

  return <Outlet />
}
