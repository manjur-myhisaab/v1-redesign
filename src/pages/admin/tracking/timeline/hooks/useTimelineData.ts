import { useState, useEffect, useRef, useCallback } from 'react'
import { getDatabase, ref, get, onValue, off, type DatabaseReference } from 'firebase/database'
import { format, isSameDay } from 'date-fns'
import app from '@/config/firebase'
import rdk, { ATTENDANCE_SERVER_URL } from '@/services/server'
import type {
  ParsedTimelinePoint,
  TimelineLocationGroup,
  TimelineSummary,
  TimelineEmployee,
} from '../types'

// Haversine distance formula in meters
export const calculateDistanceMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371000 // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Format time HH:mm AM/PM (matching v1 exact device timestamp extraction)
export const formatPointTime = (timestamp: Date | string | number): string => {
  if (!timestamp) return '-'
  try {
    if (typeof timestamp === 'string') {
      const match = timestamp.match(/T(\d{2}):(\d{2})/)
      if (match) {
        const hours = parseInt(match[1], 10)
        const minutes = match[2]
        const period = hours >= 12 ? 'PM' : 'AM'
        const displayHours = hours % 12 || 12
        return `${displayHours}:${minutes} ${period}`
      }
    }
    const d = typeof timestamp === 'string' || typeof timestamp === 'number' ? new Date(timestamp) : timestamp
    if (isNaN(d.getTime())) return '-'
    return format(d, 'hh:mm a')
  } catch {
    return '-'
  }
}

const getEffectiveToken = (): string => {
  return (
    localStorage.getItem('authToken') ||
    localStorage.getItem('mh.token') ||
    localStorage.getItem('token') ||
    ''
  )
}

export const useTimelineData = (currentUserId?: string | number, currentFirmId?: string | number) => {
  const [employees, setEmployees] = useState<TimelineEmployee[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(false)
  const [isLoadingTimeline, setIsLoadingTimeline] = useState<boolean>(false)
  const [progressPercent, setProgressPercent] = useState<number>(0)

  const [points, setPoints] = useState<ParsedTimelinePoint[]>([])
  const [groups, setGroups] = useState<TimelineLocationGroup[]>([])
  const [summary, setSummary] = useState<TimelineSummary>({
    totalPoints: 0,
    totalGroups: 0,
    totalDistanceKm: 0,
    odometerDistanceKm: 0,
    startTime: null,
    endTime: null,
    totalDurationFormatted: '0m',
    startBattery: null,
    endBattery: null,
  })

  const database = getDatabase(app)
  const realtimeRef = useRef<DatabaseReference | null>(null)
  const rawStaffRef = useRef<any[]>([])

  // 1. Fetch Employees using RDK with multi-token fallback
  useEffect(() => {
    let isMounted = true
    const fetchStaff = async () => {
      setIsLoadingEmployees(true)
      const token = getEffectiveToken()

      try {
        let usersList: any[] = []

        // Try via RDK first
        try {
          const res: any = await rdk.request({
            path: 'users',
            method: 'GET',
            params: {
              limit: -1,
              fields: ['*', 'firm_id.*', 'employee_category_id.*'],
            },
          } as any)
          usersList = res?.data || (Array.isArray(res) ? res : [])
        } catch {
          // Direct fetch fallback
          if (token) {
            const resp = await fetch(
              `${ATTENDANCE_SERVER_URL}/users?fields=*,firm_id.*,employee_category_id.*&limit=-1`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            )
            if (resp.ok) {
              const body = await resp.json()
              usersList = body?.data || []
            }
          }
        }

        rawStaffRef.current = usersList

        const activeStaff: TimelineEmployee[] = usersList
          .filter((u: any) => {
            if (u.status && u.status !== 'active') return false
            if (currentUserId && String(u.id) === String(currentUserId)) return false
            return true
          })
          .map((u: any) => ({
            id: String(u.id),
            first_name: u.first_name || '',
            last_name: u.last_name || '',
            full_name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || `Staff #${u.id}`,
            avatar: u.avatar,
            department_name: u.department_id?.department_name || u.department_name,
            category_name:
              typeof u.employee_category_id === 'object'
                ? u.employee_category_id?.employee_category_name || u.employee_category_id?.category_name
                : u.category_name,
            live_tracking: u.live_tracking !== false,
            last_lat: u.last_lat,
            last_long: u.last_long,
            last_loc_time: u.last_loc_time,
            last_geo_address: u.last_geo_address,
          }))
          .sort((a: TimelineEmployee, b: TimelineEmployee) => {
            // Live tracking enabled employees first, then alphabetical
            const aLive = a.live_tracking ? 1 : 0
            const bLive = b.live_tracking ? 1 : 0
            if (aLive !== bLive) return bLive - aLive
            return a.full_name.localeCompare(b.full_name)
          })

        if (isMounted) {
          setEmployees(activeStaff)
          if (activeStaff.length > 0 && !selectedEmployeeId) {
            setSelectedEmployeeId(activeStaff[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to load tracking staff list:', err)
      } finally {
        if (isMounted) setIsLoadingEmployees(false)
      }
    }

    fetchStaff()
    return () => {
      isMounted = false
    }
  }, [currentUserId])

  // 2. Compact points into Location Groups (100m threshold matching v1)
  const buildLocationGroups = useCallback(
    (sortedPoints: ParsedTimelinePoint[]): TimelineLocationGroup[] => {
      if (sortedPoints.length === 0) return []

      const result: TimelineLocationGroup[] = []

      for (let i = 0; i < sortedPoints.length; i++) {
        const pt = sortedPoints[i]
        const lastGroup = result[result.length - 1]

        if (lastGroup) {
          const dist = calculateDistanceMeters(
            lastGroup.position.lat,
            lastGroup.position.lng,
            pt.lat,
            pt.lng
          )

          // If within 100 meters, merge into existing group
          if (dist < 100) {
            lastGroup.endIndex = i
            lastGroup.pointCount += 1
            if (pt.timestamp > lastGroup.endTime) {
              lastGroup.endTime = pt.timestamp
              if (pt.batteryPercentage !== null) {
                lastGroup.batteryPercentage = pt.batteryPercentage
              }
            }
            if (pt.timestamp < lastGroup.startTime) {
              lastGroup.startTime = pt.timestamp
            }
            if (lastGroup.address === 'Unknown location' && pt.address && pt.address.trim()) {
              lastGroup.address = pt.address
            }
            continue
          }
        }

        // Create new location group
        result.push({
          id: `group-${i}-${pt.id}`,
          position: { lat: pt.lat, lng: pt.lng },
          address: pt.address || 'Unknown location',
          startIndex: i,
          endIndex: i,
          pointCount: 1,
          startTime: pt.timestamp,
          endTime: pt.timestamp,
          durationMinutes: 0,
          timeRangeString: formatPointTime(pt.timestamp),
          accuracy: pt.accuracy,
          batteryPercentage: pt.batteryPercentage,
          status: 'transit',
          hasPoorAccuracy: pt.accuracy !== null && pt.accuracy > 3000,
        })
      }

      // Calculate durations, timeRangeStrings and statuses
      const totalPoints = sortedPoints.length
      result.forEach((group, index) => {
        const diffMs = group.endTime.getTime() - group.startTime.getTime()
        const durationMins = Math.max(0, Math.floor(diffMs / 60000))
        group.durationMinutes = durationMins

        const startStr = formatPointTime(group.startTime)
        const endStr = formatPointTime(group.endTime)

        if (durationMins < 1) {
          group.timeRangeString = startStr
        } else if (durationMins >= 60) {
          const h = Math.floor(durationMins / 60)
          const m = durationMins % 60
          group.timeRangeString = `${startStr} - ${endStr} (${h}h${m > 0 ? ` ${m}m` : ''})`
        } else {
          group.timeRangeString = `${startStr} - ${endStr} (${durationMins}m)`
        }

        if (index === 0) {
          group.status = 'start'
        } else if (index === result.length - 1 && group.endIndex >= totalPoints - 1) {
          group.status = 'end'
        } else if (durationMins >= 1) {
          group.status = 'stayed'
        } else {
          group.status = 'transit'
        }
      })

      return result
    },
    []
  )

  // 3. Compute Summary Metrics
  const computeSummary = useCallback(
    (
      sortedPoints: ParsedTimelinePoint[],
      computedGroups: TimelineLocationGroup[]
    ): TimelineSummary => {
      if (sortedPoints.length === 0) {
        return {
          totalPoints: 0,
          totalGroups: 0,
          totalDistanceKm: 0,
          odometerDistanceKm: 0,
          startTime: null,
          endTime: null,
          totalDurationFormatted: '0m',
          startBattery: null,
          endBattery: null,
        }
      }

      // GPS Distance across points
      let totalDistMeters = 0
      for (let i = 1; i < sortedPoints.length; i++) {
        const p1 = sortedPoints[i - 1]
        const p2 = sortedPoints[i]
        totalDistMeters += calculateDistanceMeters(p1.lat, p1.lng, p2.lat, p2.lng)
      }
      const totalDistanceKm = Number((totalDistMeters / 1000).toFixed(2))

      // Odometer Distance
      const firstOdo = sortedPoints[0]?.odometer ?? 0
      const lastOdo = sortedPoints[sortedPoints.length - 1]?.odometer ?? 0
      const odometerDistanceKm = Number(Math.abs(lastOdo - firstOdo).toFixed(2))

      // Timestamps & Duration
      const startTime = sortedPoints[0].timestamp
      const endTime = sortedPoints[sortedPoints.length - 1].timestamp
      const diffMs = Math.max(0, endTime.getTime() - startTime.getTime())
      const totalMins = Math.floor(diffMs / 60000)
      const hrs = Math.floor(totalMins / 60)
      const mins = totalMins % 60
      const totalDurationFormatted = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`

      // Battery
      const startBattery = sortedPoints[0]?.batteryPercentage ?? null
      const endBattery = sortedPoints[sortedPoints.length - 1]?.batteryPercentage ?? null

      return {
        totalPoints: sortedPoints.length,
        totalGroups: computedGroups.length,
        totalDistanceKm,
        odometerDistanceKm,
        startTime,
        endTime,
        totalDurationFormatted,
        startBattery,
        endBattery,
      }
    },
    []
  )

  // Parse raw array of points into ParsedTimelinePoint[]
  const parseRawLocations = (rawList: any[]): ParsedTimelinePoint[] => {
    return rawList
      .map((item, idx) => {
        const lat = parseFloat(item.geo_lat || item.latitude || item.lat || 0)
        const lng = parseFloat(item.geo_long || item.longitude || item.lng || item.long || 0)
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null

        const rawTimestamp = item.deviceTimestamp || item.timestamp || item.last_loc_time || Date.now()
        const ts = new Date(rawTimestamp)
        const validTs = isNaN(ts.getTime()) ? new Date() : ts

        const accuracyRaw = item.accuracy ?? item.horizontalAccuracy ?? null
        const accuracy = accuracyRaw !== null ? parseFloat(String(accuracyRaw)) : null

        // Accuracy filter up to 5000m
        if (accuracy !== null && accuracy > 5000) return null

        let batteryPercentage: number | null = null
        const rawBat = item.battery_percentage ?? item.batteryLevel ?? item.battery
        if (rawBat !== undefined && rawBat !== null && rawBat !== '') {
          const val = parseFloat(String(rawBat))
          if (!isNaN(val)) {
            batteryPercentage = val <= 1 ? Math.round(val * 100) : Math.round(val)
          }
        }

        const speedRaw = item.speed ?? null
        const speed = speedRaw !== null ? Math.max(0, parseFloat(String(speedRaw))) : null

        const odoRaw = item.odometer ?? null
        const odometer = odoRaw !== null ? parseFloat(String(odoRaw)) : null

        const address =
          item.geo_address || item.address || item.location || 'Unknown location'

        return {
          id: String(item.id || `point-${idx}`),
          lat,
          lng,
          timestamp: validTs,
          timeFormatted: formatPointTime(validTs),
          address,
          accuracy,
          batteryPercentage,
          speed,
          odometer,
        }
      })
      .filter((p): p is ParsedTimelinePoint => p !== null)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  // 4. Multi-Source Journey Loader
  const loadTimeline = useCallback(
    async (empId = selectedEmployeeId, date = selectedDate) => {
      if (!empId || !date) return

      // Clean up previous real-time listener
      if (realtimeRef.current) {
        off(realtimeRef.current)
        realtimeRef.current = null
      }

      setIsLoadingTimeline(true)
      setProgressPercent(15)

      const day = date.getDate()
      const month = date.getMonth() + 1
      const year = date.getFullYear()

      const paddedDay = String(day).padStart(2, '0')
      const paddedMonth = String(month).padStart(2, '0')

      const dateStrD_M_YYYY = `${day}-${month}-${year}`
      const dateStrDD_MM_YYYY = `${paddedDay}-${paddedMonth}-${year}`
      const dateStrYYYY_MM_DD = `${year}-${paddedMonth}-${paddedDay}`

      try {
        let rawPoints: any[] = []

        // --- SOURCE 1: Rabit API ---
        try {
          setProgressPercent(30)
          const resp = await fetch(
            `https://rabit.one/api/tracking?user_id=${empId}&date=${dateStrYYYY_MM_DD}`,
            {
              headers: {
                'X-API-Key': '15618c043c803aaca20f840eafa4baa0e28a593b54e97724',
              },
            }
          )
          if (resp.ok) {
            const body = await resp.json()
            const found = Array.isArray(body) ? body : body.locations || body.data || []
            if (found.length > 0) {
              rawPoints = found
            }
          }
        } catch (e) {
          console.warn('Rabit API check note:', e)
        }

        // --- SOURCE 2: Firebase location_data (check both unpadded and padded paths) ---
        if (rawPoints.length === 0) {
          setProgressPercent(50)
          try {
            // Check unpadded path e.g. location_data/123/2-11-2026
            const dbRef1 = ref(database, `location_data/${empId}/${dateStrD_M_YYYY}`)
            const snap1 = await get(dbRef1)
            if (snap1.exists()) {
              const data = snap1.val()
              rawPoints = Object.entries(data).map(([key, val]) => ({
                id: key,
                ...(val as object),
              }))
            } else {
              // Check padded path e.g. location_data/123/02-11-2026
              const dbRef2 = ref(database, `location_data/${empId}/${dateStrDD_MM_YYYY}`)
              const snap2 = await get(dbRef2)
              if (snap2.exists()) {
                const data = snap2.val()
                rawPoints = Object.entries(data).map(([key, val]) => ({
                  id: key,
                  ...(val as object),
                }))
              }
            }
          } catch (e) {
            console.warn('Firebase location_data check note:', e)
          }
        }

        // --- SOURCE 3: Firebase live_location (if today's date) ---
        if (rawPoints.length === 0 && currentFirmId) {
          try {
            const liveRef = ref(database, `live_location/${currentFirmId}/${dateStrDD_MM_YYYY}/${empId}`)
            const liveSnap = await get(liveRef)
            if (liveSnap.exists()) {
              const liveData = liveSnap.val()
              if (liveData?.geo_lat || liveData?.latitude || liveData?.last_lat) {
                rawPoints = [liveData]
              }
            }
          } catch (e) {
            console.warn('Firebase live_location check note:', e)
          }
        }

        // --- SOURCE 4: Fallback to last known position in users table if date is today ---
        if (rawPoints.length === 0 && isSameDay(date, new Date())) {
          const empMeta = rawStaffRef.current.find((u) => String(u.id) === String(empId))
          if (empMeta?.last_lat && empMeta?.last_long) {
            rawPoints = [
              {
                id: 'last_known',
                geo_lat: empMeta.last_lat,
                geo_long: empMeta.last_long,
                geo_address: empMeta.last_geo_address,
                deviceTimestamp: empMeta.last_loc_time || Date.now(),
                battery_percentage: empMeta.battery_percentage,
              },
            ]
          }
        }

        setProgressPercent(90)

        // Parse and sort points
        const parsed = parseRawLocations(rawPoints)
        const computedGroups = buildLocationGroups(parsed)
        const computedSummary = computeSummary(parsed, computedGroups)

        setPoints(parsed)
        setGroups(computedGroups)
        setSummary(computedSummary)
        setProgressPercent(100)

        // If today's date, attach Realtime Firebase stream for incoming points
        if (isSameDay(date, new Date())) {
          const livePath = `location_data/${empId}/${dateStrD_M_YYYY}`
          const liveDbRef = ref(database, livePath)
          realtimeRef.current = liveDbRef

          onValue(liveDbRef, (snap) => {
            if (!snap.exists()) return
            const val = snap.val()
            const freshRaw = Object.entries(val).map(([k, v]) => ({
              id: k,
              ...(v as object),
            }))
            const freshParsed = parseRawLocations(freshRaw)
            if (freshParsed.length > parsed.length) {
              const freshGroups = buildLocationGroups(freshParsed)
              const freshSummary = computeSummary(freshParsed, freshGroups)
              setPoints(freshParsed)
              setGroups(freshGroups)
              setSummary(freshSummary)
            }
          })
        }
      } catch (err) {
        console.error('Error fetching timeline data:', err)
        setPoints([])
        setGroups([])
      } finally {
        setIsLoadingTimeline(false)
        setTimeout(() => setProgressPercent(0), 400)
      }
    },
    [selectedEmployeeId, selectedDate, database, currentFirmId, buildLocationGroups, computeSummary]
  )

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (realtimeRef.current) {
        off(realtimeRef.current)
      }
    }
  }, [])

  return {
    employees,
    selectedEmployeeId,
    setSelectedEmployeeId,
    selectedDate,
    setSelectedDate,
    isLoadingEmployees,
    isLoadingTimeline,
    progressPercent,
    points,
    groups,
    summary,
    loadTimeline,
  }
}
