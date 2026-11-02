import type { DayAttendance, PunchRecord, AttendanceDayStatus } from '../types/attendanceCalendar.types'

const DEFAULT_LOCATION_IN = 'Soham Consultants, Seethammadhara, Akkayyapalem, Visakhapatnam 530016, India'
const DEFAULT_LOCATION_OUT = 'Golden Quadrilateral, Chaitanya Nagar, Maddilapalem, Visakhapatnam 530013, India'

// In-memory cache for demo data
const attendanceStore: Record<string, Record<string, DayAttendance>> = {}

export function getDemoMonthAttendance(employeeId: string, year: number, month: number): Record<string, DayAttendance> {
  const cacheKey = `${employeeId}_${year}_${month}`
  if (attendanceStore[cacheKey]) {
    return attendanceStore[cacheKey]
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthData: Record<string, DayAttendance> = {}

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day)
    const dayOfWeek = d.getDay() // 0 = Sun, 6 = Sat
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    let status: AttendanceDayStatus = 'present'
    const punches: PunchRecord[] = []

    if (dayOfWeek === 0) {
      status = 'weekoff'
    } else if (day === 4) {
      status = 'absent'
    } else if (day === 12) {
      status = 'halfday'
      punches.push({
        id: `p-${dateStr}-1`,
        status: 'IN',
        time: '09:30 AM',
        shiftName: 'General Shift (9:30 AM - 6:30 PM)',
        location: DEFAULT_LOCATION_IN,
        photo: null,
        remarks: 'First half attendance',
      })
    } else if (day === 18) {
      status = 'leave'
    } else {
      status = 'present'
      punches.push(
        {
          id: `p-${dateStr}-1`,
          status: 'IN',
          time: '09:18 AM',
          shiftName: 'General Shift (9:30 AM - 6:30 PM)',
          location: DEFAULT_LOCATION_IN,
          photo: null,
          remarks: 'Regular check-in',
        },
        {
          id: `p-${dateStr}-2`,
          status: 'OUT',
          time: '08:25 PM',
          shiftName: 'General Shift (9:30 AM - 6:30 PM)',
          location: DEFAULT_LOCATION_OUT,
          photo: null,
          remarks: 'Overtime check-out',
        }
      )
    }

    monthData[dateStr] = {
      date: dateStr,
      status,
      punches,
      totalWorkedMinutes: punches.length >= 2 ? 667 : punches.length === 1 ? 240 : 0,
    }
  }

  attendanceStore[cacheKey] = monthData
  return monthData
}

export function updateDemoPunch(
  employeeId: string,
  year: number,
  month: number,
  dateStr: string,
  updatedPunch: PunchRecord
): DayAttendance {
  const cacheKey = `${employeeId}_${year}_${month}`
  const monthData = getDemoMonthAttendance(employeeId, year, month)
  const day = monthData[dateStr] || {
    date: dateStr,
    status: 'present',
    punches: [],
  }

  const existingIdx = day.punches.findIndex((p) => p.id === updatedPunch.id)
  if (existingIdx >= 0) {
    day.punches[existingIdx] = updatedPunch
  } else {
    day.punches.push(updatedPunch)
  }

  // Recalculate status based on punches
  if (day.punches.length === 0) {
    day.status = 'absent'
  } else if (day.punches.length === 1) {
    day.status = 'halfday'
  } else {
    day.status = 'present'
  }

  monthData[dateStr] = { ...day, punches: [...day.punches] }
  attendanceStore[cacheKey] = { ...monthData }
  return monthData[dateStr]
}

export function deleteDemoPunch(
  employeeId: string,
  year: number,
  month: number,
  dateStr: string,
  punchId: string
): DayAttendance {
  const cacheKey = `${employeeId}_${year}_${month}`
  const monthData = getDemoMonthAttendance(employeeId, year, month)
  const day = monthData[dateStr]

  if (day) {
    day.punches = day.punches.filter((p) => p.id !== punchId)
    if (day.punches.length === 0) {
      day.status = 'absent'
    } else if (day.punches.length === 1) {
      day.status = 'halfday'
    } else {
      day.status = 'present'
    }
    monthData[dateStr] = { ...day, punches: [...day.punches] }
    attendanceStore[cacheKey] = { ...monthData }
    return monthData[dateStr]
  }

  return {
    date: dateStr,
    status: 'absent',
    punches: [],
  }
}

export function addDemoPunch(
  employeeId: string,
  year: number,
  month: number,
  dateStr: string,
  newPunch: Omit<PunchRecord, 'id'>
): DayAttendance {
  const punchWithId: PunchRecord = {
    ...newPunch,
    id: `punch-${Date.now()}`,
  }
  return updateDemoPunch(employeeId, year, month, dateStr, punchWithId)
}
