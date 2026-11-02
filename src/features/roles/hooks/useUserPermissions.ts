import { useMemo } from 'react'
import { useUserProfileQuery } from '@/features/auth/hooks/useUserProfile'
import { useAuth } from '@/context/auth/AuthContext'
import { isRoleAdmin, isRoleManager } from '@/constants/roles'
import { useRolesQuery } from './useRoles'

export interface ModulePermission {
  read: boolean
  write: boolean
  edit: boolean
  delete: boolean
}

export type PermissionsMap = Record<string, ModulePermission>

// Known module identifiers matching STATIC_PERMISSION_MODULES
export type PermissionModuleName =
  | 'attendance'
  | 'salary'
  | 'incentive'
  | 'expense'
  | 'loan'
  | 'employee'
  | 'shift'
  | 'payroll_config'
  | 'geofencing'

const ALL_MODULES: PermissionModuleName[] = [
  'attendance',
  'salary',
  'incentive',
  'expense',
  'loan',
  'employee',
  'shift',
  'payroll_config',
  'geofencing',
]

/**
 * Maps frontend admin route prefixes to backend permission module names.
 */
export const ROUTE_TO_MODULE_MAP: Record<string, PermissionModuleName[]> = {
  '/admin/staff': ['employee', 'attendance'],
  '/admin/category': ['employee'],
  '/admin/staff/category': ['employee'],
  '/attendance/staff': ['employee', 'attendance'],
  '/admin/employees': ['employee'],
  '/admin/organization': ['employee'],
  '/admin/hiring': ['employee'],
  '/admin/attendance': ['attendance'],
  '/admin/leave': ['attendance'],
  '/admin/tracking': ['attendance', 'geofencing'],
  '/admin/roster': ['shift'],
  '/admin/payroll': ['salary', 'payroll_config'],
  '/admin/expenses': ['expense', 'incentive', 'loan'],
  '/admin/create-geo-location': ['geofencing'],
  '/attendance/create-geo-location': ['geofencing'],
  '/admin/settings': ['payroll_config', 'geofencing', 'shift', 'salary'],
  '/admin/reports': ['attendance', 'salary', 'employee', 'expense'],
  '/admin/messages': ['employee'],
  '/admin/documents': ['employee'],
  '/admin/assets': ['employee'],
}

/**
 * Hook to retrieve the current user's effective permissions across all assigned roles.
 */
export function useUserPermissions() {
  const { user: sessionUser, activeWorkspace } = useAuth()
  const { data: profile, isLoading: loadingProfile } = useUserProfileQuery()
  const { data: firmRoles = [], isLoading: loadingRoles } = useRolesQuery()

  const userRolesList = profile?.roles || sessionUser?.roles || []
  const userRole = profile?.user?.role || sessionUser?.role || []
  const roleArray = Array.isArray(userRole) ? userRole : typeof userRole === 'string' ? [userRole] : []

  // 1. Check if user is Owner / SuperAdmin / Full Admin
  const isOwner = useMemo(() => {
    if (sessionUser?.isSuperAdmin || sessionUser?.is_admin || (profile?.user as any)?.is_admin) return true
    if (activeWorkspace?.role && ['OWNER', 'ADMIN'].includes(String(activeWorkspace.role).toUpperCase())) return true
    return roleArray.some((r) => isRoleAdmin(r))
  }, [roleArray, sessionUser, profile, activeWorkspace])

  // Check if Manager (v1 Manager role UUID)
  const isManager = useMemo(() => {
    return roleArray.some((r) => isRoleManager(r))
  }, [roleArray])

  // 2. Check if user is a Pure Employee (Member with no custom roles assigned)
  const isPureEmployee = useMemo(() => {
    if (isOwner || isManager) return false
    return !Array.isArray(userRolesList) || userRolesList.length === 0
  }, [isOwner, isManager, userRolesList])

  // 3. Check if user has custom assigned roles
  const hasCustomRoles = useMemo(() => {
    if (isOwner) return false
    return Array.isArray(userRolesList) && userRolesList.length > 0
  }, [isOwner, userRolesList])

  // 4. Compute effective permissions map
  const permissions: PermissionsMap = useMemo(() => {
    const map: PermissionsMap = {}

    // Owner gets full permissions for all modules
    if (isOwner) {
      ALL_MODULES.forEach((mod) => {
        map[mod] = { read: true, write: true, edit: true, delete: true }
      })
      return map
    }

    // Pure employee has no admin permissions
    if (isPureEmployee) {
      ALL_MODULES.forEach((mod) => {
        map[mod] = { read: false, write: false, edit: false, delete: false }
      })
      return map
    }

    // Custom role members: merge permissions across all assigned roles
    const assignedRoleIds = new Set(
      userRolesList.map((r: any) => String(r.role_id || r.id || r)).filter(Boolean)
    )

    // Initialize map with false
    ALL_MODULES.forEach((mod) => {
      map[mod] = { read: false, write: false, edit: false, delete: false }
    })

    firmRoles
      .filter((fr) => assignedRoleIds.has(String(fr.role_id)))
      .forEach((fr) => {
        if (Array.isArray(fr.permissions)) {
          fr.permissions.forEach((p) => {
            const table = p.permission_table as PermissionModuleName
            if (!map[table]) {
              map[table] = { read: false, write: false, edit: false, delete: false }
            }
            if (p.can_read) map[table].read = true
            if (p.can_write) map[table].write = true
            if (p.can_edit) map[table].edit = true
            if (p.can_delete) map[table].delete = true
          })
        }
      })

    return map
  }, [isOwner, isPureEmployee, userRolesList, firmRoles])

  /**
   * Check if user can access a specific permission module
   */
  const canAccessModule = (
    moduleName: string,
    action: 'read' | 'write' | 'edit' | 'delete' = 'read'
  ): boolean => {
    if (isOwner) return true
    if (isPureEmployee) return false
    return Boolean(permissions[moduleName]?.[action])
  }

  /**
   * Check if user can access a given admin route
   */
  const canAccessRoute = (pathname: string): boolean => {
    if (isOwner) return true
    if (isManager && (pathname.startsWith('/admin/staff') || pathname.startsWith('/admin/attendance') || pathname.startsWith('/attendance/staff'))) {
      return true
    }
    if (isPureEmployee) return false

    // Match exact or prefix
    for (const [routePrefix, requiredModules] of Object.entries(ROUTE_TO_MODULE_MAP)) {
      if (pathname === routePrefix || pathname.startsWith(`${routePrefix}/`)) {
        // If any of the mapped modules has read permission, allow access
        return requiredModules.some((mod) => permissions[mod]?.read === true)
      }
    }

    // Default: if user has any active admin permission, allow base paths like /admin
    if (pathname === '/admin' || pathname === '/admin/new') {
      return Object.values(permissions).some((p) => p.read === true)
    }

    return false
  }

  /**
   * Get the first allowed admin route for navigation redirect
   */
  const firstAllowedAdminRoute = useMemo((): string => {
    if (isPureEmployee) return '/me'
    if (isOwner) return '/admin/employees'

    const routeOrder = [
      '/admin/employees',
      '/admin/attendance',
      '/admin/roster',
      '/admin/leave',
      '/admin/payroll',
      '/admin/expenses',
      '/admin/reports',
      '/admin/settings',
    ]

    for (const route of routeOrder) {
      if (canAccessRoute(route)) {
        return route
      }
    }

    return '/me'
  }, [isOwner, isPureEmployee, permissions])

  return {
    isOwner,
    isPureEmployee,
    hasCustomRoles,
    hasAdminAccess: isOwner || hasCustomRoles,
    permissions,
    canAccessModule,
    canAccessRoute,
    firstAllowedAdminRoute,
    isLoading: !isOwner && (loadingProfile || (hasCustomRoles && loadingRoles)),
  }
}
