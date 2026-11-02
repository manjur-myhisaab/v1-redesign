import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  Clock,
  LogOut,
  MoreHorizontal,
  Loader2,
  Plus,
  X,
  Coffee,
  Briefcase,
  Layers,
  Tag,
} from 'lucide-react'
import Panel from '@/components/admin/Panel'
import MetricCard from '@/components/admin/MetricCard'
import EmployeeAttendanceSheet from '@/features/attendance/components/EmployeeAttendanceSheet'
import {
  useDailyAttendanceSummaryQuery,
  useEmployeeDaySessionsQuery,
  useRegisterBulkAttendanceMutation,
  useUpdateBulkAttendanceMutation,
} from '@/features/attendance/hooks/useAttendance'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AttendanceSummaryItem, BulkAttendanceItem } from '@/features/attendance/types/attendanceApi.types'
import { toast } from 'sonner'
import { EmployeeAvatar } from '@/lib/people'
import { DatePicker } from '@/components/ui/date-picker'
import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import { useEmployeesQuery } from '@/features/employees/hooks/useEmployees'
import { useShiftsQuery } from '@/features/shifts/hooks/useShifts'
import { useCategoriesQuery } from '@/features/categories/hooks/useCategories'
import {
  type RosterSubject,
  type AttendanceStatus,
  type PunchSession,
  type Shift,
} from '@/lib/api'
import { genConfig, type AvatarFullConfig } from 'react-nice-avatar'

// ─── date helpers (local, timezone-safe) ───
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const longDate = (d: Date) =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })

// ─── time helpers ───
const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const span = (inT: string, outT: string) => {
  if (!inT || !outT) return 0
  const d = toMin(outT) - toMin(inT)
  // Equal marks = 0 (a same-minute punch), not a spurious 24h; only a genuinely
  // negative delta means the shift wrapped past midnight.
  return d >= 0 ? d : d + 24 * 60
}
const fmtDur = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
}
const sessionTotals = (sessions: PunchSession[]) => {
  let worked = 0
  let brk = 0
  for (const s of sessions) {
    const d = span(s.in, s.out)
    if (s.type === 'break') brk += d
    else worked += d
  }
  return { worked, brk }
}

export const buildIsoDateTime = (dateStr: string, timeStr?: string | null): string => {
  if (!timeStr) {
    const [y, m, d] = dateStr.split('-').map(Number)
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)).toISOString()
    }
    return `${dateStr}T00:00:00.000Z`
  }
  if (timeStr.includes('T')) {
    const d = new Date(timeStr)
    if (!isNaN(d.getTime())) {
      return d.toISOString()
    }
    return timeStr
  }
  const clean = timeStr.trim().slice(0, 5)
  const parts = clean.split(':')
  if (parts.length >= 2) {
    const hh = Number(parts[0])
    const mm = Number(parts[1])
    const [y, m, d] = dateStr.split('-').map(Number)
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && !isNaN(hh) && !isNaN(mm)) {
      // Create exact timestamp in user's local timezone and convert to standard ISO UTC timestamp ending with .000Z
      const localDate = new Date(y, m - 1, d, hh, mm, 0, 0)
      return localDate.toISOString()
    }
    return `${dateStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00.000Z`
  }
  return `${dateStr}T00:00:00.000Z`
}

// ─── status model ───
type Marked = '' | AttendanceStatus

interface Draft {
  status: Marked
  late: boolean
  earlyOut: boolean
  sessions: PunchSession[] // each work session carries its own shiftId
  firstIn?: string | null
  lastOut?: string | null
  summaryWorkedMin?: number | null
  summaryBreakMin?: number | null
}

const formatPunchTime = (timeStr: string | null | undefined): string => {
  if (!timeStr) return '--:--'
  if (timeStr.includes('T') || timeStr.includes('-')) {
    const d = new Date(timeStr)
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    }
  }
  const parts = timeStr.split(':')
  if (parts.length >= 2) {
    const h = Number(parts[0])
    const m = Number(parts[1])
    if (!isNaN(h) && !isNaN(m)) {
      const period = h >= 12 ? 'PM' : 'AM'
      const h12 = h % 12 || 12
      return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`
    }
  }
  return timeStr
}

const PRIMARY: { key: AttendanceStatus; label: string; short: string; active: string }[] = [
  { key: 'present', label: 'Present', short: 'P', active: 'bg-emerald-500 text-white ring-emerald-500' },
  { key: 'leave', label: 'Leave', short: 'L', active: 'bg-blue-500 text-white ring-blue-500' },
  { key: 'absent', label: 'Absent', short: 'A', active: 'bg-rose-500 text-white ring-rose-500' },
]
const MORE: { key: AttendanceStatus; label: string }[] = [
  { key: 'weekoff', label: 'Week off' },
  { key: 'holiday', label: 'Holiday' },
]
const ALL_STATUS = [...PRIMARY, ...MORE.map((m) => ({ ...m, short: '', active: '' }))]
const statusLabel = (s: Marked) => ALL_STATUS.find((x) => x.key === s)?.label ?? '—'

type Filter = 'all' | 'employee' | 'member'

const memberAvatar = (raw: string, name: string): AvatarFullConfig => {
  if (raw) {
    try {
      return JSON.parse(raw) as AvatarFullConfig
    } catch {
      /* fall through */
    }
  }
  return genConfig(name)
}

export default function Attendance() {
  const { firstTabActive } = useShell()
  const { activeWorkspace } = useAuth()
  const canMark = activeWorkspace?.role === 'Owner' || activeWorkspace?.role === 'Admin'

  const [date, setDate] = useState(() => new Date())
  const { data: employees = [], isLoading: loadingEmployees } = useEmployeesQuery()
  const { data: apiShifts = [] } = useShiftsQuery()

  const shifts: Shift[] = useMemo(() => {
    if (!apiShifts || !apiShifts.length) return []
    return apiShifts.map((s) => ({
      id: s.shift_id,
      name: s.shift_name,
      startTime: s.shift_from || '09:00',
      endTime: s.shift_to || '18:00',
      isOvernight: Boolean(s.applicable_for_overnight),
      breakMinutes: s.applicable_for_break ? 60 : 0,
      color: '#3b82f6',
    }))
  }, [apiShifts])

  const subjects: RosterSubject[] = useMemo(() => {
    return employees.filter((emp) => { const st = (emp.status || '').toLowerCase(); return st !== 'archived' && st !== 'suspended'; }).map((emp) => {
      const id = String(emp.id || emp.user_id || '')
      const deptAndRole = [emp.department, emp.role].filter(Boolean).join(' · ')
      return {
        id,
        kind: 'employee' as const,
        employeeId: id,
        name: emp.name || 'No Name',
        gender: emp.gender || '',
        avatar: '',
        subtitle: deptAndRole || emp.empCode || 'Employee',
        department: emp.department || '',
        shiftId: emp.shiftId || null,
        rosterShiftId: emp.shiftId || null,
        rosterWeekOff: false,
        categoryId: emp.categoryId,
        categoryIds: emp.categoryIds,
        category: emp.category,
        rawUser: emp.rawUser,
        record: {
          status: 'present',
          shiftId: emp.shiftId || null,
          checkIn: '09:00',
          checkOut: '18:00',
          late: false,
          earlyOut: false,
          source: 'manual',
          sessions: [{ type: 'work', in: '09:00', out: '18:00', shiftId: emp.shiftId || null }],
          workedMin: 540,
          breakMin: 0,
        },
      }
    })
  }, [employees])

  const { data: categories = [] } = useCategoriesQuery()
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('all')
  const [selectedEmployeeForSheet, setSelectedEmployeeForSheet] = useState<RosterSubject | null>(null)

  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [filter] = useState<Filter>('all')
  const [openPunchRowIds, setOpenPunchRowIds] = useState<Record<string, boolean>>({})

  const dstr = ymd(date)

  // 1. Fetch live daily attendance summary from API
  const { data: dailySummaryRes, isLoading: loadingSummary } = useDailyAttendanceSummaryQuery(dstr)
  const loading = loadingEmployees || loadingSummary

  // working copy + the server baseline (to compute what's dirty)
  const [draft, setDraft] = useState<Record<string, Draft>>({})
  const baseline = useRef<Record<string, Draft>>({})

  // Map summary records by user_id
  const summaryByUser = useMemo(() => {
    const map = new Map<string, AttendanceSummaryItem>()
    if (dailySummaryRes?.data && Array.isArray(dailySummaryRes.data)) {
      for (const item of dailySummaryRes.data) {
        if (item.user_id) {
          map.set(item.user_id, item)
        }
      }
    }
    return map
  }, [dailySummaryRes])

  // Initialize and update draft with real API attendance status for all employees
  useEffect(() => {
    const init: Record<string, Draft> = {}
    for (const s of subjects) {
      const summary =
        summaryByUser.get(s.id) ||
        (s.employeeId ? summaryByUser.get(s.employeeId) : undefined) ||
        (s.rawUser?.user_id ? summaryByUser.get(s.rawUser.user_id) : undefined) ||
        (s.rawUser?.ufid ? summaryByUser.get(s.rawUser.ufid) : undefined)
      let status: AttendanceStatus = 'absent'
      let late = false
      let earlyOut = false
      let sessions: PunchSession[] = []
      let summaryWorkedMin: number | null = null
      let summaryBreakMin: number | null = null

      if (summary) {
        if (summary.is_present || summary.attendance_status?.toUpperCase() === 'PRESENT') {
          status = 'present'
        } else if (summary.is_halfday || summary.attendance_status?.toUpperCase() === 'HALFDAY') {
          status = 'halfday'
        } else if (summary.is_holiday || summary.attendance_status?.toUpperCase() === 'HOLIDAY') {
          status = 'holiday'
        } else if (summary.attendance_status?.toUpperCase() === 'WEEKOFF') {
          status = 'weekoff'
        } else if (summary.attendance_status?.toUpperCase() === 'LEAVE') {
          status = 'leave'
        } else if (summary.is_absent || summary.attendance_status?.toUpperCase() === 'ABSENT') {
          status = 'absent'
        }

        late = Boolean(summary.is_late)
        earlyOut = Boolean(summary.is_early)

        if (summary.total_working != null && summary.total_working > 0) {
          summaryWorkedMin = summary.total_working > 1440
            ? Math.round(summary.total_working / 60)
            : Math.round(summary.total_working)
        }
        if (summary.total_break != null && summary.total_break > 0) {
          summaryBreakMin = summary.total_break > 1440
            ? Math.round(summary.total_break / 60)
            : Math.round(summary.total_break)
        }

        let inTime = '09:00'
        let outTime = '18:00'
        if (summary.first_in) {
          const d = new Date(summary.first_in)
          if (!isNaN(d.getTime())) {
            inTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          }
        }
        if (summary.last_out) {
          const d = new Date(summary.last_out)
          if (!isNaN(d.getTime())) {
            outTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          }
        }

        if (summary.first_in || summary.last_out) {
          const existingAttendanceId = summary.attendance_id?.[0]
          sessions = [{ id: existingAttendanceId, type: 'work', in: inTime, out: outTime, shiftId: s.rosterShiftId ?? null }]
          if (summaryWorkedMin == null) {
            const totalSpan = span(inTime, outTime)
            const brk = summaryBreakMin ?? 0
            summaryWorkedMin = Math.max(0, totalSpan - brk)
          }
        }
      } else {
        // If employee has no record in summary for this date, default to absent
        status = 'absent'
      }

      init[s.id] = {
        status,
        late,
        earlyOut,
        sessions: sessions.length ? sessions : (status === 'absent' ? [] : (s.record?.sessions ?? [])),
        firstIn: summary?.first_in ?? (sessions[0]?.in ?? null),
        lastOut: summary?.last_out ?? (sessions[sessions.length - 1]?.out ?? null),
        summaryWorkedMin,
        summaryBreakMin,
      }
    }
    baseline.current = structuredClone(init)
    setDraft(structuredClone(init))
  }, [subjects, dstr, summaryByUser])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return subjects.filter((s) => {
      if (filter !== 'all' && s.kind !== filter) return false
      if (q && !s.name.toLowerCase().includes(q) && !s.subtitle.toLowerCase().includes(q))
        return false

      const matchesCategory =
        selectedCategoryTab === 'all' ||
        s.categoryId === selectedCategoryTab ||
        s.categoryIds?.includes(selectedCategoryTab) ||
        s.rawUser?.category_id === selectedCategoryTab ||
        (s.category && s.category.toLowerCase() === selectedCategoryTab.toLowerCase()) ||
        (s.category &&
          categories.find((c) => (c.category_id || (c as any).id) === selectedCategoryTab)?.category_name?.toLowerCase() ===
          s.category.toLowerCase())

      return matchesCategory
    })
  }, [subjects, query, filter, selectedCategoryTab, categories])

  const counts = useMemo(() => {
    const c = { present: 0, halfday: 0, leave: 0, absent: 0, off: 0, unmarked: 0, late: 0 }
    for (const s of subjects) {
      const st = draft[s.id]?.status ?? ''
      if (st === 'present') c.present++
      else if (st === 'halfday') c.halfday++
      else if (st === 'leave') c.leave++
      else if (st === 'absent') c.absent++
      else if (st === 'weekoff' || st === 'holiday') c.off++
      else c.unmarked++
      if ((st === 'present' || st === 'halfday') && draft[s.id]?.late) c.late++
    }
    return c
  }, [subjects, draft])

  const dirtyIds = useMemo(
    () =>
      Object.keys(draft).filter((id) => {
        const a = draft[id]
        const b = baseline.current[id]
        return (
          a.status !== b.status ||
          a.late !== b.late ||
          a.earlyOut !== b.earlyOut ||
          JSON.stringify(a.sessions) !== JSON.stringify(b.sessions)
        )
      }),
    [draft],
  )

  const setStatus = (id: string, status: AttendanceStatus) => {
    sound.click()
    setDraft((d) => {
      const cur: Draft = d[id] ?? { status: '', late: false, earlyOut: false, sessions: [] }
      // toggle off if re-tapping the same status
      const next = cur.status === status ? '' : status
      const present = next === 'present' || next === 'halfday'
      return {
        ...d,
        [id]: { ...cur, status: next, late: present && cur.late, earlyOut: present && cur.earlyOut },
      }
    })
  }

  const toggleFlag = (id: string, flag: 'late' | 'earlyOut') =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], [flag]: !d[id][flag] } }))

  const setSessions = (id: string, sessions: PunchSession[]) =>
    setDraft((d) => {
      const cur = d[id]
      // first punch implies the person was present
      const status = cur.status || (sessions.length ? 'present' : '')
      return { ...d, [id]: { ...cur, sessions, status } }
    })

  const markAllPresent = () => {
    sound.toggle()
    setDraft((d) => {
      const next = { ...d }
      for (const s of filtered) next[s.id] = { ...next[s.id], status: 'present' }
      return next
    })
  }

  const registerBulkMutation = useRegisterBulkAttendanceMutation()
  const updateBulkMutation = useUpdateBulkAttendanceMutation()

  const save = async () => {
    if (saving || !dirtyIds.length) return
    setSaving(true)
    const byId = new Map(subjects.map((s) => [s.id, s]))
    const createItems: BulkAttendanceItem[] = []
    const updateItems: BulkAttendanceItem[] = []
    const firmId = activeWorkspace?.id || ''
    const attendanceDateIso = buildIsoDateTime(dstr)

    for (const id of dirtyIds) {
      const s = byId.get(id)
      const dr = draft[id]
      if (!s || !dr) continue

      const userId = String(s.rawUser?.user_id || s.employeeId || s.id || '')
      const defaultShiftId = s.rosterShiftId || s.shiftId || shifts[0]?.id || ''
      const summary =
        summaryByUser.get(s.id) ||
        (s.employeeId ? summaryByUser.get(s.employeeId) : undefined) ||
        (s.rawUser?.user_id ? summaryByUser.get(s.rawUser.user_id) : undefined)
      const existingAttendanceId = summary?.attendance_id?.[0]

      if (dr.sessions && dr.sessions.length > 0) {
        for (const sess of dr.sessions) {
          const shiftId = sess.shiftId || defaultShiftId
          const inTimeIso = buildIsoDateTime(dstr, sess.in)
          const outTimeIso = buildIsoDateTime(dstr, sess.out)
          const metrics: 'working' | 'break' = sess.type === 'break' ? 'break' : 'working'
          const attendanceId = sess.id || existingAttendanceId

          if (attendanceId) {
            updateItems.push({
              attendance_id: attendanceId,
              user_id: userId,
              firm_id: firmId,
              shift_id: shiftId,
              attendance_date: attendanceDateIso,
              in_time: inTimeIso,
              out_time: outTimeIso,
              attendance_time_metrics: metrics,
            })
          } else {
            createItems.push({
              user_id: userId,
              firm_id: firmId,
              shift_id: shiftId,
              attendance_date: attendanceDateIso,
              in_time: inTimeIso,
              out_time: outTimeIso,
              attendance_time_metrics: metrics,
            })
          }
        }
      } else if (dr.status === 'present' || dr.status === 'halfday') {
        const inTimeIso = buildIsoDateTime(dstr, '09:00')
        const outTimeIso = buildIsoDateTime(dstr, dr.status === 'halfday' ? '13:30' : '18:00')
        if (existingAttendanceId) {
          updateItems.push({
            attendance_id: existingAttendanceId,
            user_id: userId,
            firm_id: firmId,
            shift_id: defaultShiftId,
            attendance_date: attendanceDateIso,
            in_time: inTimeIso,
            out_time: outTimeIso,
            attendance_time_metrics: 'working',
          })
        } else {
          createItems.push({
            user_id: userId,
            firm_id: firmId,
            shift_id: defaultShiftId,
            attendance_date: attendanceDateIso,
            in_time: inTimeIso,
            out_time: outTimeIso,
            attendance_time_metrics: 'working',
          })
        }
      }
    }

    try {
      if (updateItems.length > 0) {
        console.log('📝 [Attendance Save] Bulk Update Payload (PUT):', updateItems)
        await updateBulkMutation.mutateAsync(updateItems)
      }
      if (createItems.length > 0) {
        console.log('✨ [Attendance Save] Bulk Register Payload (POST):', createItems)
        await registerBulkMutation.mutateAsync(createItems)
      }
      if (updateItems.length > 0 || createItems.length > 0) {
        toast.success(`Saved attendance for ${dirtyIds.length} person(s)`)
      }
      setOpenPunchRowIds({})
      baseline.current = structuredClone(draft)
      setDraft((d) => ({ ...d }))
    } catch {
      // Handled in mutation onError
    } finally {
      setSaving(false)
    }
  }

  const isToday = dstr === ymd(new Date())

  return (
    <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
      {/* summary metrics for the selected day */}
      <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-border p-4 lg:grid-cols-4">
        <MetricCard label="Present" value={loading ? '—' : String(counts.present + counts.halfday)} />
        <MetricCard label="Absent" value={loading ? '—' : String(counts.absent)} />
        <MetricCard label="Late" value={loading ? '—' : String(counts.late)} />
        <MetricCard label="On leave" value={loading ? '—' : String(counts.leave)} />
      </div>

      {/* header: day navigation + actions */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-semibold tracking-tight">Attendance</h2>
          <span className="text-muted-foreground">·</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDate((d) => addDays(d, -1))}
              aria-label="Previous day"
              className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <DatePicker
              value={date}
              onChange={(d) => d && setDate(d)}
              className="h-8 w-[230px]"
            />
            <button
              onClick={() => setDate((d) => addDays(d, 1))}
              aria-label="Next day"
              className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
            {!isToday && (
              <button
                onClick={() => setDate(new Date())}
                className="ml-1 cursor-pointer rounded-md px-2 py-1 text-[13px] font-medium text-[#2f63d8] transition-colors hover:bg-[#2f63d8]/10"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {canMark && (
          <div className="flex items-center gap-2">
            <button
              onClick={markAllPresent}
              disabled={loading}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              Mark all present
            </button>
            <button
              onClick={save}
              disabled={saving || !dirtyIds.length}
              className="btn-3d inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-3.5 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              {saving ? 'Saving…' : dirtyIds.length ? `Save (${dirtyIds.length})` : 'Saved'}
            </button>
          </div>
        )}
      </div>

      {/* sub-header: date label + summary chips + search/filter */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-2.5">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="font-medium">{longDate(date)}</span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <Chip tone="emerald" label="Present" n={counts.present} />
            <Chip tone="amber" label="Half" n={counts.halfday} />
            <Chip tone="blue" label="Leave" n={counts.leave} />
            <Chip tone="rose" label="Absent" n={counts.absent} />
            {counts.unmarked > 0 && <Chip tone="gray" label="Unmarked" n={counts.unmarked} />}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people…"
              className="h-8 w-44 rounded-lg border border-border bg-card pl-8 pr-3 text-[13px] outline-none transition-colors focus:border-ring"
            />
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      {categories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-muted/20 px-5 py-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategoryTab('all')}
            className={cn(
              'flex cursor-pointer shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all',
              selectedCategoryTab === 'all'
                ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                : 'border-border bg-card text-muted-foreground hover:bg-muted/80 hover:text-foreground',
            )}
          >
            <Layers className="size-3.5" />
            <span>All</span>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                selectedCategoryTab === 'all'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {subjects.length}
            </span>
          </button>

          {categories.map((cat) => {
            const catId = cat.category_id || (cat as any).id || ''
            const catName = cat.category_name || (cat as any).name || 'Unnamed Category'
            const count = subjects.filter(
              (s) =>
                s.categoryId === catId ||
                s.categoryIds?.includes(catId) ||
                s.rawUser?.category_id === catId ||
                (s.category && s.category.toLowerCase() === catName.toLowerCase()),
            ).length
            const isSelected =
              selectedCategoryTab === catId ||
              selectedCategoryTab.toLowerCase() === catName.toLowerCase()

            return (
              <button
                key={catId}
                type="button"
                onClick={() => setSelectedCategoryTab(catId)}
                className={cn(
                  'flex cursor-pointer shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                )}
              >
                <Tag className="size-3" />
                <span>{catName}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                    isSelected
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* register */}
      {loading ? (
        <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">
          Loading register…
        </div>
      ) : filtered.length === 0 ? (
        <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">
          No people to show.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ul className="divide-y divide-border">
            {filtered.map((s) => (
              <Row
                key={s.id}
                subject={s}
                dateStr={dstr}
                draft={draft[s.id]}
                canMark={canMark}
                shifts={shifts}
                punchOpen={Boolean(openPunchRowIds[s.id])}
                onTogglePunch={() =>
                  setOpenPunchRowIds((prev) => ({ ...prev, [s.id]: !prev[s.id] }))
                }
                onSelectEmployee={(sub) => setSelectedEmployeeForSheet(sub)}
                onStatus={(st) => setStatus(s.id, st)}
                onFlag={(f) => toggleFlag(s.id, f)}
                onSessions={(ss) => setSessions(s.id, ss)}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Employee Attendance Calendar Sheet (Large half-screen sheet) */}
      <EmployeeAttendanceSheet
        employee={selectedEmployeeForSheet}
        open={Boolean(selectedEmployeeForSheet)}
        onOpenChange={(open) => !open && setSelectedEmployeeForSheet(null)}
      />
    </Panel>
  )
}

function Row({
  subject,
  dateStr,
  draft,
  canMark,
  shifts,
  punchOpen,
  onTogglePunch,
  onSelectEmployee,
  onStatus,
  onFlag,
  onSessions,
}: {
  subject: RosterSubject
  dateStr: string
  draft: Draft
  canMark: boolean
  shifts: Shift[]
  punchOpen: boolean
  onTogglePunch: () => void
  onSelectEmployee: (subject: RosterSubject) => void
  onStatus: (s: AttendanceStatus) => void
  onFlag: (f: 'late' | 'earlyOut') => void
  onSessions: (s: PunchSession[]) => void
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const status = draft?.status ?? ''
  const present = status === 'present' || status === 'halfday'
  const isOff = status === 'weekoff' || status === 'holiday'
  const sessions = draft?.sessions ?? []
  const { worked: sessionWorked, brk: sessionBrk } = sessionTotals(sessions)
  const hasDetailedSessions = sessions.length > 1 || sessions.some((s) => s.type === 'break')
  const worked = hasDetailedSessions ? sessionWorked : (draft?.summaryWorkedMin ?? sessionWorked)
  const brk = hasDetailedSessions ? sessionBrk : (draft?.summaryBreakMin ?? sessionBrk)

  return (
    <li
      onClick={() => onSelectEmployee(subject)}
      className="px-5 py-2.5 transition-colors hover:bg-muted/40 cursor-pointer"
    >
      <div className="flex items-center gap-3">
        {/* identity (click anywhere on row to open monthly attendance sheet) */}
        <div
          className="flex min-w-0 flex-1 items-center gap-2.5 group"
          title="Click to view monthly attendance calendar"
        >
          {subject.kind === 'member' ? (
            <EmployeeAvatar
              name={subject.name}
              config={memberAvatar(subject.avatar, subject.name)}
              className="size-8 shrink-0 group-hover:ring-2 group-hover:ring-primary/40 transition-all"
            />
          ) : (
            <EmployeeAvatar
              name={subject.name}
              sex={subject.gender === 'man' ? 'man' : subject.gender === 'woman' ? 'woman' : undefined}
              className="size-8 shrink-0 group-hover:ring-2 group-hover:ring-primary/40 transition-all"
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-medium group-hover:text-primary transition-colors">
                {subject.name}
              </span>
              {subject.kind === 'member' && (
                <span className="rounded bg-[#2f63d8]/10 px-1.5 py-px text-[10px] font-medium text-[#2f63d8]">
                  Member
                </span>
              )}
            </div>
            {subject.subtitle && (
              <div className="truncate text-[12px] text-muted-foreground">{subject.subtitle}</div>
            )}
          </div>
        </div>

        {/* In & Out Time display */}
        {(() => {
          const inTimeStr = draft?.firstIn || (sessions.length > 0 && sessions[0].in ? sessions[0].in : null)
          const outTimeStr = draft?.lastOut || (sessions.length > 0 && sessions[sessions.length - 1].out ? sessions[sessions.length - 1].out : null)
          return (
            <div
              onClick={(e) => {
                e.stopPropagation()
                onSelectEmployee(subject)
              }}
              title="In & Out Time (Click to view monthly calendar)"
              className="hidden h-7 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-2.5 text-[11px] font-medium transition-colors hover:bg-muted sm:inline-flex"
            >
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">In:</span>
                <span
                  className={cn(
                    'tabular-nums font-medium',
                    inTimeStr ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/60'
                  )}
                >
                  {formatPunchTime(inTimeStr)}
                </span>
              </div>
              <span className="text-border">|</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Out:</span>
                <span
                  className={cn(
                    'tabular-nums font-medium',
                    outTimeStr ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground/60'
                  )}
                >
                  {formatPunchTime(outTimeStr)}
                </span>
              </div>
            </div>
          )
        })()}

        {/* punch summary / toggle */}
        {canMark && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onTogglePunch()
            }}
            title="Punch times & breaks"
            className={cn(
              'hidden h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-colors sm:inline-flex',
              punchOpen
                ? 'border-[#2f63d8] bg-[#2f63d8]/5 text-[#2f63d8]'
                : 'border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            <Clock className="size-3 shrink-0" />
            {sessions.length > 0 || worked > 0 || brk > 0 ? (
              <span className="tabular-nums flex items-center gap-1">
                <span className="font-semibold text-foreground">{fmtDur(worked)}</span>
                {brk > 0 && (
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    · {fmtDur(brk)} brk
                  </span>
                )}
              </span>
            ) : (
              'Punches'
            )}
          </button>
        )}

        {/* late / early flags (only when present-ish) */}
        {canMark && present && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="hidden items-center gap-1.5 md:flex"
          >
            <FlagToggle
              active={draft.late}
              onClick={() => onFlag('late')}
              icon={<Clock className="size-3" />}
              label="Late"
            />
            <FlagToggle
              active={draft.earlyOut}
              onClick={() => onFlag('earlyOut')}
              icon={<LogOut className="size-3" />}
              label="Early"
            />
          </div>
        )}

        {/* status control */}
        {canMark ? (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5"
          >
            {isOff ? (
              <span className="inline-flex h-7 items-center rounded-lg bg-slate-100 px-3 text-[12px] font-medium text-slate-600">
                {statusLabel(status)}
              </span>
            ) : (
              <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
                {PRIMARY.map((p) => (
                  <button
                    key={p.key}
                    title={p.label}
                    onClick={() => onStatus(p.key)}
                    className={cn(
                      'grid size-7 cursor-pointer place-items-center rounded-md text-[12px] font-semibold ring-1 ring-transparent transition-colors',
                      status === p.key
                        ? p.active
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {p.short}
                  </button>
                ))}
              </div>
            )}

            <div className="relative">
              <button
                onClick={() => setMoreOpen((o) => !o)}
                aria-label="More statuses"
                className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                  <div className="absolute right-full -top-4 z-50 mt-1 w-36 overflow-hidden rounded-lg border border-border bg-background py-1 shadow-lg">
                    {MORE.map((m) => (
                      <button
                        key={m.key}
                        onClick={() => {
                          onStatus(m.key)
                          setMoreOpen(false)
                        }}
                        className={cn(
                          'flex w-full cursor-pointer items-center px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-muted',
                          status === m.key && 'font-medium',
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <ReadOnlyStatus
            status={status}
            late={draft?.late}
            earlyOut={draft?.earlyOut}
            sessions={sessions}
            workedMin={draft?.summaryWorkedMin}
            breakMin={draft?.summaryBreakMin}
          />
        )}
      </div>

      {/* punch / break editor */}
      {canMark && punchOpen && (
        <PunchEditor
          subject={subject}
          dateStr={dateStr}
          sessions={sessions}
          worked={worked}
          brk={brk}
          shifts={shifts}
          defaultShiftId={subject.rosterShiftId}
          onChange={onSessions}
        />
      )}
    </li>
  )
}

function PunchEditor({
  subject,
  dateStr,
  sessions,
  worked,
  brk,
  shifts,
  defaultShiftId,
  onChange,
}: {
  subject: RosterSubject
  dateStr: string
  sessions: PunchSession[]
  worked: number
  brk: number
  shifts: Shift[]
  defaultShiftId: string | null
  onChange: (s: PunchSession[]) => void
}) {
  const employeeId = String(subject.id || subject.employeeId || subject.rawUser?.user_id || '')
  const { data: daySessionsRes, isLoading: loadingSessions } = useEmployeeDaySessionsQuery(
    employeeId,
    dateStr,
    Boolean(employeeId) && Boolean(dateStr)
  )

  // Initialize/sync sessions from real API day sessions if available
  const hasInitializedFromApi = useRef(false)
  useEffect(() => {
    if (
      daySessionsRes?.data &&
      Array.isArray(daySessionsRes.data) &&
      daySessionsRes.data.length > 0 &&
      !hasInitializedFromApi.current
    ) {
      hasInitializedFromApi.current = true
      const mappedSessions: PunchSession[] = daySessionsRes.data.map((item) => {
        let inTime = '09:00'
        let outTime = '18:00'
        if (item.in_time) {
          const d = new Date(item.in_time)
          if (!isNaN(d.getTime())) {
            inTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          }
        }
        if (item.out_time) {
          const d = new Date(item.out_time)
          if (!isNaN(d.getTime())) {
            outTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          }
        }
        const shiftId = item.shift_id || item.shift_snapshot?.shift_id || defaultShiftId || null
        const type: 'work' | 'break' = item.attendance_time_metrics === 'break' ? 'break' : 'work'

        return {
          id: item.attendance_id,
          type,
          in: inTime,
          out: outTime,
          shiftId,
        }
      })
      onChange(mappedSessions)
    }
  }, [daySessionsRes, defaultShiftId, onChange])

  const update = (i: number, patch: Partial<PunchSession>) =>
    onChange(sessions.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  const remove = (i: number) => onChange(sessions.filter((_, idx) => idx !== i))

  const add = (type: 'work' | 'break') => {
    sound.click()
    if (type === 'break') {
      onChange([...sessions, { type, in: '13:00', out: '14:00' }])
      return
    }
    const shiftId = defaultShiftId ?? shifts[0]?.id ?? null
    const sh = shiftId ? shifts.find((s) => s.id === shiftId) : null
    onChange([
      ...sessions,
      { type, in: sh?.startTime ?? '09:00', out: sh?.endTime ?? '18:00', shiftId },
    ])
  }

  const setType = (i: number, type: 'work' | 'break') =>
    update(i, type === 'work' ? { type, shiftId: defaultShiftId ?? shifts[0]?.id ?? null } : { type, shiftId: null })

  const timeCls =
    'h-8 rounded-md border border-border bg-card px-2 text-[13px] outline-none transition-colors focus:border-ring'

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-2.5 rounded-lg border border-border bg-muted/30 p-3"
    >
      {loadingSessions && sessions.length === 0 ? (
        <div className="flex items-center gap-2 py-2 text-[12px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin text-primary" />
          <span>Loading punch sessions...</span>
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">
          No punches yet — add a work session or a break.
        </p>
      ) : (
        <div className="space-y-1.5">
          {sessions.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-md border border-border bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => setType(i, 'work')}
                  className={cn(
                    'flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors',
                    s.type === 'work'
                      ? 'bg-emerald-500 text-white'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Briefcase className="size-3" />
                  Work
                </button>
                <button
                  type="button"
                  onClick={() => setType(i, 'break')}
                  className={cn(
                    'flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors',
                    s.type === 'break'
                      ? 'bg-amber-500 text-white'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Coffee className="size-3" />
                  Break
                </button>
              </div>

              <input
                type="time"
                value={s.in}
                onChange={(e) => update(i, { in: e.target.value })}
                className={timeCls}
              />
              <span className="text-muted-foreground">→</span>
              <input
                type="time"
                value={s.out}
                onChange={(e) => update(i, { out: e.target.value })}
                className={timeCls}
              />
              <span className="w-16 text-right text-[12px] tabular-nums text-muted-foreground">
                {fmtDur(span(s.in, s.out))}
              </span>

              {/* per-session shift (work only) — shadcn Select dropdown */}

              <div className="ml-auto flex items-center gap-2">
                <Select
                  value={s.shiftId || 'none'}
                  onValueChange={(val) => update(i, { shiftId: val === 'none' ? null : val })}
                >
                  <SelectTrigger className="h-8 w-44 text-[12px] bg-card border-border" size="sm">
                    <SelectValue placeholder="No shift" />
                  </SelectTrigger>
                  <SelectContent onClick={(e) => e.stopPropagation()}>
                    <SelectItem value="none">No shift</SelectItem>
                    {shifts.map((sh) => (
                      <SelectItem key={sh.id || sh.name} value={sh.id || sh.name}>
                        {sh.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label="Remove"
                  className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-rose-600"
                >
                  <X className="size-3.5" />
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => add('work')}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-medium transition-colors hover:bg-muted"
          >
            <Plus className="size-3" />
            Work session
          </button>
          <button
            type="button"
            onClick={() => add('break')}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-medium transition-colors hover:bg-muted"
          >
            <Plus className="size-3" />
            Break
          </button>
        </div>
        <div className="flex gap-3 text-[12px]">
          <span className="text-muted-foreground">
            Worked <span className="font-semibold tabular-nums text-foreground">{fmtDur(worked)}</span>
          </span>
          <span className="text-muted-foreground">
            Break <span className="font-semibold tabular-nums text-amber-600">{fmtDur(brk)}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function FlagToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors',
        active
          ? 'border-amber-400 bg-amber-50 text-amber-700'
          : 'border-border bg-card text-muted-foreground hover:bg-muted',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function ReadOnlyStatus({
  status,
  late,
  earlyOut,
  sessions = [],
  workedMin,
  breakMin,
}: {
  status: Marked
  late?: boolean
  earlyOut?: boolean
  sessions?: PunchSession[]
  workedMin?: number | null
  breakMin?: number | null
}) {
  const { worked: sessionWorked, brk: sessionBrk } = sessionTotals(sessions)
  const hasDetailedSessions = sessions.length > 1 || sessions.some((s) => s.type === 'break')
  const worked = hasDetailedSessions ? sessionWorked : (workedMin ?? sessionWorked)
  const brk = hasDetailedSessions ? sessionBrk : (breakMin ?? sessionBrk)

  const tone =
    status === 'present'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'halfday'
        ? 'bg-amber-50 text-amber-700'
        : status === 'leave'
          ? 'bg-blue-50 text-blue-700'
          : status === 'absent'
            ? 'bg-rose-50 text-rose-700'
            : status === 'weekoff' || status === 'holiday'
              ? 'bg-slate-100 text-slate-600'
              : 'bg-muted text-muted-foreground'
  return (
    <span className="flex items-center gap-1.5">
      {(sessions.length > 0 || worked > 0 || brk > 0) && (
        <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:inline">
          {fmtDur(worked)}
          {brk > 0 && <span className="text-amber-600"> · {fmtDur(brk)} brk</span>}
        </span>
      )}
      <span className={cn('inline-flex h-7 items-center rounded-lg px-3 text-[12px] font-medium', tone)}>
        {status ? statusLabel(status) : 'Unmarked'}
      </span>
      {late && <span className="text-[11px] text-amber-600">Late</span>}
      {earlyOut && <span className="text-[11px] text-amber-600">Early</span>}
    </span>
  )
}

function Chip({
  tone,
  label,
  n,
}: {
  tone: 'emerald' | 'amber' | 'blue' | 'rose' | 'gray'
  label: string
  n: number
}) {
  const dot =
    tone === 'emerald'
      ? 'bg-emerald-500'
      : tone === 'amber'
        ? 'bg-amber-500'
        : tone === 'blue'
          ? 'bg-blue-500'
          : tone === 'rose'
            ? 'bg-rose-500'
            : 'bg-slate-400'
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[12px] text-muted-foreground">
      <span className={cn('size-1.5 rounded-full', dot)} />
      {label} <span className="font-semibold tabular-nums text-foreground">{n}</span>
    </span>
  )
}
