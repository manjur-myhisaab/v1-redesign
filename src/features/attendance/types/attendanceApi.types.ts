export interface AttendanceSummaryItem {
  attendance_summary_id: string
  attendance_id: string[]
  user_id: string
  firm_id: string
  attendance_date: string // ISO string "2026-09-09T00:00:00.000Z"
  first_in: string | null // ISO string "2026-09-09T05:50:33.371Z"
  last_out: string | null // ISO string "2026-09-09T05:53:05.756Z"
  total_working: number
  total_break: number
  attendance_status: string // "PRESENT" | "ABSENT" | "HALFDAY" | "HOLIDAY" | "LEAVE" | "WEEKOFF" etc.
  late_in: number
  early_out: number
  overtime: number
  short_hours: number
  total_sessions: number
  generated_at: string
  is_late: boolean
  is_early: boolean
  is_present: boolean
  is_absent: boolean
  is_halfday: boolean
  is_holiday: boolean
}

export interface AttendanceSummaryResponse {
  success: boolean
  message: string
  data: AttendanceSummaryItem[]
}

export interface DailyAttendanceSummaryRequest {
  date: string // "YYYY-MM-DD"
}

export interface EmployeeMonthlySummaryRequest {
  employee_id: string
  date: string // "YYYY-MM"
}

export interface EmployeeDayAttendanceSession {
  attendance_id: string
  user_id: string
  firm_id: string
  is_offline_attendance: boolean
  shift_id: string
  attendance_date: string
  in_time: string | null // ISO string
  out_time: string | null // ISO string
  geo_in_long: number | null
  geo_out_long: number | null
  geo_in_lat: number | null
  geo_out_lat: number | null
  attendance_time_metrics: string // "working" | "break"
  periods?: string
  supervisor?: string
  user_created?: string
  user_updated?: string
  updated_at?: string
  created_at?: string
  shift_snapshot?: {
    shift_name?: string
    shift_from?: string
    shift_to?: string
    shift_type?: string
    [key: string]: any
  }
  face_in?: string
  face_out?: string
}

export interface EmployeeDaySessionsRequest {
  employee_id: string
  attendance_date: string // "YYYY-MM-DD"
}

export interface EmployeeDaySessionsResponse {
  success: boolean
  message: string
  data: EmployeeDayAttendanceSession[]
}

export interface BulkAttendanceItem {
  attendance_id?: string
  user_id: string
  firm_id: string
  shift_id: string
  attendance_date: string
  in_time: string
  out_time: string
  attendance_time_metrics: 'working' | 'break'
  [key: string]: any
}

export type BulkAttendanceRegisterRequest = BulkAttendanceItem[]
export type BulkAttendanceUpdateRequest = BulkAttendanceItem[]

export interface BulkAttendanceResponse {
  success: boolean
  message: string
  data?: any
}

export interface CheckInRequest {
  shift_id: string
  attendance_date: string // "YYYY-MM-DD"
  in_time: string // ISO string "YYYY-MM-DDTHH:mm:ssZ"
  geo_in_long?: number | null
  geo_in_lat?: number | null
}

export interface BreakInRequest {
  shift_id: string
  attendance_date: string // "YYYY-MM-DD"
  in_time: string // ISO string "YYYY-MM-DDTHH:mm:ssZ"
  geo_in_long?: number | null
  geo_in_lat?: number | null
}

export interface BreakOutRequest {
  shift_id: string
  attendance_date: string // "YYYY-MM-DD"
  out_time: string // ISO string "YYYY-MM-DDTHH:mm:ssZ"
  geo_out_long?: number | null
  geo_out_lat?: number | null
}

export interface CheckOutRequest {
  shift_id: string
  attendance_date: string // "YYYY-MM-DD"
  out_time: string // ISO string "YYYY-MM-DDTHH:mm:ssZ"
  geo_out_long?: number | null
  geo_out_lat?: number | null
}

export interface AttendanceActionResponse {
  success: boolean
  message: string
  data?: any
}

export interface MyAttendanceSessionsRequest {
  attendance_date: string // "YYYY-MM-DD"
}

export interface MyAttendanceSessionsResponse {
  success: boolean
  message: string
  data: EmployeeDayAttendanceSession[]
}

export interface DeleteAttendanceSessionRequest {
  employee_id: string
  attendance_id: string
}
