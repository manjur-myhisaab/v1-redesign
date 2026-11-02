export type ShiftType = 'FIXED' | 'WEEKLY' | 'MONTHLY' | 'DATEWISE'

export type PunchType = 'anytime' | 'limit' | string

export type ShiftStatus = 'active' | 'inactive'

export interface ApplicableCategory {
  category_id: string | string[]
  sub_category_id: string[]
}

export interface Shift {
  shift_id: string
  firm_id?: string
  shift_name: string
  shift_from: string
  shift_to: string
  shift_type: ShiftType
  status: ShiftStatus | string
  auto_punch_out: boolean
  auto_punch_out_time?: string | null
  punch_in_type: PunchType
  punch_out_type: PunchType
  applicable_day?: string[]
  applicable_months?: string[]
  applicable_date?: string[]
  applicable_categories_for?: ApplicableCategory[]
  applicable_user?: string[]
  geo_fence_id?: string[]
  user_created?: string
  user_updated?: string
  date_created?: string
  date_updated?: string
  late_cutoff_hours?: number
  late_cutoff_minutes?: number
  early_cutoff_hours?: number
  early_cutoff_minutes?: number
  applicable_for_break?: boolean
  applicable_for_overnight?: boolean
  applicable_for_minimum_working_hours?: boolean
  lates_counted_as_half_day?: number
  earlies_counted_as_half_day?: number
  lates_counted_as_absent?: number
  early_counted_as_absent?: number
  shift_minimum_working_hours?: number
  shift_minimum_working_minutes?: number
  shift_minimum_present_hours?: number
  shift_minimum_present_minutes?: number
  punch_in_hours_before?: number
  punch_in_minutes_before?: number
  punch_out_hours_after?: number
  punch_out_minutes_after?: number
}

export interface CreateShiftRequest {
  shift_name: string
  shift_from: string
  shift_to: string
  status?: ShiftStatus | string
  punch_in_type?: PunchType
  punch_out_type?: PunchType
  auto_punch_out?: boolean
  auto_punch_out_time?: string | null
  applicable_for_minimum_working_hours?: boolean
  applicable_for_break?: boolean
  applicable_for_overnight?: boolean
  shift_type: ShiftType
  applicable_day?: string[]
  applicable_months?: string[]
  applicable_date?: string[]
  applicable_categories_for?: ApplicableCategory[] | any[]
  applicable_user?: string[]
  geo_fence_id?: string[]
  late_cutoff_hours?: number
  late_cutoff_minutes?: number
  early_cutoff_hours?: number
  early_cutoff_minutes?: number
  punch_in_hours_before?: number
  punch_in_minutes_before?: number
  punch_out_hours_after?: number
  punch_out_minutes_after?: number
  lates_counted_as_half_day?: number
  earlies_counted_as_half_day?: number
  lates_counted_as_absent?: number
  early_counted_as_absent?: number
  shift_minimum_working_hours?: number
  shift_minimum_working_minutes?: number
  shift_minimum_present_hours?: number
  shift_minimum_present_minutes?: number
}

export interface UpdateShiftRequest extends Partial<CreateShiftRequest> {
  shift_id: string
}

export interface BulkAssignShiftsRequest {
  user_ids: string[]
  shift_ids: string[]
  mode: 'delete_and_insert' | 'create_and_insert'
}

export interface ShiftApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
}

export interface SingleShiftData {
  shift: Shift
  users?: any[]
}
