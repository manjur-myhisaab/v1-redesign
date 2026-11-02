import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Panel from '@/components/admin/Panel'
import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'

import { useLiveTrackingFirebase } from './hooks/useLiveTrackingFirebase'
import { useTrackingEmployees } from './hooks/useTrackingEmployees'
import { resolveFirmId } from './utils/firmResolver'
import { TrackingHeader } from './components/TrackingHeader'
import { TrackingSidebar } from './components/TrackingSidebar'
import { TrackingMap } from './components/TrackingMap'

export const RealtimeTracking: React.FC = () => {
  const { firstTabActive } = useShell()
  const { user, activeWorkspace } = useAuth()
  const navigate = useNavigate()

  const mapInstanceRef = useRef<any>(null)
  const hasInitiallyCenteredRef = useRef<boolean>(false)

  // 1. Resolve Firm ID
  const firmId = resolveFirmId(user, activeWorkspace)

  // 2. Firebase Realtime Tracking Listener
  const { realtimeDataMap, connectionStatus, refetch: refetchFirebase } = useLiveTrackingFirebase(firmId)

  // 3. Employee Master Data & Merged Geolocation
  const {
    employees,
    categories,
    stats,
    isLoading: isLoadingEmployees,
    refetchEmployees,
  } = useTrackingEmployees(user?.id, realtimeDataMap)

  // Filter & Selection State
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all')

  // Center Map on all currently filtered located employees
  const handleCenterMap = useCallback(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return

    const located = employees.filter((e) => {
      const isCatMatch = selectedCategory === 'all' || String(e.category_id) === String(selectedCategory)
      const isEmpMatch = selectedEmployeeId === 'all' || String(e.id) === String(selectedEmployeeId)
      return isCatMatch && isEmpMatch && e.current_lat && e.current_long
    })

    if (located.length === 0) {
      mapInstanceRef.current.setZoom(12)
      return
    }

    if (located.length === 1) {
      const lat = parseFloat(String(located[0].current_lat))
      const lng = parseFloat(String(located[0].current_long))
      if (!isNaN(lat) && !isNaN(lng)) {
        mapInstanceRef.current.panTo({ lat, lng })
        mapInstanceRef.current.setZoom(15)
      }
      return
    }

    const bounds = new window.google.maps.LatLngBounds()
    located.forEach((emp) => {
      const lat = parseFloat(String(emp.current_lat))
      const lng = parseFloat(String(emp.current_long))
      if (!isNaN(lat) && !isNaN(lng)) {
        bounds.extend({ lat, lng })
      }
    })

    mapInstanceRef.current.fitBounds(bounds, {
      top: 60,
      right: 60,
      bottom: 60,
      left: 60,
    })
  }, [employees, selectedCategory, selectedEmployeeId])

  // Track All Handler (resets selection and fits bounds)
  const handleTrackAll = useCallback(() => {
    setSelectedCategory('all')
    setSelectedEmployeeId('all')

    if (!mapInstanceRef.current || !window.google?.maps) return

    const allLocated = employees.filter((e) => e.current_lat && e.current_long)
    if (allLocated.length === 0) return

    const bounds = new window.google.maps.LatLngBounds()
    allLocated.forEach((emp) => {
      const lat = parseFloat(String(emp.current_lat))
      const lng = parseFloat(String(emp.current_long))
      if (!isNaN(lat) && !isNaN(lng)) {
        bounds.extend({ lat, lng })
      }
    })

    mapInstanceRef.current.fitBounds(bounds, {
      top: 60,
      right: 60,
      bottom: 60,
      left: 60,
    })
  }, [employees])

  // Initial center when employees are loaded
  useEffect(() => {
    if (!hasInitiallyCenteredRef.current && employees.length > 0 && mapInstanceRef.current) {
      const anyLocated = employees.some((e) => e.current_lat && e.current_long)
      if (anyLocated) {
        hasInitiallyCenteredRef.current = true
        handleCenterMap()
      }
    }
  }, [employees, handleCenterMap])

  // Combined Refresh
  const handleRefresh = useCallback(() => {
    refetchEmployees()
    refetchFirebase()
  }, [refetchEmployees, refetchFirebase])

  // View Profile Handler
  const handleViewProfile = useCallback(
    (userId: string | number) => {
      navigate(`/admin/staff?id=${userId}`)
    },
    [navigate]
  )

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel
        className={cn(
          'flex min-w-0 flex-1 flex-col h-full overflow-hidden bg-background border border-border shadow-2xs',
          firstTabActive && 'rounded-tl-none'
        )}
      >
        {/* Top Tracking Header with Realtime/Timeline Tabs and Live Stream Indicators */}
        <TrackingHeader
          connectionStatus={connectionStatus}
          totalEmployees={stats.total}
          locatedEmployees={stats.located}
          liveOnCount={stats.liveOn}
          liveOffCount={stats.liveOff}
          isLoading={isLoadingEmployees}
          onRefresh={handleRefresh}
        />

        {/* Main Body: Collapsible Staff Sidebar + Full-Height Interactive Map */}
        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          <TrackingSidebar
            employees={employees}
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={(catId) => {
              setSelectedCategory(catId)
              setSelectedEmployeeId('all')
            }}
            selectedEmployeeId={selectedEmployeeId}
            onSelectEmployee={setSelectedEmployeeId}
            onTrackAll={handleTrackAll}
            onCenterMap={handleCenterMap}
            onViewProfile={handleViewProfile}
          />

          <TrackingMap
            employees={employees}
            selectedEmployeeId={selectedEmployeeId}
            onSelectEmployee={setSelectedEmployeeId}
            onViewProfile={handleViewProfile}
            mapInstanceRef={mapInstanceRef}
          />
        </div>
      </Panel>
    </div>
  )
}

export default RealtimeTracking
