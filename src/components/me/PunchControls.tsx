import { useState, useMemo } from 'react'
import {
  Fingerprint,
  Coffee,
  LogOut,
  Play,
  Loader2,
  Clock,
  MapPin,
} from 'lucide-react'
import { useUserProfileQuery } from '@/features/auth/hooks/useUserProfile'
import {
  useMyAttendanceSessionsQuery,
  useCheckInMutation,
  useBreakInMutation,
  useBreakOutMutation,
  useCheckOutMutation,
  getCurrentBrowserCoordinates,
} from '@/features/attendance/hooks/useAttendance'
import LocationPermissionModal from '@/components/common/LocationPermissionModal'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { sound } from '@/lib/sound'

interface PunchControlsProps {
  compact?: boolean
  className?: string
  onActionComplete?: () => void
}

function formatSessionTime(isoStr?: string | null): string {
  if (!isoStr) return '—'
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch {
    return '—'
  }
}

export default function PunchControls({
  compact = false,
  className,
  onActionComplete,
}: PunchControlsProps) {
  const { data: profile } = useUserProfileQuery()
  const [selectedShiftId, setSelectedShiftId] = useState<string>('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [locationModalOpen, setLocationModalOpen] = useState<boolean>(false)
  const [pendingAction, setPendingAction] = useState<
    'checkin' | 'breakin' | 'breakout' | 'checkout' | null
  >(null)

  // Current date formatted as YYYY-MM-DD
  const todayDateStr = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  // 1. Fetch live attendance sessions for logged-in user from POST /api/v2/attendance/all
  const { data: sessions = [], refetch: refetchSessions } =
    useMyAttendanceSessionsQuery(todayDateStr)

  const checkInMutation = useCheckInMutation()
  const breakInMutation = useBreakInMutation()
  const breakOutMutation = useBreakOutMutation()
  const checkOutMutation = useCheckOutMutation()

  const user = profile?.user
  const shifts = profile?.shifts || []

  // Sort sessions chronologically
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const timeA = new Date(a.in_time || a.created_at || '').getTime()
      const timeB = new Date(b.in_time || b.created_at || '').getTime()
      return timeA - timeB
    })
  }, [sessions])

  // Open / active session is the session that has no out_time (out_time is null/empty)
  const openSession = useMemo(() => {
    return sortedSessions.slice().reverse().find((s) => !s.out_time) || null
  }, [sortedSessions])

  // Active shift: prefer open session's shift, then user selected, then first assigned shift
  const activeShift = useMemo(() => {
    if (openSession?.shift_id) {
      const found = shifts.find((s) => s.shift_id === openSession.shift_id)
      if (found) return found
    }
    if (selectedShiftId) {
      const found = shifts.find((s) => s.shift_id === selectedShiftId)
      if (found) return found
    }
    return shifts[0] || null
  }, [openSession, selectedShiftId, shifts])

  // Status computation based on POST /api/v2/attendance/all sessions
  const rawProfileStatus = (user?.punch_status || 'offline').toLowerCase()
  
  // If there's an open session, status comes directly from attendance_time_metrics
  const isOnBreak = openSession
    ? openSession.attendance_time_metrics === 'break'
    : (rawProfileStatus === 'break' || rawProfileStatus === 'break_in')

  const isPunchedIn = openSession
    ? openSession.attendance_time_metrics === 'working'
    : (!isOnBreak && (rawProfileStatus === 'in' || rawProfileStatus === 'online' || rawProfileStatus === 'working'))

  const getPayloadBase = async (
    actionType: 'checkin' | 'breakin' | 'breakout' | 'checkout',
    forcedCoords?: { lat: number; lng: number }
  ) => {
    const isGeofenceMandatory = (user?.punch_from || '').toLowerCase() === 'geofence'
    
    let lat: number | null = forcedCoords ? forcedCoords.lat : null
    let lng: number | null = forcedCoords ? forcedCoords.lng : null

    if (!forcedCoords) {
      const coords = await getCurrentBrowserCoordinates()
      lat = coords.latitude
      lng = coords.longitude

      if (isGeofenceMandatory && (lat === null || lng === null)) {
        setPendingAction(actionType)
        setLocationModalOpen(true)
        const msg =
          coords.errorCode === 1
            ? 'Browser location access is Blocked. Please allow Location in address bar.'
            : 'Location could not be determined. Please enable location permissions.'
        toast.error(msg, { duration: 5000 })
        sound.error()
        throw new Error('Location is required for Geofence punch.')
      }
    }

    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const attendance_date = `${year}-${month}-${day}`
    const isoTime = now.toISOString()
    const shift_id = activeShift?.shift_id || openSession?.shift_id || user?.shift_id || ''

    return {
      shift_id,
      attendance_date,
      isoTime,
      lat,
      lng,
    }
  }

  // 1. Handle Punch In (POST /api/v2/attendance/check-in)
  const handleCheckIn = async (forcedCoords?: { lat: number; lng: number }) => {
    try {
      setActionLoading('checkin')
      const { shift_id, attendance_date, isoTime, lat, lng } = await getPayloadBase('checkin', forcedCoords)
      await checkInMutation.mutateAsync({
        shift_id,
        attendance_date,
        in_time: isoTime,
        geo_in_lat: lat,
        geo_in_long: lng,
      })
      await refetchSessions()
      onActionComplete?.()
    } catch (err: any) {
      console.warn('Punch in aborted or failed:', err?.message || err)
    } finally {
      setActionLoading(null)
    }
  }

  // 2. Handle Break In (POST /api/v2/attendance/break-in)
  const handleBreakIn = async (forcedCoords?: { lat: number; lng: number }) => {
    try {
      setActionLoading('breakin')
      const { shift_id, attendance_date, isoTime, lat, lng } = await getPayloadBase('breakin', forcedCoords)
      await breakInMutation.mutateAsync({
        shift_id,
        attendance_date,
        in_time: isoTime,
        geo_in_lat: lat,
        geo_in_long: lng,
      })
      await refetchSessions()
      onActionComplete?.()
    } catch (err: any) {
      console.warn('Break in aborted or failed:', err?.message || err)
    } finally {
      setActionLoading(null)
    }
  }

  // 3. Handle Break Out (PATCH /api/v2/attendance/break-out)
  const handleBreakOut = async (forcedCoords?: { lat: number; lng: number }) => {
    try {
      setActionLoading('breakout')
      const { shift_id, attendance_date, isoTime, lat, lng } = await getPayloadBase('breakout', forcedCoords)
      await breakOutMutation.mutateAsync({
        shift_id,
        attendance_date,
        out_time: isoTime,
        geo_out_lat: lat,
        geo_out_long: lng,
      })
      await refetchSessions()
      onActionComplete?.()
    } catch (err: any) {
      console.warn('Break out aborted or failed:', err?.message || err)
    } finally {
      setActionLoading(null)
    }
  }

  // 4. Handle Check Out (PATCH /api/v2/attendance/check-out)
  const handleCheckOut = async (forcedCoords?: { lat: number; lng: number }) => {
    try {
      setActionLoading('checkout')
      const { shift_id, attendance_date, isoTime, lat, lng } = await getPayloadBase('checkout', forcedCoords)
      await checkOutMutation.mutateAsync({
        shift_id,
        attendance_date,
        out_time: isoTime,
        geo_out_lat: lat,
        geo_out_long: lng,
      })
      await refetchSessions()
      onActionComplete?.()
    } catch (err: any) {
      console.warn('Punch out aborted or failed:', err?.message || err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleLocationObtained = (coords: { latitude: number; longitude: number }) => {
    const forced = { lat: coords.latitude, lng: coords.longitude }
    const action = pendingAction
    setPendingAction(null)
    if (action === 'checkin') {
      handleCheckIn(forced)
    } else if (action === 'breakin') {
      handleBreakIn(forced)
    } else if (action === 'breakout') {
      handleBreakOut(forced)
    } else if (action === 'checkout') {
      handleCheckOut(forced)
    }
  }

  const isAnyLoading =
    Boolean(actionLoading) ||
    checkInMutation.isPending ||
    breakInMutation.isPending ||
    breakOutMutation.isPending ||
    checkOutMutation.isPending

  // ─── Compact Mode (Used in Headers & Quick toolbars) ──────────────────────
  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {/* If user is Offline / Not Punched In */}
        {!isPunchedIn && !isOnBreak && (
          <Button
            type="button"
            onClick={() => handleCheckIn()}
            disabled={isAnyLoading}
            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-xs gap-1.5 shadow-sm transition-all"
          >
            {actionLoading === 'checkin' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Fingerprint className="size-4" />
            )}
            <span>Punch in</span>
          </Button>
        )}

        {/* If user is Working / Punched In */}
        {isPunchedIn && !isOnBreak && (
          <>
            <Button
              type="button"
              onClick={() => handleBreakIn()}
              disabled={isAnyLoading}
              variant="outline"
              className="h-9 px-3.5 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium rounded-lg text-xs gap-1.5 transition-all"
            >
              {actionLoading === 'breakin' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Coffee className="size-4" />
              )}
              <span>Break in</span>
            </Button>
            <Button
              type="button"
              onClick={() => handleCheckOut()}
              disabled={isAnyLoading}
              className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg text-xs gap-1.5 shadow-sm transition-all"
            >
              {actionLoading === 'checkout' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <LogOut className="size-4" />
              )}
              <span>Punch out</span>
            </Button>
          </>
        )}

        {/* If user is On Break */}
        {isOnBreak && (
          <>
            <Button
              type="button"
              onClick={() => handleBreakOut()}
              disabled={isAnyLoading}
              className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-xs gap-1.5 shadow-sm transition-all"
            >
              {actionLoading === 'breakout' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              <span>Break out</span>
            </Button>
            <Button
              type="button"
              onClick={() => handleCheckOut()}
              disabled={isAnyLoading}
              className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg text-xs gap-1.5 shadow-sm transition-all"
            >
              {actionLoading === 'checkout' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <LogOut className="size-4" />
              )}
              <span>Punch out</span>
            </Button>
          </>
        )}

        <LocationPermissionModal
          open={locationModalOpen}
          onOpenChange={setLocationModalOpen}
          actionLabel="Verify & Punch Attendance"
          onLocationObtained={handleLocationObtained}
        />
      </div>
    )
  }

  // ─── Extended Banner View (Used in Home.tsx & Attendance Main) ───────────
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card p-5 shadow-sm backdrop-blur-md space-y-4',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'size-10 rounded-xl grid place-items-center transition-colors',
              isOnBreak
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : isPunchedIn
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {isOnBreak ? (
              <Coffee className="size-5" />
            ) : isPunchedIn ? (
              <Fingerprint className="size-5" />
            ) : (
              <Clock className="size-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                Attendance Tracking
              </h2>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1',
                  isOnBreak
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : isPunchedIn
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-muted text-muted-foreground border-border'
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    isOnBreak
                      ? 'bg-amber-500 animate-pulse'
                      : isPunchedIn
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-muted-foreground'
                  )}
                />
                {isOnBreak
                  ? 'On Break'
                  : isPunchedIn
                  ? 'Working (Punched In)'
                  : 'Not Punched In'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
              {activeShift ? (
                <span>
                  Shift: <strong className="text-foreground">{activeShift.shift_name}</strong>{' '}
                  ({activeShift.shift_from?.substring(0, 5)} –{' '}
                  {activeShift.shift_to?.substring(0, 5)})
                </span>
              ) : (
                'No active shift assigned'
              )}
              {openSession?.in_time && (
                <span className="text-muted-foreground">
                  • Started at: <strong className="text-foreground">{formatSessionTime(openSession.in_time)}</strong>
                </span>
              )}
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border',
                  (user?.punch_from || '').toLowerCase() === 'geofence'
                    ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                    : 'bg-muted text-muted-foreground border-border'
                )}
              >
                <MapPin className="size-3" />
                <span>Punch: <strong className="capitalize">{user?.punch_from || 'Anywhere'}</strong></span>
              </span>
            </p>
          </div>
        </div>

        {/* Shift selector if user has multiple shifts */}
        {shifts.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Select Shift:</span>
            <Select
              value={activeShift?.shift_id || ''}
              onValueChange={(val) => setSelectedShiftId(val)}
            >
              <SelectTrigger className="h-8 text-xs w-48 rounded-lg bg-background/60">
                <SelectValue placeholder="Choose shift" />
              </SelectTrigger>
              <SelectContent>
                {shifts.map((s) => (
                  <SelectItem key={s.shift_id} value={s.shift_id} className="text-xs">
                    {s.shift_name} ({s.shift_from?.substring(0, 5)} - {s.shift_to?.substring(0, 5)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Action Buttons Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* If user is Offline / Not Punched In */}
        {!isPunchedIn && !isOnBreak && (
          <Button
            type="button"
            onClick={() => handleCheckIn()}
            disabled={isAnyLoading}
            size="sm"
            className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-xs gap-2 shadow-sm transition-all"
          >
            {actionLoading === 'checkin' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Fingerprint className="size-4" />
            )}
            <span>Punch in Now</span>
          </Button>
        )}

        {/* If user is Working / Punched In */}
        {isPunchedIn && !isOnBreak && (
          <>
            <Button
              type="button"
              onClick={() => handleBreakIn()}
              disabled={isAnyLoading}
              variant="outline"
              size="sm"
              className="h-9 px-4 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium rounded-xl text-xs gap-2 transition-all"
            >
              {actionLoading === 'breakin' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Coffee className="size-4" />
              )}
              <span>Take Break (Break in)</span>
            </Button>
            <Button
              type="button"
              onClick={() => handleCheckOut()}
              disabled={isAnyLoading}
              size="sm"
              className="h-9 px-5 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl text-xs gap-2 shadow-sm transition-all"
            >
              {actionLoading === 'checkout' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogOut className="size-4" />
              )}
              <span>Punch out</span>
            </Button>
          </>
        )}

        {/* If user is On Break */}
        {isOnBreak && (
          <>
            <Button
              type="button"
              onClick={() => handleBreakOut()}
              disabled={isAnyLoading}
              size="sm"
              className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-xs gap-2 shadow-sm transition-all"
            >
              {actionLoading === 'breakout' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              <span>Resume Work (Break out)</span>
            </Button>
            <Button
              type="button"
              onClick={() => handleCheckOut()}
              disabled={isAnyLoading}
              size="sm"
              className="h-9 px-5 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl text-xs gap-2 shadow-sm transition-all"
            >
              {actionLoading === 'checkout' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogOut className="size-4" />
              )}
              <span>Punch out</span>
            </Button>
          </>
        )}
      </div>

      {/* Today's Activity Sessions Summary */}
      {sortedSessions.length > 0 && (
        <div className="pt-2 border-t border-border/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Today's Sessions ({sortedSessions.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sortedSessions.map((session, idx) => {
              const isSessionOpen = !session.out_time
              const isBreak = session.attendance_time_metrics === 'break'
              return (
                <div
                  key={session.attendance_id || idx}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs',
                    isBreak
                      ? 'bg-amber-500/5 border-amber-500/20 text-amber-800 dark:text-amber-300'
                      : 'bg-muted/40 border-border text-foreground'
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current opacity-70" />
                  <span className="font-semibold capitalize">
                    {session.attendance_time_metrics || 'Work'}
                  </span>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {formatSessionTime(session.in_time)} –{' '}
                    {isSessionOpen ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold animate-pulse">
                        Active
                      </span>
                    ) : (
                      formatSessionTime(session.out_time)
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <LocationPermissionModal
        open={locationModalOpen}
        onOpenChange={setLocationModalOpen}
        actionLabel="Verify & Punch Attendance"
        onLocationObtained={handleLocationObtained}
      />
    </div>
  )
}
