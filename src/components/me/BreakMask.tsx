import { useState, useEffect, useMemo } from 'react'
import {
  Coffee,
  Play,
  LogOut,
  Loader2,
} from 'lucide-react'
import { useUserProfileQuery } from '@/features/auth/hooks/useUserProfile'
import {
  useMyAttendanceSessionsQuery,
  useBreakOutMutation,
  useCheckOutMutation,
  getCurrentBrowserCoordinates,
} from '@/features/attendance/hooks/useAttendance'
import LocationPermissionModal from '@/components/common/LocationPermissionModal'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { sound } from '@/lib/sound'

export default function BreakMask() {
  const { data: profile } = useUserProfileQuery()
  const [actionLoading, setActionLoading] = useState<'breakout' | 'checkout' | null>(null)
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<'breakout' | 'checkout' | null>(null)
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0)

  // Current date formatted as YYYY-MM-DD
  const todayDateStr = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  // 1. Fetch live attendance sessions
  const { data: sessions = [], refetch: refetchSessions } =
    useMyAttendanceSessionsQuery(todayDateStr)

  const breakOutMutation = useBreakOutMutation()
  const checkOutMutation = useCheckOutMutation()

  const user = profile?.user
  const shifts = profile?.shifts || []

  // Chronologically sorted sessions
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const timeA = new Date(a.in_time || a.created_at || '').getTime()
      const timeB = new Date(b.in_time || b.created_at || '').getTime()
      return timeA - timeB
    })
  }, [sessions])

  // Open / active session without out_time
  const openSession = useMemo(() => {
    return sortedSessions.slice().reverse().find((s) => !s.out_time) || null
  }, [sortedSessions])

  const rawProfileStatus = (user?.punch_status || '').toLowerCase()
  const isOnBreak = openSession
    ? openSession.attendance_time_metrics === 'break'
    : (rawProfileStatus === 'break' || rawProfileStatus === 'break_in')

  const activeShift = useMemo(() => {
    if (openSession?.shift_id) {
      const found = shifts.find((s) => s.shift_id === openSession.shift_id)
      if (found) return found
    }
    return shifts[0] || null
  }, [openSession, shifts])

  // Live Timer updating every second
  useEffect(() => {
    if (!isOnBreak) {
      setSecondsElapsed(0)
      return
    }

    const startTime = openSession?.in_time
      ? new Date(openSession.in_time).getTime()
      : Date.now()

    const updateTimer = () => {
      const now = Date.now()
      const diff = Math.max(0, Math.floor((now - startTime) / 1000))
      setSecondsElapsed(diff)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [isOnBreak, openSession?.in_time])

  // Security & Anti-Inspect Protections while on Break
  useEffect(() => {
    if (!isOnBreak) return

    // 1. Disable Right Click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      return false
    }

    // 2. Disable DevTools and Source inspection keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's')) ||
        (e.metaKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's'))
      ) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    window.addEventListener('contextmenu', handleContextMenu, { capture: true })
    window.addEventListener('keydown', handleKeyDown, { capture: true })

    // Prevent body scrolling while mask is on
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true })
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      document.body.style.overflow = originalOverflow
    }
  }, [isOnBreak])

  const getPayloadBase = async (
    actionType: 'breakout' | 'checkout',
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

  // Handle Break Out
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
    } catch (err: any) {
      console.warn('Break out aborted or failed:', err?.message || err)
    } finally {
      setActionLoading(null)
    }
  }

  // Handle Punch Out
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
    if (action === 'breakout') {
      handleBreakOut(forced)
    } else if (action === 'checkout') {
      handleCheckOut(forced)
    }
  }

  if (!isOnBreak) {
    return null
  }

  const hours = Math.floor(secondsElapsed / 3600)
  const minutes = Math.floor((secondsElapsed % 3600) / 60)
  const seconds = secondsElapsed % 60

  const format2 = (num: number) => String(num).padStart(2, '0')
  const startTimeDisplay = openSession?.in_time
    ? new Date(openSession.in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    : 'Recently'

  return (
    <div
      id="mh-break-lock-mask"
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-4 select-none bg-background/90 backdrop-blur-2xl animate-in fade-in duration-300"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Ambient background pulsing orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glassmorphic Card */}
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-amber-500/30 bg-card/95 p-8 text-center shadow-2xl backdrop-blur-xl space-y-6">
        {/* Animated Coffee Icon with Steam Glow */}
        <div className="mx-auto relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-amber-500/20 animate-ping opacity-30" />
          <div className="relative size-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 grid place-items-center text-white shadow-lg shadow-amber-500/30">
            <Coffee className="size-8 animate-bounce" style={{ animationDuration: '2.5s' }} />
          </div>
        </div>

        {/* Title and Status Badge */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            <span>BREAK IN PROGRESS</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            You are Currently on Break
          </h1>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Workspace actions are temporarily paused. Enjoy your break and click{' '}
            <strong className="text-foreground">Resume Work</strong> when you are back.
          </p>
        </div>

        {/* Big Animated Digital Timer */}
        <div className="rounded-2xl border border-border/80 bg-muted/40 p-5 shadow-inner">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
            Break Duration
          </span>
          <div className="flex items-center justify-center gap-2 font-mono text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground tabular-nums">
            <div className="flex flex-col items-center">
              <span>{format2(hours)}</span>
              <span className="text-[9px] font-sans font-medium text-muted-foreground uppercase">Hrs</span>
            </div>
            <span className="text-amber-500 animate-pulse -mt-4">:</span>
            <div className="flex flex-col items-center">
              <span>{format2(minutes)}</span>
              <span className="text-[9px] font-sans font-medium text-muted-foreground uppercase">Min</span>
            </div>
            <span className="text-amber-500 animate-pulse -mt-4">:</span>
            <div className="flex flex-col items-center">
              <span className="text-amber-600 dark:text-amber-400">{format2(seconds)}</span>
              <span className="text-[9px] font-sans font-medium text-muted-foreground uppercase">Sec</span>
            </div>
          </div>
        </div>

        {/* Meta Info */}
        <div className="flex items-center justify-around border-t border-b border-border/60 py-3 text-xs text-muted-foreground">
          <div className="text-center">
            <span className="block text-[11px] text-muted-foreground">Started at</span>
            <strong className="text-foreground font-semibold">{startTimeDisplay}</strong>
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="text-center">
            <span className="block text-[11px] text-muted-foreground">Shift</span>
            <strong className="text-foreground font-semibold">
              {activeShift?.shift_name || 'General Shift'}
            </strong>
          </div>
        </div>

        {/* Break Out & Punch Out Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <Button
            type="button"
            onClick={() => handleBreakOut()}
            disabled={Boolean(actionLoading)}
            size="lg"
            className="btn-3d w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all"
          >
            {actionLoading === 'breakout' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4 fill-current" />
            )}
            <span>Break Out & Resume Work</span>
          </Button>

          <Button
            type="button"
            onClick={() => handleCheckOut()}
            disabled={Boolean(actionLoading)}
            variant="ghost"
            className="w-full h-9 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 rounded-xl gap-1.5 cursor-pointer transition-colors"
          >
            {actionLoading === 'checkout' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <LogOut className="size-3.5" />
            )}
            <span>End Day & Punch Out</span>
          </Button>
        </div>
      </div>

      <LocationPermissionModal
        open={locationModalOpen}
        onOpenChange={setLocationModalOpen}
        title="Location Access Required"
        description="Location coordinates are mandatory to resume work or punch out under geofence."
        actionLabel="Verify Location & Proceed"
        onLocationObtained={handleLocationObtained}
      />
    </div>
  )
}
