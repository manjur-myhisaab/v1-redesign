import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { attendanceApi } from '../api/attendanceApi'
import type {
  BulkAttendanceRegisterRequest,
  BulkAttendanceUpdateRequest,
} from '../types/attendanceApi.types'
import { toast } from 'sonner'
import { sound } from '@/lib/sound'

export const attendanceQueryKeys = {
  all: ['attendance'] as const,
  dailySummary: (date: string) => [...attendanceQueryKeys.all, 'dailySummary', date] as const,
  employeeMonthly: (employeeId: string, month: string) =>
    [...attendanceQueryKeys.all, 'employeeMonthly', employeeId, month] as const,
  employeeDaySessions: (employeeId: string, date: string) =>
    [...attendanceQueryKeys.all, 'employeeDaySessions', employeeId, date] as const,
  mySessions: (date: string) => [...attendanceQueryKeys.all, 'mySessions', date] as const,
}

/**
 * Hook to fetch attendance sessions for the currently logged-in user on a given date (POST /attendance/all)
 */
export function useMyAttendanceSessionsQuery(dateStr: string, enabled: boolean = true) {
  return useQuery({
    queryKey: attendanceQueryKeys.mySessions(dateStr),
    queryFn: async () => {
      const res = await attendanceApi.getMyAttendanceSessions({ attendance_date: dateStr })
      if (res && res.success && Array.isArray(res.data)) {
        return res.data
      }
      return []
    },
    enabled: Boolean(dateStr) && enabled,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Hook to fetch daily attendance summary for all employees on a given date
 */
export function useDailyAttendanceSummaryQuery(dateStr: string, enabled: boolean = true) {
  return useQuery({
    queryKey: attendanceQueryKeys.dailySummary(dateStr),
    queryFn: () => attendanceApi.getDailyAttendanceSummary({ date: dateStr }),
    enabled: Boolean(dateStr) && enabled,
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Hook to fetch monthly attendance summary for an employee (for calendar view)
 */
export function useEmployeeMonthlySummaryQuery(
  employeeId: string,
  monthStr: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: attendanceQueryKeys.employeeMonthly(employeeId, monthStr),
    queryFn: () =>
      attendanceApi.getEmployeeMonthlySummary({
        employee_id: employeeId,
        date: monthStr,
      }),
    enabled: Boolean(employeeId) && Boolean(monthStr) && enabled,
    staleTime: 60 * 1000, // 1 minute
  })
}

/**
 * Hook to fetch all punch sessions for an employee on a specific date (for modal view)
 */
export function useEmployeeDaySessionsQuery(
  employeeId: string,
  dateStr: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: attendanceQueryKeys.employeeDaySessions(employeeId, dateStr),
    queryFn: () =>
      attendanceApi.getEmployeeDaySessions({
        employee_id: employeeId,
        attendance_date: dateStr,
      }),
    enabled: Boolean(employeeId) && Boolean(dateStr) && enabled,
    staleTime: 30 * 1000,
  })
}

/**
 * Mutation to manually register bulk attendance sessions (work / break)
 * POST /attendance/register/bulk
 */
export function useRegisterBulkAttendanceMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: BulkAttendanceRegisterRequest) => {
      const res = await attendanceApi.registerBulkAttendance(payload)
      if (res && res.success === false) {
        throw new Error(res.message || 'Failed to register attendance')
      }
      return res
    },
    onSuccess: () => {
      sound.success()
      queryClient.invalidateQueries({ queryKey: attendanceQueryKeys.all })
    },
    onError: (err: any) => {
      sound.error()
      toast.error(err?.response?.data?.message || err.message || 'Failed to register attendance')
    },
  })
}

/**
 * Mutation to update bulk attendance sessions (work / break)
 * PUT /attendance/update/bulk
 */
export function useUpdateBulkAttendanceMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: BulkAttendanceUpdateRequest) => {
      const res = await attendanceApi.updateBulkAttendance(payload)
      if (res && res.success === false) {
        throw new Error(res.message || 'Failed to update attendance')
      }
      return res
    },
    onSuccess: () => {
      sound.success()
      queryClient.invalidateQueries({ queryKey: attendanceQueryKeys.all })
    },
    onError: (err: any) => {
      sound.error()
      toast.error(err?.response?.data?.message || err.message || 'Failed to update attendance')
    },
  })
}

/**
 * Mutation to delete an attendance session
 * DELETE /attendance/session/delete
 * Body: { employee_id: "...", attendance_id: "..." }
 */
export function useDeleteAttendanceSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { employee_id: string; attendance_id: string }) => {
      const res = await attendanceApi.deleteAttendanceSession(payload)
      if (res && res.success === false) {
        throw new Error(res.message || 'Failed to delete attendance session')
      }
      return res
    },
    onSuccess: () => {
      sound.success()
      queryClient.invalidateQueries({ queryKey: attendanceQueryKeys.all })
    },
    onError: (err: any) => {
      sound.error()
      toast.error(err?.response?.data?.message || err.message || 'Failed to delete attendance session')
    },
  })
}

export interface GeolocationResult {
  latitude: number | null
  longitude: number | null
  accuracy?: number | null
  error?: string | null
  errorCode?: number | null // 1: PERMISSION_DENIED, 2: POSITION_UNAVAILABLE, 3: TIMEOUT, 0: NOT_SUPPORTED
}

/**
 * Check geolocation permission status
 */
export async function checkGeolocationPermission(): Promise<'granted' | 'prompt' | 'denied' | 'unsupported'> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return 'unsupported'
  }
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
      return status.state
    } catch {
      return 'prompt'
    }
  }
  return 'prompt'
}

/**
 * IP-based geolocation fallback for desktop PCs / environments where OS location service is disabled
 */
async function getIpCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  const fetchWithTimeout = async (url: string, timeoutMs = 2500): Promise<any> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) return null
      return await res.json()
    } catch {
      clearTimeout(timer)
      return null
    }
  }

  // 1. Try geojs.io (Fastest & high CORS reliability)
  try {
    const data = await fetchWithTimeout('https://get.geojs.io/v1/ip/geo.json')
    if (data && (data.latitude || data.lat) && (data.longitude || data.lon || data.lng)) {
      const lat = parseFloat(data.latitude || data.lat)
      const lng = parseFloat(data.longitude || data.lon || data.lng)
      if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
        return {
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
        }
      }
    }
  } catch {}

  // 2. Try ipwho.is
  try {
    const data = await fetchWithTimeout('https://ipwho.is/')
    if (data && data.success !== false && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      return {
        latitude: Number(data.latitude.toFixed(6)),
        longitude: Number(data.longitude.toFixed(6)),
      }
    }
  } catch {}

  // 3. Try freeipapi.com
  try {
    const data = await fetchWithTimeout('https://freeipapi.com/api/json')
    if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      return {
        latitude: Number(data.latitude.toFixed(6)),
        longitude: Number(data.longitude.toFixed(6)),
      }
    }
  } catch {}

  // 4. Try ipapi.co
  try {
    const data = await fetchWithTimeout('https://ipapi.co/json/')
    if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      return {
        latitude: Number(data.latitude.toFixed(6)),
        longitude: Number(data.longitude.toFixed(6)),
      }
    }
  } catch {}

  return null
}

/**
 * Browser geolocation helper with 3-stage resolution:
 * Stage 1: Fast high-accuracy attempt (GPS / mobile)
 * Stage 2: Standard browser network positioning
 * Stage 3: IP-based desktop fallback (resolves instantly even if Windows OS location service is disabled)
 */
export async function getCurrentBrowserCoordinates(options?: { allowIpFallback?: boolean }): Promise<GeolocationResult> {
  if (typeof window === 'undefined') {
    return { latitude: null, longitude: null, error: 'Window not available', errorCode: 0 }
  }

  const tryPosition = (opts: PositionOptions): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'))
        return
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, opts)
    })
  }

  let lastError: any = null

  if (navigator.geolocation) {
    // Stage 1: Try standard browser / Wi-Fi network positioning first (fast & reliable on desktop + mobile)
    try {
      const pos = await tryPosition({
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 300000,
      })
      return {
        latitude: Number(pos.coords.latitude.toFixed(6)),
        longitude: Number(pos.coords.longitude.toFixed(6)),
        accuracy: pos.coords.accuracy,
      }
    } catch (err) {
      lastError = err
    }

    // Stage 2: Try high accuracy GPS (if mobile GPS is available)
    try {
      const pos = await tryPosition({
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      })
      return {
        latitude: Number(pos.coords.latitude.toFixed(6)),
        longitude: Number(pos.coords.longitude.toFixed(6)),
        accuracy: pos.coords.accuracy,
      }
    } catch (err) {
      lastError = err
    }
  }

  // Stage 3: Desktop Fallback (when Windows OS location is OFF or PC lacks GPS hardware)
  // Ensures punch works seamlessly on laptops/desktops without blocking the employee
  if (options?.allowIpFallback !== false) {
    const ipCoords = await getIpCoordinates()
    if (ipCoords) {
      return {
        latitude: ipCoords.latitude,
        longitude: ipCoords.longitude,
        accuracy: 1000,
      }
    }
  }

  const errorCode = lastError?.code ?? (navigator.geolocation ? 2 : 0)
  const errorMsg =
    errorCode === 1
      ? 'Location permission is blocked in browser. Please allow location permissions.'
      : errorCode === 2
      ? 'Location is unavailable or device location is OFF.'
      : errorCode === 3
      ? 'Location request timed out. Please try again.'
      : lastError?.message || 'Unable to retrieve location.'

  return {
    latitude: null,
    longitude: null,
    error: errorMsg,
    errorCode,
  }
}

/**
 * Mutation: Punch in (POST /attendance/check-in)
 */
export function useCheckInMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await attendanceApi.checkIn(data)
      if (res && res.success === false) {
        throw new Error(res.message || 'Failed to punch in')
      }
      return res
    },
    onSuccess: (data: any) => {
      sound.success()
      toast.success(data?.message || 'Punched in successfully!')
      queryClient.invalidateQueries({ queryKey: attendanceQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
    },
    onError: (err: any) => {
      sound.error()
      toast.error(err?.response?.data?.message || err.message || 'Failed to punch in')
    },
  })
}

/**
 * Mutation: Break in (POST /attendance/break-in)
 */
export function useBreakInMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await attendanceApi.breakIn(data)
      if (res && res.success === false) {
        throw new Error(res.message || 'Failed to start break')
      }
      return res
    },
    onSuccess: (data: any) => {
      sound.success()
      toast.success(data?.message || 'Break started successfully!')
      queryClient.invalidateQueries({ queryKey: attendanceQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
    },
    onError: (err: any) => {
      sound.error()
      toast.error(err?.response?.data?.message || err.message || 'Failed to start break')
    },
  })
}

/**
 * Mutation: Break out (PATCH /attendance/break-out)
 */
export function useBreakOutMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await attendanceApi.breakOut(data)
      if (res && res.success === false) {
        throw new Error(res.message || 'Failed to resume work')
      }
      return res
    },
    onSuccess: (data: any) => {
      sound.success()
      toast.success(data?.message || 'Resumed work successfully!')
      queryClient.invalidateQueries({ queryKey: attendanceQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
    },
    onError: (err: any) => {
      sound.error()
      toast.error(err?.response?.data?.message || err.message || 'Failed to resume work')
    },
  })
}

/**
 * Mutation: Check out (PATCH /attendance/check-out)
 */
export function useCheckOutMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await attendanceApi.checkOut(data)
      if (res && res.success === false) {
        throw new Error(res.message || 'Failed to punch out')
      }
      return res
    },
    onSuccess: (data: any) => {
      sound.success()
      toast.success(data?.message || 'Punched out successfully!')
      queryClient.invalidateQueries({ queryKey: attendanceQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
    },
    onError: (err: any) => {
      sound.error()
      toast.error(err?.response?.data?.message || err.message || 'Failed to punch out')
    },
  })
}

