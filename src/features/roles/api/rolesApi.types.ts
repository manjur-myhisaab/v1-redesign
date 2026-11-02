export type PermissionTable =
  | 'attendance'
  | 'salary'
  | 'incentive'
  | 'expense'
  | 'loan'
  | 'employee'
  | 'shift'
  | 'payroll_config'
  | 'geofencing'

export interface RolePermissionItem {
  role_permission_id?: string
  permission_table: string
  can_read: boolean
  can_write: boolean
  can_edit: boolean
  can_delete: boolean
  created_at?: string
  updated_at?: string
}

export interface RolePermission {
  role_id: string
  firm_id?: string
  role_name: string
  created_at?: string
  updated_at?: string
  permissions: RolePermissionItem[]
}

export interface CreateRoleRequest {
  role_name: string
  permissions: {
    permission_table: string
    can_read: boolean
    can_write: boolean
    can_edit: boolean
    can_delete: boolean
  }[]
}

export interface UpdateRoleRequest {
  role_id: string
  role_name: string
  permissions: {
    role_permission_id?: string
    permission_table: string
    can_read: boolean
    can_write: boolean
    can_edit: boolean
    can_delete: boolean
  }[]
}

export type RoleAssignMode = 'delete_and_insert' | 'create_and_insert'

export interface AssignRoleToUsersRequest {
  user_ids: string[]
  role_ids: string[]
  mode: RoleAssignMode
}

export interface AssignUserRoleItem {
  user_id: string
  role_id: string
}

export interface UpdateUserRoleItem {
  user_role_id?: string
  user_id: string
  role_id: string
}

export interface UserRoleRecord {
  user_role_id: string
  user_id: string
  role_id: string
  firm_id?: string
  created_at?: string
  updated_at?: string
}

export interface RoleApiResponse<T> {
  success: boolean
  message?: string
  data?: T
}

export const STATIC_PERMISSION_MODULES = [
  { id: 'attendance', label: 'Attendance' },
  { id: 'salary', label: 'Salary' },
  { id: 'incentive', label: 'Incentive' },
  { id: 'expense', label: 'Expense' },
  { id: 'loan', label: 'Loan' },
  { id: 'employee', label: 'Employee' },
  { id: 'shift', label: 'Shift' },
  { id: 'payroll_config', label: 'Payroll Config' },
  { id: 'geofencing', label: 'Geofencing' },
] as const
