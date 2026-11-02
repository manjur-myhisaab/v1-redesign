import { useState, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  Briefcase,
  Coffee,
  MapPin,
  ScanFace,
  Loader2,
  Calendar as CalendarIcon,
} from 'lucide-react'
import Panel from '@/components/admin/Panel'
import { useUserProfileQuery } from '@/features/auth/hooks/useUserProfile'
import PunchControls from '@/components/me/PunchControls'
import { useEmployeeMonthlySummaryQuery, useMyAttendanceSessionsQuery } from '@/features/attendance/hooks/useAttendance'
import type { AttendanceSummaryItem } from '@/features/attendance/types/attendanceApi.types'
import type { AttendanceDayStatus, PunchRecord } from '@/features/attendance/types/attendanceCalendar.types'
import { PageHeader } from './ui'
import { cn } from '@/lib/utils'

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
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return isoStr
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function calculateDuration(inIso: string | null | undefined, outIso: string | null | undefined): { text: string; minutes: number } {
  if (!inIso || !outIso) return { text: 'In Progress', minutes: 0 }
  const start = new Date(inIso).getTime()
  const end = new Date(outIso).getTime()
  if (isNaN(start) || isNaN(end) || end < start) return { text: '—', minutes: 0 }

  const diffSec = Math.floor((end - start) / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const hours = Math.floor(diffMin / 60)
  const mins = diffMin % 60
  const secs = diffSec % 60

  if (hours > 0) return { text: `${hours}h ${mins}m`, minutes: diffMin }
  if (mins > 0) return { text: `${mins}m ${secs > 0 ? `${secs}s` : ''}`.trim(), minutes: diffMin }
  return { text: `${secs}s`, minutes: 0 }
}

function formatGeoLocation(lat: number | null | undefined, lng: number | null | undefined): string {
  if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
  return 'Registered Workplace'
}

function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function Attendance() {
  const { data: profile } = useUserProfileQuery()

  // Calendar month state
  const [currentDate, setCurrentDate] = useState(() => new Date())
  // Currently selected date for the 1/3 side panel
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  // Tab inside date sessions view: 'sessions' | 'punches'
  const [sessionTab, setSessionTab] = useState<'sessions' | 'punches'>('sessions')

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthParam = `${year}-${String(month + 1).padStart(2, '0')}` // "YYYY-MM"

  const userId = profile?.user?.user_id || ''
  const activeShift = profile?.shifts?.[0]

  // 1. Fetch Monthly summary for the calendar view (Right 2/3)
  const { data: monthlySummaryRes, isLoading: loadingMonthly, refetch: refetchMonthly } = useEmployeeMonthlySummaryQuery(
    userId,
    monthParam,
    Boolean(userId)
  )

  const selectedDateStr = toLocalDateString(selectedDate)

  // 2. Fetch Date-wise attendance sessions for the selected date (Left 1/3)
  // Calls POST /api/v2/attendance/all with { attendance_date: selectedDateStr }
  const { data: dateSessions = [], isLoading: loadingSessions, refetch: refetchSessions } = useMyAttendanceSessionsQuery(
    selectedDateStr,
    Boolean(selectedDateStr)
  )

  const handlePunchActionComplete = () => {
    refetchMonthly()
    refetchSessions()
  }

  const monthName = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  // Map API monthly summary items into DayAttendance objects keyed by "YYYY-MM-DD"
  const monthData: Record<string, { status: AttendanceDayStatus; punches: PunchRecord[]; totalWorkedMinutes: number }> = useMemo(() => {
    const dataByDate: Record<string, { status: AttendanceDayStatus; punches: PunchRecord[]; totalWorkedMinutes: number }> = {}
    const daysInMonth = new Date(year, month + 1, 0).getDate()

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
            location: 'Workplace',
          })
        }
        if (apiItem.last_out) {
          punches.push({
            id: `last_out_${dateStr}`,
            status: 'OUT',
            time: formatIsoTime(apiItem.last_out),
            location: 'Workplace',
          })
        }
      }

      dataByDate[dateStr] = {
        status,
        punches,
        totalWorkedMinutes: apiItem?.total_working ?? 0,
      }
    }

    return dataByDate
  }, [monthlySummaryRes, year, month])

  // Calendar Grid Cells Generation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay() // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate()
    const prevMonthDays = new Date(year, month, 0).getDate()

    const days: {
      dayNumber: number
      isCurrentMonth: boolean
      dateStr: string
      dateObj: Date
      data?: { status: AttendanceDayStatus; punches: PunchRecord[]; totalWorkedMinutes: number }
    }[] = []

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i
      const prevDate = new Date(year, month - 1, dayNum)
      const dStr = toLocalDateString(prevDate)
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
      const dStr = toLocalDateString(thisDate)
      days.push({
        dayNumber: d,
        isCurrentMonth: true,
        dateStr: dStr,
        dateObj: thisDate,
        data: monthData[dStr],
      })
    }

    // Next month filler days (fill remaining of 42 cells)
    const remaining = 42 - days.length
    if (remaining < 7) {
      for (let n = 1; n <= remaining; n++) {
        const nextDate = new Date(year, month + 1, n)
        const dStr = toLocalDateString(nextDate)
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

  // Summary Metrics computed from monthData
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

  // Parse structured session items from dateSessions (POST /attendance/all)
  const parsedSessions = useMemo(() => {
    if (!Array.isArray(dateSessions)) return []

    return dateSessions.map((session, index) => {
      const shiftName =
        session.shift_snapshot?.shift_name ||
        activeShift?.shift_name ||
        'General Shift'
      const type: 'working' | 'break' =
        session.attendance_time_metrics === 'break' ? 'break' : 'working'
      const dur = calculateDuration(session.in_time, session.out_time)
      const loc = formatGeoLocation(
        session.geo_in_lat ?? session.geo_out_lat,
        session.geo_in_long ?? session.geo_out_long
      )
      const isFace =
        session.face_in === 'face' || session.face_out === 'face'

      return {
        id: session.attendance_id || `session-${index}`,
        type,
        shiftId: session.shift_id,
        inTimeStr: formatIsoTime(session.in_time),
        outTimeStr: formatIsoTime(session.out_time),
        rawInTime: session.in_time,
        rawOutTime: session.out_time,
        durationText: dur.text,
        durationMinutes: dur.minutes,
        location: loc,
        isFaceVerified: isFace,
        shiftName,
        photo: session.face_in && session.face_in !== 'face' ? session.face_in : null,
      }
    })
  }, [dateSessions, activeShift])

  // Compute total working vs break duration for selected date
  const dateTotals = useMemo(() => {
    let workSec = 0
    let breakSec = 0

    if (Array.isArray(dateSessions)) {
      dateSessions.forEach((s) => {
        if (s.in_time) {
          const endTime = s.out_time ? new Date(s.out_time).getTime() : new Date().getTime()
          const startTime = new Date(s.in_time).getTime()
          const diff = Math.max(0, Math.floor((endTime - startTime) / 1000))
          if (s.attendance_time_metrics === 'break') {
            breakSec += diff
          } else {
            workSec += diff
          }
        }
      })
    }

    const fmt = (sec: number) => {
      const m = Math.floor(sec / 60)
      const h = Math.floor(m / 60)
      const remM = m % 60
      const remS = sec % 60
      if (h > 0) return `${h}h ${remM}m`
      if (m > 0) return `${m}m ${remS > 0 ? `${remS}s` : ''}`.trim()
      return `${remS}s`
    }

    return {
      workText: fmt(workSec),
      breakText: fmt(breakSec),
      sessionCount: parsedSessions.length,
    }
  }, [dateSessions, parsedSessions])

  // Flat punch-by-punch entries (for the Raw Punches tab)
  const flatPunches = useMemo(() => {
    const list: Array<{
      id: string
      status: 'IN' | 'OUT'
      type: 'working' | 'break'
      time: string
      location: string
      isFaceVerified: boolean
    }> = []

    parsedSessions.forEach((s) => {
      if (s.inTimeStr && s.inTimeStr !== '—') {
        list.push({
          id: `${s.id}-in`,
          status: 'IN',
          type: s.type,
          time: s.inTimeStr,
          location: s.location,
          isFaceVerified: s.isFaceVerified,
        })
      }
      if (s.outTimeStr && s.outTimeStr !== '—') {
        list.push({
          id: `${s.id}-out`,
          status: 'OUT',
          type: s.type,
          time: s.outTimeStr,
          location: s.location,
          isFaceVerified: s.isFaceVerified,
        })
      }
    })
    return list
  }, [parsedSessions])

  const handlePrevMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }

  const handleGoToday = () => {
    const now = new Date()
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDate(now)
  }

  const isTodaySelected = toLocalDateString(selectedDate) === toLocalDateString(new Date())

  const formattedSelectedDate = selectedDate.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <Panel className="flex min-w-0 flex-1 flex-col h-full overflow-hidden bg-background">
      {/* Top Page Header */}
      <PageHeader
        title="Attendance & Daily Logs"
        subtitle={
          activeShift
            ? `Shift: ${activeShift.shift_name} (${activeShift.shift_from.substring(0, 5)}–${activeShift.shift_to.substring(0, 5)})`
            : profile?.user?.designation_name
            ? `${profile.user.designation_name} • ${profile.user.first_name} ${profile.user.last_name || ''}`
            : 'My attendance schedule & punch history'
        }
        action={<PunchControls compact onActionComplete={handlePunchActionComplete} />}
      />

      {/* Main Split Body: 1/3 Date Sessions (Left) + 2/3 Monthly Calendar (Right) */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-border">
        {/* ── LEFT 1/3: Date-wise Sessions & Punch Details ── */}
        <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 flex flex-col min-h-0 bg-card/60 overflow-hidden">
          {/* Selected Date Header Box */}
          <div className="p-4 border-b border-border bg-card shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <CalendarIcon className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-bold text-foreground truncate">
                      {formattedSelectedDate}
                    </h2>
                    {isTodaySelected && (
                      <span className="rounded bg-primary/15 text-primary text-[10px] font-bold px-1.5 py-0.2 border border-primary/20">
                        Today
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Daily Punch Sessions &amp; Time Log
                  </p>
                </div>
              </div>

              {/* View Switcher: Sessions vs Raw Punches */}
              <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-lg border border-border/70 text-xs">
                <button
                  type="button"
                  onClick={() => setSessionTab('sessions')}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer',
                    sessionTab === 'sessions'
                      ? 'bg-card text-foreground shadow-xs border border-border/40'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Sessions ({parsedSessions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSessionTab('punches')}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer',
                    sessionTab === 'punches'
                      ? 'bg-card text-foreground shadow-xs border border-border/40'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Punches ({flatPunches.length})
                </button>
              </div>
            </div>

            {/* Quick Metrics Cards for Selected Date */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1.5">
                <div className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300 uppercase flex items-center justify-center gap-1">
                  <Briefcase className="size-2.5" /> Work
                </div>
                <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {dateTotals.workText}
                </div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1.5">
                <div className="text-[9.5px] font-bold text-amber-700 dark:text-amber-300 uppercase flex items-center justify-center gap-1">
                  <Coffee className="size-2.5" /> Break
                </div>
                <div className="text-xs font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">
                  {dateTotals.breakText}
                </div>
              </div>
              <div className="bg-muted/80 border border-border rounded-lg px-2 py-1.5">
                <div className="text-[9.5px] font-bold text-muted-foreground uppercase flex items-center justify-center gap-1">
                  <Clock className="size-2.5" /> Count
                </div>
                <div className="text-xs font-extrabold text-foreground mt-0.5">
                  {dateTotals.sessionCount}
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Sessions / Punches List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-0">
            {loadingSessions ? (
              <div className="py-12 text-center text-muted-foreground space-y-2">
                <Loader2 className="size-6 animate-spin mx-auto text-primary" />
                <p className="text-xs font-medium">Fetching session details for {selectedDateStr}...</p>
              </div>
            ) : sessionTab === 'sessions' ? (
              parsedSessions.length === 0 ? (
                <div className="py-14 px-4 text-center text-muted-foreground border border-dashed border-border rounded-xl bg-card/40 my-2">
                  <Clock className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-foreground">No sessions on {formattedSelectedDate}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Punch in above or select a marked date from the calendar.
                  </p>
                </div>
              ) : (
                parsedSessions.map((s, idx) => (
                  <div
                    key={s.id || idx}
                    className={cn(
                      'rounded-xl border p-3 transition-all space-y-2 bg-card shadow-xs hover:border-primary/40',
                      s.type === 'working'
                        ? 'border-emerald-500/30 bg-emerald-500/[0.03]'
                        : 'border-amber-500/30 bg-amber-500/[0.03]'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {s.type === 'working' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            <Briefcase className="size-3" /> Work Session
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            <Coffee className="size-3" /> Break Session
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground font-medium">
                          #{parsedSessions.length - idx}
                        </span>
                      </div>

                      <span className="rounded bg-muted/90 px-2 py-0.5 text-[11px] font-bold text-foreground border border-border/80">
                        {s.durationText}
                      </span>
                    </div>

                    {/* In / Out Timings */}
                    <div className="flex items-center justify-between rounded-lg bg-background/80 border border-border/60 px-3 py-2 text-xs">
                      <div>
                        <div className="text-[9.5px] uppercase font-bold text-muted-foreground">In Time</div>
                        <div className="font-bold text-foreground">{s.inTimeStr}</div>
                      </div>
                      <div className="text-muted-foreground text-xs font-bold">➔</div>
                      <div className="text-right">
                        <div className="text-[9.5px] uppercase font-bold text-muted-foreground">Out Time</div>
                        <div className="font-bold text-foreground">{s.outTimeStr}</div>
                      </div>
                    </div>

                    {/* Metadata: Location & Face Verification */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                      <div className="flex items-center gap-1 truncate max-w-[200px]" title={s.location}>
                        <MapPin className="size-3 text-muted-foreground/70 shrink-0" />
                        <span className="truncate">{s.location}</span>
                      </div>

                      {s.isFaceVerified ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <ScanFace className="size-2.5" /> Face Verified
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/60 font-medium">
                          {s.shiftName}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )
            ) : (
              /* Raw Punches View */
              flatPunches.length === 0 ? (
                <div className="py-14 px-4 text-center text-muted-foreground border border-dashed border-border rounded-xl bg-card/40 my-2">
                  <p className="text-xs font-medium">No punch records found for this date.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden bg-card shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/60 text-muted-foreground font-semibold border-b border-border text-[11px]">
                        <th className="py-2 px-2.5 w-14 text-center">Status</th>
                        <th className="py-2 px-2.5">Time</th>
                        <th className="py-2 px-2.5">Type</th>
                        <th className="py-2 px-2.5">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-foreground">
                      {flatPunches.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/30">
                          <td className="py-2 px-2.5 text-center">
                            <span
                              className={cn(
                                'inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                                p.status === 'IN'
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-rose-500 text-white'
                              )}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 font-bold text-foreground whitespace-nowrap">
                            {p.time}
                          </td>
                          <td className="py-2 px-2.5 text-muted-foreground capitalize text-[11px]">
                            {p.type}
                          </td>
                          <td className="py-2 px-2.5 text-muted-foreground truncate max-w-[120px]" title={p.location}>
                            {p.location}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>

        {/* ── RIGHT 2/3: Monthly Calendar View & Overview ── */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Month Toolbar & Overview Cards */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-xs">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary shrink-0" />
              <h3 className="text-sm font-bold text-foreground">Monthly Attendance Calendar</h3>
              {loadingMonthly && <Loader2 className="size-3.5 animate-spin text-muted-foreground ml-1" />}
            </div>

            {/* Navigation & Month Picker Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGoToday}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border/80 transition-colors cursor-pointer"
              >
                Today
              </button>

              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/70">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="text-xs font-bold text-foreground px-2.5 whitespace-nowrap">
                  {monthName}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar for Month */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 text-center">
              <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                Present
              </div>
              <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                {summary.present}
              </div>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2 text-center">
              <div className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase">
                Absent
              </div>
              <div className="text-lg font-extrabold text-rose-600 dark:text-rose-400">
                {summary.absent}
              </div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-center">
              <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">
                Half Day
              </div>
              <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                {summary.halfday}
              </div>
            </div>
            <div className="bg-muted border border-border/80 rounded-xl px-3 py-2 text-center">
              <div className="text-[10px] font-bold text-muted-foreground uppercase">Week Off</div>
              <div className="text-lg font-extrabold text-foreground">{summary.weekoff}</div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 text-center col-span-2 sm:col-span-1">
              <div className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase">
                Leave
              </div>
              <div className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                {summary.leave}
              </div>
            </div>
          </div>

          {/* Event Calendar Grid */}
          <div className="overflow-x-auto pb-2 flex-1">
            <div className="rounded-xl w-full min-w-[680px] border border-border overflow-hidden bg-card shadow-xs">
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
                  const isSelected = cell.dateStr === selectedDateStr

                  if (!cell.isCurrentMonth) {
                    return (
                      <div
                        key={idx}
                        className="min-h-[82px] p-2 bg-muted/20 text-muted-foreground/40 text-xs select-none"
                      >
                        <span className="font-semibold">{cell.dayNumber}</span>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDate(cell.dateObj)}
                      className={cn(
                        'min-h-[82px] p-2 transition-all cursor-pointer group flex flex-col justify-between relative select-none',
                        'hover:bg-muted/40 hover:z-10',
                        isSelected && 'ring-2 ring-primary ring-inset bg-primary/10 shadow-sm z-10',
                        status === 'present' && !isSelected && 'bg-emerald-500/5',
                        status === 'absent' && !isSelected && 'bg-rose-500/5',
                        status === 'halfday' && !isSelected && 'bg-amber-500/5',
                        status === 'weekoff' && !isSelected && 'bg-muted/30'
                      )}
                    >
                      {/* Top Date Header */}
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'text-xs font-bold transition-colors',
                            isSelected
                              ? 'text-primary font-extrabold'
                              : 'text-foreground group-hover:text-primary'
                          )}
                        >
                          {cell.dayNumber}
                        </span>
                        {config && (
                          <span
                            className={cn(
                              'text-[9.5px] font-extrabold px-1.5 py-0.2 rounded border uppercase tracking-wider',
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
                      <div className="mt-1 space-y-0.5">
                        {punches.length > 0 ? (
                          <div className="text-[10px] font-medium text-muted-foreground space-y-0.5">
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
                          <div className="text-[9.5px] text-muted-foreground/50 italic">
                            {status === 'weekoff' ? 'Off day' : '—'}
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
    </Panel>
  )
}

