import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Pencil,
  Clock,
  Trash2,
  ArrowLeft,
  Check,
  Loader2,
  Briefcase,
  Coffee,
  MapPin,
  ScanFace,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  useEmployeeDaySessionsQuery,
  useRegisterBulkAttendanceMutation,
  useUpdateBulkAttendanceMutation,
  useDeleteAttendanceSessionMutation,
} from '../hooks/useAttendance'
import { useShiftsQuery } from '@/features/shifts/hooks/useShifts'
import { useAuth } from '@/context/auth/AuthContext'
import type { BulkAttendanceItem } from '../types/attendanceApi.types'
import type { DayAttendance } from '../types/attendanceCalendar.types'
import { cn } from '@/lib/utils'
import { buildIsoDateTime } from '@/pages/admin/Attendance'

interface AttendanceDayModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeId: string
  employeeName: string
  date: Date
  dayData?: DayAttendance
}

interface AttendanceSessionRow {
  id: string
  type: 'working' | 'break'
  shiftId?: string
  inTimeStr: string
  outTimeStr: string
  rawInTime?: string | null
  rawOutTime?: string | null
  durationText: string
  durationMinutes: number
  location: string
  isFaceVerified: boolean
  shiftName: string
  photo: string | null
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

function extractTimeOnly(isoStr: string | null | undefined): string {
  if (!isoStr) return '09:00'
  const d = new Date(isoStr)
  if (!isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  if (isoStr.includes(':')) {
    return isoStr.slice(0, 5)
  }
  return '09:00'
}

function calculateDuration(inIso: string | null | undefined, outIso: string | null | undefined): { text: string; minutes: number } {
  if (!inIso || !outIso) return { text: '—', minutes: 0 }
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
  if (lat != null && lng != null) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
  return 'Registered Workplace'
}

export default function AttendanceDayModal({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  date,
  dayData: _dayData,
}: AttendanceDayModalProps) {
  const { activeWorkspace } = useAuth()
  const { data: shifts = [] } = useShiftsQuery()

  const registerMutation = useRegisterBulkAttendanceMutation()
  const updateMutation = useUpdateBulkAttendanceMutation()
  const deleteMutation = useDeleteAttendanceSessionMutation()

  // Mode: 'list' (View 1) | 'edit' (View 2) | 'create' (View 2)
  const [mode, setMode] = useState<'list' | 'edit' | 'create'>('list')
  const [activeTab, setActiveTab] = useState<'sessions' | 'punches'>('sessions')

  // Selected session/punch for editing
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  // Local overrides for UI simulation
  const [localSessions, setLocalSessions] = useState<AttendanceSessionRow[] | null>(null)

  // Form State
  const [formType, setFormType] = useState<'working' | 'break'>('working')
  const [formShiftId, setFormShiftId] = useState<string>('')
  const [formInTime, setFormInTime] = useState('09:00')
  const [formOutTime, setFormOutTime] = useState('18:00')
  const [formLocation, setFormLocation] = useState('Registered Workplace')
  const [formRemarks, setFormRemarks] = useState('')

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`

  // Fetch real punch sessions for this employee on this date from API
  const { data: sessionsRes, isLoading: loadingSessions } = useEmployeeDaySessionsQuery(
    employeeId,
    dateStr,
    open && Boolean(employeeId) && Boolean(dateStr)
  )

  // Reset modal state on open or date change
  useEffect(() => {
    if (open) {
      setMode('list')
      setSelectedSessionId(null)
      setLocalSessions(null)
    }
  }, [open, dateStr, employeeId])

  const formattedDate = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  // Parse shift name from first session if available
  const detectedShiftName = useMemo(() => {
    const raw = sessionsRes?.data?.[0]?.shift_snapshot
    if (raw?.shift_name) {
      return `${raw.shift_name} (${raw.shift_from ? raw.shift_from.slice(0, 5) : '09:00'} - ${raw.shift_to ? raw.shift_to.slice(0, 5) : '18:00'})`
    }
    return shifts[0]?.shift_name || 'General Shift (09:00 - 18:00)'
  }, [sessionsRes, shifts])

  // Parse API session response to structured session items
  const apiSessions: AttendanceSessionRow[] = useMemo(() => {
    if (!sessionsRes?.data || !Array.isArray(sessionsRes.data)) {
      return []
    }

    return sessionsRes.data.map((session, index) => {
      const shiftName = session.shift_snapshot?.shift_name || shifts.find((s) => s.shift_id === session.shift_id)?.shift_name || 'General Shift'
      const type: 'working' | 'break' = session.attendance_time_metrics === 'break' ? 'break' : 'working'
      const dur = calculateDuration(session.in_time, session.out_time)
      const loc = formatGeoLocation(session.geo_in_lat ?? session.geo_out_lat, session.geo_in_long ?? session.geo_out_long)
      const isFace = session.face_in === 'face' || session.face_out === 'face'

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
        photo: (session.face_in && session.face_in !== 'face') ? session.face_in : null,
      }
    })
  }, [sessionsRes, shifts])

  const sessions = localSessions ?? apiSessions

  // Compute total working vs break minutes
  const totals = useMemo(() => {
    let workSec = 0
    let breakSec = 0

    if (sessionsRes?.data && Array.isArray(sessionsRes.data)) {
      sessionsRes.data.forEach((s) => {
        if (s.in_time && s.out_time) {
          const diff = Math.max(0, Math.floor((new Date(s.out_time).getTime() - new Date(s.in_time).getTime()) / 1000))
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
      sessionCount: sessions.length,
    }
  }, [sessionsRes, sessions])

  // Flat punch-by-punch rows (for the Punches view)
  const flatPunches = useMemo(() => {
    const list: Array<{
      id: string
      status: 'IN' | 'OUT'
      type: 'working' | 'break'
      time: string
      location: string
      isFaceVerified: boolean
    }> = []

    sessions.forEach((s) => {
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
  }, [sessions])

  const handleStartEdit = (session: AttendanceSessionRow) => {
    setSelectedSessionId(session.id)
    setFormType(session.type)
    setFormShiftId(session.shiftId || shifts[0]?.shift_id || '')
    setFormInTime(extractTimeOnly(session.rawInTime))
    setFormOutTime(extractTimeOnly(session.rawOutTime))
    setFormLocation(session.location || 'Registered Workplace')
    setFormRemarks('')
    setMode('edit')
  }

  const handleStartAdd = () => {
    setSelectedSessionId(null)
    setFormType('working')
    setFormShiftId(shifts[0]?.shift_id || '')
    setFormInTime('09:00')
    setFormOutTime('18:00')
    setFormLocation('Registered Workplace')
    setFormRemarks('')
    setMode('create')
  }

  const isSubmitting = registerMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  const handleSave = async () => {
    if (!formInTime) {
      toast.error('Please specify in-time')
      return
    }

    const inIso = buildIsoDateTime(dateStr, formInTime)
    const outIso = buildIsoDateTime(dateStr, formOutTime || formInTime)
    const shiftId = formShiftId || shifts[0]?.shift_id || ''
    const firmId = activeWorkspace?.id || ''

    const item: BulkAttendanceItem = {
      user_id: employeeId,
      firm_id: firmId,
      shift_id: shiftId,
      attendance_date: buildIsoDateTime(dateStr),
      in_time: inIso,
      out_time: outIso,
      attendance_time_metrics: formType,
    }

    try {
      if (mode === 'edit' && selectedSessionId) {
        const updatePayload = [{ ...item, attendance_id: selectedSessionId }]
        console.log('📝 [Edit Session] Bulk Update Payload:', updatePayload)
        await updateMutation.mutateAsync(updatePayload)
        toast.success('Attendance session updated successfully')
      } else {
        const registerPayload = [item]
        console.log('✨ [Create Session] Bulk Register Payload:', registerPayload)
        await registerMutation.mutateAsync(registerPayload)
        toast.success('Attendance session created successfully')
      }
      setMode('list')
      setSelectedSessionId(null)
    } catch {
      // Error handled in mutation
    }
  }

  const handleDelete = async () => {
    if (!selectedSessionId) return
    try {
      if (!selectedSessionId.startsWith('local-') && !selectedSessionId.startsWith('session-')) {
        await deleteMutation.mutateAsync({
          employee_id: employeeId,
          attendance_id: selectedSessionId,
        })
      }
      const updated = sessions.filter((s) => s.id !== selectedSessionId)
      setLocalSessions(updated)
      toast.success('Attendance session deleted')
      setMode('list')
      setSelectedSessionId(null)
    } catch {
      // Error handled in mutation
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] md:max-w-[820px] w-full max-w-[95vw] p-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl">
        {/* Header with Title & Date */}
        <div className="border-b border-border/80 px-6 pt-5 pb-4 bg-muted/20">
          <div className="flex items-start justify-between pr-8">
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                {employeeName}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-semibold text-muted-foreground">{formattedDate}</span>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-xs text-muted-foreground truncate max-w-[320px]">
                  {detectedShiftName}
                </span>
              </div>
            </div>
            <span className="sr-only">Attendance for {employeeName} on {formattedDate}</span>
          </div>

          {/* Quick Session Stats Bar */}
          <div className="grid grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-border/60">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-2.5">
              <Briefcase className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                  Work Time
                </div>
                <div className="text-xs font-bold text-emerald-900 dark:text-emerald-100">
                  {totals.workText}
                </div>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center gap-2.5">
              <Coffee className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">
                  Break Time
                </div>
                <div className="text-xs font-bold text-amber-900 dark:text-amber-100">
                  {totals.breakText}
                </div>
              </div>
            </div>

            <div className="bg-muted border border-border/80 rounded-lg px-3 py-2 flex items-center gap-2.5">
              <Layers className="size-4 text-muted-foreground shrink-0" />
              <div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase">
                  Sessions
                </div>
                <div className="text-xs font-bold text-foreground">
                  {totals.sessionCount} session{totals.sessionCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-4 min-w-0 max-w-full flex-1 overflow-y-auto">
          {mode === 'list' ? (
            <div className="space-y-4">
              {/* View Selector Tabs (Sessions vs Punches) */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/60 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('sessions')}
                    className={cn(
                      'px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer',
                      activeTab === 'sessions'
                        ? 'bg-card text-foreground shadow-xs border border-border/40'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Sessions ({sessions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('punches')}
                    className={cn(
                      'px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer',
                      activeTab === 'punches'
                        ? 'bg-card text-foreground shadow-xs border border-border/40'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Raw Punches ({flatPunches.length})
                  </button>
                </div>

                <Button
                  type="button"
                  onClick={handleStartAdd}
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-semibold gap-1.5 cursor-pointer shadow-xs h-8 shrink-0 px-3.5"
                >
                  <Clock className="size-3.5" />
                  <span>Mark Attendance</span>
                </Button>
              </div>

              {/* Tab 1: Structured Sessions View (RECOMMENDED) */}
              {activeTab === 'sessions' && (
                <div className="rounded-xl border border-border/80 overflow-x-auto shadow-2xs w-full">
                  <table className="w-full text-left border-collapse text-xs min-w-[560px]">
                    <thead>
                      <tr className="bg-muted/60 text-muted-foreground font-semibold border-b border-border/80">
                        <th className="py-2.5 px-3 w-12 text-center">Action</th>
                        <th className="py-2.5 px-3 w-24">Type</th>
                        <th className="py-2.5 px-3">Punch In / Out</th>
                        <th className="py-2.5 px-3 w-20 text-center">Duration</th>
                        <th className="py-2.5 px-3">Location</th>
                        <th className="py-2.5 px-3 w-28 text-center">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-foreground bg-card">
                      {loadingSessions ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-muted-foreground">
                            <Loader2 className="size-5 animate-spin mx-auto text-primary mb-2" />
                            <p className="text-xs font-medium">Fetching attendance sessions...</p>
                          </td>
                        </tr>
                      ) : sessions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-muted-foreground">
                            <Clock className="size-6 text-muted-foreground/40 mx-auto mb-2" />
                            <p className="text-sm font-medium">No sessions recorded on this date</p>
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              Click "Mark Attendance" above to record a new session.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        sessions.map((session) => (
                          <tr key={session.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(session)}
                                title="Edit session"
                                className="size-7 inline-flex items-center justify-center rounded-md border border-border/80 text-foreground hover:bg-muted transition-colors cursor-pointer"
                              >
                                <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
                              </button>
                            </td>

                            {/* Session Type Badge */}
                            <td className="py-3 px-3">
                              {session.type === 'working' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                  <Briefcase className="size-3" />
                                  <span>Work</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                  <Coffee className="size-3" />
                                  <span>Break</span>
                                </span>
                              )}
                            </td>

                            {/* In / Out Timings */}
                            <td className="py-3 px-3 font-medium whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-foreground">{session.inTimeStr}</span>
                                <span className="text-muted-foreground text-[10px]">➔</span>
                                <span className="font-bold text-foreground">{session.outTimeStr}</span>
                              </div>
                            </td>

                            {/* Duration */}
                            <td className="py-3 px-3 text-center font-bold text-foreground whitespace-nowrap">
                              <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground border border-border/60">
                                {session.durationText}
                              </span>
                            </td>

                            {/* Location */}
                            <td className="py-3 px-3 text-muted-foreground truncate max-w-[150px]" title={session.location}>
                              <div className="flex items-center gap-1">
                                <MapPin className="size-3 text-muted-foreground/70 shrink-0" />
                                <span className="truncate">{session.location}</span>
                              </div>
                            </td>

                            {/* Verification */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {session.isFaceVerified ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10.5px] font-bold border border-emerald-500/20">
                                  <ScanFace className="size-3" />
                                  <span>Face Verified</span>
                                </span>
                              ) : session.photo ? (
                                <img
                                  src={session.photo}
                                  alt="Verified"
                                  className="size-7 rounded object-cover mx-auto border border-border"
                                />
                              ) : (
                                <span className="text-[11px] text-muted-foreground/60 font-medium">Standard</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2: Flat Punches View (Matching traditional Table layout) */}
              {activeTab === 'punches' && (
                <div className="rounded-xl border border-border/80 overflow-x-auto shadow-2xs w-full">
                  <table className="w-full text-left border-collapse text-xs min-w-[520px]">
                    <thead>
                      <tr className="bg-muted/60 text-muted-foreground font-semibold border-b border-border/80">
                        <th className="py-2.5 px-3 w-16 text-center">Status</th>
                        <th className="py-2.5 px-3 w-20">Type</th>
                        <th className="py-2.5 px-3 w-24">Time</th>
                        <th className="py-2.5 px-3">Location</th>
                        <th className="py-2.5 px-3 w-24 text-center">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-foreground bg-card">
                      {flatPunches.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                            No individual punch entries found.
                          </td>
                        </tr>
                      ) : (
                        flatPunches.map((punch) => (
                          <tr key={punch.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={cn(
                                  'inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase',
                                  punch.status === 'IN'
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-rose-500 text-white'
                                )}
                              >
                                {punch.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-muted-foreground capitalize">
                              {punch.type}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-foreground whitespace-nowrap">
                              {punch.time}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[200px]">
                              {punch.location}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {punch.isFaceVerified ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[10px] font-bold">
                                  <ScanFace className="size-2.5" />
                                  <span>Face</span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-muted-foreground/60 font-medium">Standard</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* VIEW 2: Edit / Create Attendance Form */
            <div className="flex flex-col h-full max-h-[calc(88vh-220px)]">
              <div className="flex items-center justify-between pb-2 border-b border-border/60 shrink-0">
                <h3 className="text-base font-bold text-foreground">
                  {mode === 'edit' ? 'Edit Attendance Session' : 'Mark Attendance'}
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  {formattedDate}
                </span>
              </div>

              {/* Scrollable Form Fields */}
              <div className="flex-1 overflow-y-auto py-3 pr-1 space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Session Type (Work vs Break) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">Session Type</Label>
                    <Select value={formType} onValueChange={(val: any) => setFormType(val)}>
                      <SelectTrigger className="w-full text-xs h-9 bg-background border-border">
                        <SelectValue placeholder="Select Session Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="working" className="text-xs font-medium">
                          💼 Work Session
                        </SelectItem>
                        <SelectItem value="break" className="text-xs font-medium">
                          ☕ Break Session
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Shift Dropdown */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">Shift</Label>
                    <Select value={formShiftId || shifts[0]?.shift_id || 'default'} onValueChange={(val) => setFormShiftId(val === 'default' ? '' : val)}>
                      <SelectTrigger className="w-full text-xs h-9 bg-background border-border">
                        <SelectValue placeholder="Select Shift" />
                      </SelectTrigger>
                      <SelectContent>
                        {shifts.map((sh) => (
                          <SelectItem key={sh.shift_id} value={sh.shift_id} className="text-xs font-medium">
                            {sh.shift_name} ({sh.shift_from ? sh.shift_from.slice(0, 5) : '09:00'} - {sh.shift_to ? sh.shift_to.slice(0, 5) : '18:00'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Punch In Time */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">Punch In Time</Label>
                    <div className="relative">
                      <Input
                        type="time"
                        value={formInTime}
                        onChange={(e) => setFormInTime(e.target.value)}
                        className="h-9 pr-9 text-xs bg-background border-border font-medium"
                      />
                      <Clock className="size-4 text-muted-foreground absolute right-2.5 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Punch Out Time */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">Punch Out Time</Label>
                    <div className="relative">
                      <Input
                        type="time"
                        value={formOutTime}
                        onChange={(e) => setFormOutTime(e.target.value)}
                        className="h-9 pr-9 text-xs bg-background border-border font-medium"
                      />
                      <Clock className="size-4 text-muted-foreground absolute right-2.5 top-2.5 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Geo Address */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Geo Coordinates / Address</Label>
                  <Input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Enter location or coordinates"
                    className="h-9 text-xs bg-background border-border"
                  />
                </div>

                {/* Remarks */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Remarks</Label>
                  <Textarea
                    value={formRemarks}
                    onChange={(e) => setFormRemarks(e.target.value)}
                    placeholder="Enter remarks (optional)"
                    rows={2}
                    className="text-xs bg-background border-border resize-none"
                  />
                </div>
              </div>

              {/* Action Buttons Row (Always visible at the bottom) */}
              <div className="flex items-center justify-between pt-3 border-t border-border/60 shrink-0 bg-card">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={isSubmitting}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3.5 text-xs font-semibold gap-1.5 rounded-lg cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                    <span>{isSubmitting ? 'Saving...' : mode === 'edit' ? 'Update' : 'Save'}</span>
                  </Button>

                  {mode === 'edit' && (
                    <Button
                      type="button"
                      onClick={handleDelete}
                      disabled={isSubmitting}
                      className="bg-rose-600 hover:bg-rose-700 text-white h-8 px-3.5 text-xs font-semibold gap-1.5 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Delete</span>
                    </Button>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode('list')}
                  className="h-8 px-3 text-xs font-medium gap-1.5 border-border hover:bg-muted text-foreground rounded-lg cursor-pointer"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Go Back</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
