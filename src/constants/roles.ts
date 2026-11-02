/**
 * Global System Role Constants & Helpers
 *
 * Centralized mapping for Directus backend role UUIDs:
 * - ADMIN:    bb64d3fd-5fde-4493-9cb7-bf6be2031d82
 * - MANAGER:  8734320f-991f-479f-bba8-9d4af261856e
 * - EMPLOYEE: 69a38aea-61ab-4d48-8d3d-1b3a9f78360a
 */

export const SYSTEM_ROLE_IDS = {
  ADMIN: 'bb64d3fd-5fde-4493-9cb7-bf6be2031d82',
  MANAGER: '8734320f-991f-479f-bba8-9d4af261856e',
  EMPLOYEE: '69a38aea-61ab-4d48-8d3d-1b3a9f78360a',
} as const

// Convenient aliases
export const ADMIN_ROLE_ID = SYSTEM_ROLE_IDS.ADMIN
export const MANAGER_ROLE_ID = SYSTEM_ROLE_IDS.MANAGER
export const EMPLOYEE_ROLE_ID = SYSTEM_ROLE_IDS.EMPLOYEE

export type SystemRoleKey = keyof typeof SYSTEM_ROLE_IDS
export type SystemRoleId = (typeof SYSTEM_ROLE_IDS)[SystemRoleKey]

/**
 * Human-readable role labels
 */
export const ROLE_LABELS: Record<SystemRoleId, string> = {
  [SYSTEM_ROLE_IDS.ADMIN]: 'Admin',
  [SYSTEM_ROLE_IDS.MANAGER]: 'Manager',
  [SYSTEM_ROLE_IDS.EMPLOYEE]: 'Employee',
}

/**
 * Dropdown options for selecting a role
 */
export const ROLE_OPTIONS = [
  { label: 'Employee', value: SYSTEM_ROLE_IDS.EMPLOYEE },
  { label: 'Manager', value: SYSTEM_ROLE_IDS.MANAGER },
  { label: 'Admin', value: SYSTEM_ROLE_IDS.ADMIN },
] as const

/**
 * All staff roles including admin, manager, employee
 */
export const ALL_STAFF_ROLE_IDS: readonly string[] = [
  SYSTEM_ROLE_IDS.EMPLOYEE,
  SYSTEM_ROLE_IDS.MANAGER,
  SYSTEM_ROLE_IDS.ADMIN,
]

/**
 * Roles visible to an Admin in queries / filters
 */
export const ADMIN_VISIBLE_ROLE_IDS: readonly string[] = [
  SYSTEM_ROLE_IDS.EMPLOYEE,
  SYSTEM_ROLE_IDS.MANAGER,
  SYSTEM_ROLE_IDS.ADMIN,
]

/**
 * Roles visible to a Manager who can view other managers
 */
export const MANAGER_WITH_PEERS_ROLE_IDS: readonly string[] = [
  SYSTEM_ROLE_IDS.EMPLOYEE,
  SYSTEM_ROLE_IDS.MANAGER,
]

/**
 * Standard roles visible to an employee or manager without peer view
 */
export const EMPLOYEE_ONLY_ROLE_IDS: readonly string[] = [
  SYSTEM_ROLE_IDS.EMPLOYEE,
]

/**
 * Normalizes any role input (object with id/name, uppercase/lowercase string) to uppercase string
 */
export function normalizeRole(role: any): string {
  if (!role) return ''
  if (typeof role === 'string') return role.trim().toUpperCase()
  if (typeof role === 'object') {
    return String(role.id || role.name || role.role || '').trim().toUpperCase()
  }
  return String(role).trim().toUpperCase()
}

/**
 * Check if the given role represents an Admin (UUID or name)
 */
export function isRoleAdmin(role: any): boolean {
  const norm = normalizeRole(role)
  return (
    norm === SYSTEM_ROLE_IDS.ADMIN.toUpperCase() ||
    norm.includes('ADMIN') ||
    norm.includes('OWNER') ||
    norm.includes('SUPERADMIN') ||
    norm === 'HR'
  )
}

/**
 * Check if the given role represents a Manager (UUID or name)
 */
export function isRoleManager(role: any): boolean {
  const norm = normalizeRole(role)
  return (
    norm === SYSTEM_ROLE_IDS.MANAGER.toUpperCase() ||
    norm.includes('MANAGER')
  )
}

/**
 * Check if the given role represents a standard Employee (UUID or name)
 */
export function isRoleEmployee(role: any): boolean {
  const norm = normalizeRole(role)
  return (
    norm === SYSTEM_ROLE_IDS.EMPLOYEE.toUpperCase() ||
    norm === 'EMPLOYEE' ||
    norm === 'STAFF' ||
    norm === 'MEMBER'
  )
}

/**
 * Returns human readable display name for any role
 */
export function getRoleDisplayName(role: any): string {
  if (!role) return 'Employee'
  if (isRoleAdmin(role)) return 'Admin'
  if (isRoleManager(role)) return 'Manager'
  if (isRoleEmployee(role)) return 'Employee'
  if (typeof role === 'object' && role.name) return String(role.name)
  return String(role)
}

/**
 * Helper to get the list of role IDs for Directus queries based on user permissions
 */
export function getPermittedRoleIdsForQuery(options: {
  isAdmin?: boolean
  isManager?: boolean
  canViewManager?: boolean
}): string[] {
  if (options.isAdmin) {
    return [...ADMIN_VISIBLE_ROLE_IDS]
  }
  if (options.isManager && options.canViewManager) {
    return [...MANAGER_WITH_PEERS_ROLE_IDS]
  }
  return [...EMPLOYEE_ONLY_ROLE_IDS]
}
