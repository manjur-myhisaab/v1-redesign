import { type StatusTone } from '@/components/admin/StatusBadge'

export interface RawFirm {
  ufid?: string
  firm_id?: string
  firm_name?: string
  [key: string]: any
}

export interface RawUser {
  user_id: string
  first_name?: string
  last_name?: string
  mobile_number?: string
  employee_code?: string
  department_name?: string
  employee_email_address?: string
  role?: string[]
  pay_type?: string
  salary_per_month?: number
  doj?: string
  live_tracking?: boolean
  mobile_attendance?: boolean
  multiple_attendance?: boolean
  gender?: string
  supervisor_id?: string | null
  inactive_date?: string | null
  in_time?: string | null
  out_time?: string | null
  [key: string]: any
}

export interface RawRole {
  role_id: string
  role_name: string
  [key: string]: any
}

export interface RawShift {
  id?: string
  shift_id: string
  shift_name?: string
  employee_shift_id?: string
  [key: string]: any
}

// UI-facing employee shape (mapped from the API in src/lib/api.ts).
export interface Employee {
  // Direct Backend API Response Parameters
  firm?: RawFirm
  user?: RawUser
  roles?: RawRole[]
  shifts?: RawShift[]
  geo_fence?: any[]
  user_id?: string

  // Mapped UI fields for existing grid & table components
  id: string // maps to user.user_id
  empCode: string
  name: string
  email: string
  phone: string
  department: string
  role: string
  gender: string // '' | man | woman
  managerId: string | null
  managerUserId: string | null
  shiftId: string | null
  managerName: string
  status: string // label: Active | On Leave | Probation | Notice | Inactive
  joined: string // joinedDate display string
  monthlyCtc: number // paise (amount in the payBasis unit)
  payBasis: string // monthly | weekly | daily
  trackingEnabled: boolean // live field tracking on/off
  category?: string
  categoryId?: string
  subcategory?: string
  subcategoryId?: string
  categoryIds?: string[]
  subcategoryIds?: string[]
  categoryRules?: { category_id: string; sub_category_ids: string[] }[]
  rawRoles?: any[]
  rawUser?: any
  rawFirm?: any
}

const TONE_BY_STATUS: Record<string, StatusTone> = {
  Active: 'green',
  'On Leave': 'amber',
  Probation: 'blue',
  Notice: 'rose',
  Inactive: 'gray',
}

export const STATUSES = Object.keys(TONE_BY_STATUS)

// map a stored gender value to a react-nice-avatar `sex` (undefined = default)
export function genderSex(gender: string): 'man' | 'woman' | undefined {
  return gender === 'man' || gender === 'woman' ? gender : undefined
}

export function statusTone(label: string): StatusTone {
  return TONE_BY_STATUS[label] ?? 'gray'
}
