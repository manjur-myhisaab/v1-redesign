export type AttendanceDayStatus = 'present' | 'absent' | 'halfday' | 'leave' | 'weekoff' | 'holiday'

export interface PunchRecord {
  id: string
  status: 'IN' | 'OUT'
  time: string // e.g. "09:18 AM"
  shiftName?: string // e.g. "General Shift (9:30 AM - 6:30 PM)"
  location: string
  photo?: string | null
  remarks?: string
}

export interface DayAttendance {
  date: string // YYYY-MM-DD
  status: AttendanceDayStatus
  punches: PunchRecord[]
  totalWorkedMinutes?: number
}

export interface MonthAttendanceSummary {
  present: number
  absent: number
  halfday: number
  leave: number
  weekoff: number
  holiday: number
}

export const ATTENDANCE_TYPES_LOADED = true

