import { useState, useEffect, useMemo, useCallback } from 'react'
import rdk, { ATTENDANCE_SERVER_URL, readItems } from '@/services/server'
import type { TrackingEmployee, EmployeeCategory, FirebaseRealtimeItem } from '../types'

export const useTrackingEmployees = (
  currentUserId: string | number | undefined,
  realtimeDataMap: Record<string, FirebaseRealtimeItem>
) => {
  const [rawEmployees, setRawEmployees] = useState<any[]>([])
  const [categories, setCategories] = useState<EmployeeCategory[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // 1. Fetch Categories
  const loadCategories = useCallback(async () => {
    try {
      const res: any = await rdk.request(readItems('employee_category' as any, { limit: -1 }))
      const list = res?.data || (Array.isArray(res) ? res : [])
      setCategories(list)
    } catch {
      try {
        const token = localStorage.getItem('authToken')
        const resp = await fetch(`${ATTENDANCE_SERVER_URL}/items/employee_category?limit=-1`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (resp.ok) {
          const json = await resp.json()
          setCategories(json?.data || [])
        }
      } catch (err: any) {
        console.warn('Categories load note:', err?.message || err)
      }
    }
  }, [])

  // 2. Fetch Active Staff
  const fetchEmployees = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const token = localStorage.getItem('authToken')

    try {
      let usersList: any[] = []
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
        if (token) {
          const resp = await fetch(
            `${ATTENDANCE_SERVER_URL}/users?fields=*,firm_id.*,employee_category_id.*&limit=-1`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          )
          if (resp.ok) {
            const json = await resp.json()
            usersList = json?.data || []
          }
        }
      }

      const activeUsers = usersList.filter((emp: any) => {
        if (emp.status && emp.status !== 'active') return false
        if (currentUserId && String(emp.id) === String(currentUserId)) return false
        return true
      })

      setRawEmployees(activeUsers)
      return activeUsers
    } catch (err: any) {
      console.error('Error fetching employees for tracking:', err)
      setError(err?.message || 'Failed to load employees')
      return []
    } finally {
      setIsLoading(false)
    }
  }, [currentUserId])

  useEffect(() => {
    loadCategories()
    fetchEmployees()
  }, [loadCategories, fetchEmployees])

  // 3. Merge with Firebase Realtime locations
  const employeesWithLocations = useMemo<TrackingEmployee[]>(() => {
    return rawEmployees.map((emp) => {
      const liveData = realtimeDataMap[String(emp.id)] || {}
      const hasLiveData = Boolean(liveData.last_lat || liveData.geo_lat || liveData.latitude)

      const lat = liveData.last_lat ?? liveData.geo_lat ?? liveData.latitude ?? emp.last_lat
      const lng = liveData.last_long ?? liveData.geo_long ?? liveData.longitude ?? emp.last_long
      const lastSeen =
        liveData.timestamp ||
        liveData.deviceTimestamp ||
        liveData.last_loc_time ||
        emp.last_loc_time

      const categoryObj =
        typeof emp.employee_category_id === 'object' && emp.employee_category_id !== null
          ? emp.employee_category_id
          : null
      const categoryId = categoryObj
        ? categoryObj.employee_category_id || categoryObj.id
        : emp.employee_category_id
      const matchedCategory = categories.find(
        (c) => String(c.employee_category_id || c.id) === String(categoryId)
      )
      const categoryName =
        categoryObj?.employee_category_name ||
        categoryObj?.category_name ||
        matchedCategory?.employee_category_name ||
        matchedCategory?.category_name ||
        'General'

      return {
        ...emp,
        category_id: categoryId,
        category_name: categoryName,
        current_lat: lat,
        current_long: lng,
        current_last_seen: lastSeen,
        is_realtime_active: hasLiveData,
        battery_percentage:
          liveData.battery_percentage ?? liveData.battery_level ?? emp.battery_percentage,
        is_moving: liveData.is_moving,
        speed: liveData.speed,
        accuracy: liveData.accuracy,
        last_geo_address: liveData.address || emp.last_geo_address,
      }
    })
  }, [rawEmployees, realtimeDataMap, categories])

  const stats = useMemo(() => {
    const total = rawEmployees.length
    const liveOn = rawEmployees.filter((e) => e.live_tracking !== false).length
    const liveOff = total - liveOn
    const located = employeesWithLocations.filter((e) => e.current_lat && e.current_long).length

    return {
      total,
      liveOn,
      liveOff,
      located,
    }
  }, [rawEmployees, employeesWithLocations])

  return {
    employees: employeesWithLocations,
    rawEmployees,
    categories,
    stats,
    isLoading,
    error,
    refetchEmployees: fetchEmployees,
  }
}
