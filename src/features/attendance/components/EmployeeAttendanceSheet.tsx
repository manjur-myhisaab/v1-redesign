import { useState, useMemo, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  X,
  Loader2,
} from 'lucide-react'
import { EmployeeAvatar } from '@/lib/people'
import { type RosterSubject } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useEmployeeMonthlySummaryQuery } from '../hooks/useAttendance'
import type { AttendanceSummaryItem } from '../types/attendanceApi.types'
import type { DayAttendance, PunchRecord, AttendanceDayStatus } from '../types/attendanceCalendar.types'
import AttendanceDayModal from './AttendanceDayModal'

interface EmployeeAttendanceSheetProps {
  employee: RosterSubject | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const STATUS_CONFIG: Record<
  AttendanceDayStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  present: {
    label: 'P',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  absent: {
    label: 'A',
    bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-500/30',
    dot: 'bg-rose-500',
  },
  halfday: {
    label: 'HFD',
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/30',
    dot: 'bg-amber-500',
  },
  leave: {
    label: 'LV',
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-500/30',
    dot: 'bg-blue-500',
  },
  weekoff: {
    label: 'W/O',
    bg: 'bg-muted/80',
    text: 'text-muted-foreground',
    border: 'border-border/60',
    dot: 'bg-muted-foreground/60',
  },
  holiday: {
    label: 'HDY',
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-500/30',
    dot: 'bg-purple-500',
  },
}

function formatIsoTime(isoStr: string | null | undefined): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export default function EmployeeAttendanceSheet({
  employee,
  open,
  onOpenChange,
}: EmployeeAttendanceSheetProps) {
  // Calendar month state
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 8, 1)) // Sep 2026 matching screenshots
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dayModalOpen, setDayModalOpen] = useState(false)

  // Esc key listener
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !dayModalOpen) {
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dayModalOpen, onOpenChange])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const employeeId = employee ? String(employee.id || employee.employeeId || '') : ''
  const monthParam = `${year}-${String(month + 1).padStart(2, '0')}` // e.g. "2026-09"

  // 2. Fetch live monthly attendance summary for this employee
  const { data: monthlySummaryRes, isLoading: loadingMonthly } = useEmployeeMonthlySummaryQuery(
    employeeId,
    monthParam,
    open && Boolean(employeeId)
  )

  const monthName = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  // Map API summary items into DayAttendance objects keyed by "YYYY-MM-DD"
  const monthData: Record<string, DayAttendance> = useMemo(() => {
    if (!employee) return {}

    const dataByDate: Record<string, DayAttendance> = {}
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    // Map summary items by date string "YYYY-MM-DD"
    const apiMap = new Map<string, AttendanceSummaryItem>()
    if (monthlySummaryRes?.data && Array.isArray(monthlySummaryRes.data)) {
      for (const item of monthlySummaryRes.data) {
        if (item.attendance_date) {
          const datePart = item.attendance_date.slice(0, 10)
          apiMap.set(datePart, item)
        }
      }
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day)
      const dayOfWeek = d.getDay() // 0 = Sun
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const apiItem = apiMap.get(dateStr)

      let status: AttendanceDayStatus = dayOfWeek === 0 ? 'weekoff' : 'absent'
      const punches: PunchRecord[] = []

      if (apiItem) {
        if (apiItem.is_present || apiItem.attendance_status?.toUpperCase() === 'PRESENT') {
          status = 'present'
        } else if (apiItem.is_halfday || apiItem.attendance_status?.toUpperCase() === 'HALFDAY') {
          status = 'halfday'
        } else if (apiItem.is_holiday || apiItem.attendance_status?.toUpperCase() === 'HOLIDAY') {
          status = 'holiday'
        } else if (apiItem.attendance_status?.toUpperCase() === 'WEEKOFF') {
          status = 'weekoff'
        } else if (apiItem.attendance_status?.toUpperCase() === 'LEAVE') {
          status = 'leave'
        } else if (apiItem.is_absent || apiItem.attendance_status?.toUpperCase() === 'ABSENT') {
          status = 'absent'
        }

        if (apiItem.first_in) {
          punches.push({
            id: `first_in_${dateStr}`,
            status: 'IN',
            time: formatIsoTime(apiItem.first_in),
            location: 'Registered Workplace',
          })
        }
        if (apiItem.last_out) {
          punches.push({
            id: `last_out_${dateStr}`,
            status: 'OUT',
            time: formatIsoTime(apiItem.last_out),
            location: 'Registered Workplace',
          })
        }
      }

      dataByDate[dateStr] = {
        date: dateStr,
        status,
        punches,
        totalWorkedMinutes: apiItem?.total_working ?? 0,
      }
    }

    return dataByDate
  }, [employee, monthlySummaryRes, year, month])

  // Calculate calendar grid days
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay() // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate()
    const prevMonthDays = new Date(year, month, 0).getDate()

    const days: {
      dayNumber: number
      isCurrentMonth: boolean
      dateStr: string
      dateObj: Date
      data?: DayAttendance
    }[] = []

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i
      const prevDate = new Date(year, month - 1, dayNum)
      const dStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(
        dayNum
      ).padStart(2, '0')}`
      days.push({
        dayNumber: dayNum,
        isCurrentMonth: false,
        dateStr: dStr,
        dateObj: prevDate,
      })
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const thisDate = new Date(year, month, d)
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({
        dayNumber: d,
        isCurrentMonth: true,
        dateStr: dStr,
        dateObj: thisDate,
        data: monthData[dStr],
      })
    }

    // Next month filler days to complete grid (multiples of 7)
    const remaining = 42 - days.length
    if (remaining < 7) {
      for (let n = 1; n <= remaining; n++) {
        const nextDate = new Date(year, month + 1, n)
        const dStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(
          n
        ).padStart(2, '0')}`
        days.push({
          dayNumber: n,
          isCurrentMonth: false,
          dateStr: dStr,
          dateObj: nextDate,
        })
      }
    }

    return days
  }, [year, month, monthData])

  // Summary Metrics computed from live monthData
  const summary = useMemo(() => {
    let present = 0
    let absent = 0
    let halfday = 0
    let leave = 0
    let weekoff = 0

    Object.values(monthData).forEach((d) => {
      if (d.status === 'present') present++
      else if (d.status === 'absent') absent++
      else if (d.status === 'halfday') halfday++
      else if (d.status === 'leave') leave++
      else if (d.status === 'weekoff') weekoff++
    })

    return { present, absent, halfday, leave, weekoff }
  }, [monthData])

  const handlePrevMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }

  const handleDayClick = (dayObj: Date) => {
    setSelectedDate(dayObj)
    setDayModalOpen(true)
  }

  if (!open || !employee) return null

  const selectedDateStr = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(
        selectedDate.getDate()
      ).padStart(2, '0')}`
    : ''

  const selectedDayData = selectedDateStr ? monthData[selectedDateStr] : undefined

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop overlay */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
          onClick={() => onOpenChange(false)}
        />

        {/* Large Sheet Panel (extended width for calendar) */}
        <div className="relative z-10 flex h-full w-full sm:w-[720px] md:w-[860px] lg:w-[62vw] xl:w-[58vw] lg:min-w-[900px] max-w-full flex-col border-l border-border bg-card shadow-2xl duration-300 ease-out animate-in slide-in-from-right overflow-hidden">
          {/* Top Sheet Header */}
          <div className="border-b border-border px-6 py-5 bg-card shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <EmployeeAvatar
                  name={employee.name}
                  sex={employee.gender === 'man' ? 'man' : employee.gender === 'woman' ? 'woman' : undefined}
                  className="size-11 border border-border shadow-xs shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold tracking-tight text-foreground truncate">
                      {employee.name}
                    </h2>
                    {employee.employeeId && (
                      <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border/60">
                        {employee.employeeId}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {employee.subtitle || employee.department || 'Employee'}
                  </p>
                </div>
              </div>

              {/* Month Navigation and Close button */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/70">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="size-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer"
                    title="Previous Month"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className="text-xs font-bold text-foreground px-2 whitespace-nowrap">
                    {monthName}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="size-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer"
                    title="Next Month"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="size-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  title="Close Sheet"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-5 gap-2 mt-4 pt-3 border-t border-border/60">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 text-center">
                <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                  Present
                </div>
                <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                  {summary.present}
                </div>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1.5 text-center">
                <div className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase">
                  Absent
                </div>
                <div className="text-base font-extrabold text-rose-600 dark:text-rose-400">
                  {summary.absent}
                </div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5 text-center">
                <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">
                  Half Day
                </div>
                <div className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                  {summary.halfday}
                </div>
              </div>
              <div className="bg-muted border border-border/70 rounded-lg px-2.5 py-1.5 text-center">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Week Off</div>
                <div className="text-base font-extrabold text-foreground">{summary.weekoff}</div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-2.5 py-1.5 text-center">
                <div className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase">
                  Leave
                </div>
                <div className="text-base font-extrabold text-blue-600 dark:text-blue-400">
                  {summary.leave}
                </div>
              </div>
            </div>
          </div>

          {/* Calendar Body (Scrollable) */}
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Monthly Attendance Calendar</h3>
                {loadingMonthly && (
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                Click any date to view / edit punches
              </span>
            </div>

            {/* Event Calendar Grid */}
            <div className="overflow-x-auto pb-2">
              <div className="rounded-xl w-full min-w-[780px] border border-border overflow-hidden bg-card shadow-xs">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 border-b border-border bg-muted/50 text-center text-[11px] font-bold text-muted-foreground py-2.5">
                  {WEEKDAYS.map((wd) => (
                    <div key={wd} className="tracking-wider">
                      {wd}
                    </div>
                  ))}
                </div>

                {/* Day Tiles Grid */}
                <div className="grid grid-cols-7 divide-x divide-y divide-border/60">
                  {calendarDays.map((cell, idx) => {
                    const dayData = cell.data
                    const status = dayData?.status
                    const config = status ? STATUS_CONFIG[status] : null
                    const punches = dayData?.punches || []

                    if (!cell.isCurrentMonth) {
                      return (
                        <div
                          key={idx}
                          className="min-h-[85px] p-2.5 bg-muted/20 text-muted-foreground/40 text-xs select-none"
                        >
                          <span className="font-semibold">{cell.dayNumber}</span>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={idx}
                        onClick={() => handleDayClick(cell.dateObj)}
                        className={cn(
                          'min-h-[85px] p-2.5 transition-all cursor-pointer group flex flex-col justify-between relative',
                          'hover:bg-muted/40 hover:z-10 hover:ring-1 hover:ring-primary/40',
                          status === 'present' && 'bg-emerald-500/5',
                          status === 'absent' && 'bg-rose-500/5',
                          status === 'halfday' && 'bg-amber-500/5',
                          status === 'weekoff' && 'bg-muted/30'
                        )}
                      >
                      {/* Top Date Header */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                          {cell.dayNumber}
                        </span>
                        {config && (
                          <span
                            className={cn(
                              'text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider',
                              config.bg,
                              config.text,
                              config.border
                            )}
                          >
                            {config.label}
                          </span>
                        )}
                      </div>

                      {/* Punches Preview */}
                      <div className="mt-1.5 space-y-1">
                        {punches.length > 0 ? (
                          <div className="text-[10.5px] font-medium text-muted-foreground/90 space-y-0.5">
                            {punches.slice(0, 2).map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center gap-1 leading-none truncate"
                              >
                                <span
                                  className={cn(
                                    'size-1.5 rounded-full shrink-0',
                                    p.status === 'IN' ? 'bg-emerald-500' : 'bg-rose-500'
                                  )}
                                />
                                <span className="font-semibold text-foreground/80">
                                  {p.status}:
                                </span>
                                <span className="truncate">{p.time}</span>
                              </div>
                            ))}
                            {punches.length > 2 && (
                              <div className="text-[9px] text-primary font-semibold">
                                +{punches.length - 2} more
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground/50 italic">
                            {status === 'weekoff' ? 'Off day' : 'No records'}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Punch Details & Edit Modal (matching screenshots) */}
      {selectedDate && (
        <AttendanceDayModal
          open={dayModalOpen}
          onOpenChange={setDayModalOpen}
          employeeId={employeeId}
          employeeName={employee.name}
          date={selectedDate}
          dayData={selectedDayData}
        />
      )}
    </>
  )
}
