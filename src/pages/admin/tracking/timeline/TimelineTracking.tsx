import React, { useState, useRef, useEffect, useCallback } from 'react'
import Panel from '@/components/admin/Panel'
import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'

import { useTimelineData } from './hooks/useTimelineData'
import { resolveFirmId, resolveFirmName } from '../utils/firmResolver'
import { downloadLocationGroupReport } from '@/utils/downloadLocationGroupReport'
import { TimelineHeader } from './components/TimelineHeader'
import { TimelineSidebar } from './components/TimelineSidebar'
import { TimelineMap } from './components/TimelineMap'
import { TimelinePlayerBar } from './components/TimelinePlayerBar'
import type { TimelineLocationGroup, PlaybackSpeed } from './types'

export const TimelineTracking: React.FC = () => {
  const { firstTabActive } = useShell()
  const { user, activeWorkspace } = useAuth()

  const mapInstanceRef = useRef<any>(null)
  const firmId = resolveFirmId(user, activeWorkspace)

  // Timeline Data Hook
  const {
    employees,
    selectedEmployeeId,
    setSelectedEmployeeId,
    selectedDate,
    setSelectedDate,
    isLoadingEmployees,
    isLoadingTimeline,
    points,
    groups,
    summary,
    loadTimeline,
  } = useTimelineData(user?.id, firmId ?? undefined)

  // Playback States
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1)
  const autoFollow = true

  // Automatically load timeline when an employee is selected or date changes
  useEffect(() => {
    if (selectedEmployeeId && selectedDate) {
      loadTimeline(selectedEmployeeId, selectedDate)
    }
  }, [selectedEmployeeId, selectedDate, loadTimeline])

  // Reset playback whenever new points are loaded
  useEffect(() => {
    setCurrentIndex(0)
    setIsPlaying(false)
  }, [points])

  // Playback timer engine
  useEffect(() => {
    if (!isPlaying) return
    const totalPoints = points.length
    if (totalPoints <= 1) {
      setIsPlaying(false)
      return
    }

    // Interval speed in ms based on playback speed multiplier
    // 1x = 240ms, 2x = 120ms, 4x = 60ms, 8x = 30ms
    const intervalMs = Math.round(240 / playbackSpeed)

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= totalPoints - 1) {
          setIsPlaying(false)
          return totalPoints - 1
        }
        return prev + 1
      })
    }, intervalMs)

    return () => clearInterval(timer)
  }, [isPlaying, points.length, playbackSpeed])

  // Toggle Play / Pause
  const handleTogglePlay = useCallback(() => {
    if (points.length <= 1) return
    if (currentIndex >= points.length - 1) {
      setCurrentIndex(0)
    }
    setIsPlaying((prev) => !prev)
  }, [points.length, currentIndex])

  // Reset to Journey Start
  const handleReset = useCallback(() => {
    setIsPlaying(false)
    setCurrentIndex(0)
    if (points[0] && mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat: points[0].lat, lng: points[0].lng })
    }
  }, [points])

  // Fit Map to Entire Route
  const handleFitMap = useCallback(() => {
    if (!mapInstanceRef.current || !window.google?.maps || points.length === 0) return
    const bounds = new window.google.maps.LatLngBounds()
    const coords =
      groups.length > 0
        ? groups.map((g) => g.position)
        : points.map((p) => ({ lat: p.lat, lng: p.lng }))
    coords.forEach((c) => bounds.extend(c))
    mapInstanceRef.current.fitBounds(bounds, {
      top: 60,
      right: 60,
      bottom: 120,
      left: 60,
    })
  }, [points, groups])

  // Select Group / Stop from Sidebar or Map
  const handleSelectGroup = useCallback(
    (group: TimelineLocationGroup) => {
      setIsPlaying(false)
      setCurrentIndex(group.startIndex)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo(group.position)
        mapInstanceRef.current.setZoom(16)
      }
    },
    []
  )

  // Export Excel Report (Matching v1 downloadLocationGroupReport exactly)
  const handleExportReport = useCallback(() => {
    const selectedEmp = employees.find((e) => e.id === selectedEmployeeId)
    const empName = selectedEmp ? selectedEmp.full_name : 'Staff'
    const firmName = resolveFirmName(user, activeWorkspace, employees)

    downloadLocationGroupReport(
      empName,
      selectedDate,
      groups,
      firmName,
      points.length
    )
  }, [employees, selectedEmployeeId, activeWorkspace, user, selectedDate, groups, points.length])

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel
        className={cn(
          'flex min-w-0 flex-1 flex-col h-full overflow-hidden bg-background border border-border shadow-2xs',
          firstTabActive && 'rounded-tl-none'
        )}
      >
        {/* Top Header with Employee & Date Pickers, Load Journey & Export buttons */}
        <TimelineHeader
          employees={employees}
          selectedEmployeeId={selectedEmployeeId}
          onSelectEmployee={setSelectedEmployeeId}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          isLoadingEmployees={isLoadingEmployees}
          isLoadingTimeline={isLoadingTimeline}
          hasData={points.length > 0 || groups.length > 0}
          onLoadTimeline={() => loadTimeline()}
          onExportReport={handleExportReport}
          onFitMap={handleFitMap}
        />

        {/* Main Body: Collapsible Stops Sidebar + Full-Height Map + Floating Video Player */}
        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          <TimelineSidebar
            groups={groups}
            summary={summary}
            currentIndex={currentIndex}
            onSelectGroup={handleSelectGroup}
            isLoading={isLoadingTimeline}
          />

          <TimelineMap
            points={points}
            groups={groups}
            currentIndex={currentIndex}
            onSelectGroup={handleSelectGroup}
            autoFollow={autoFollow}
            mapInstanceRef={mapInstanceRef}
          />

          {/* Floating Video Playback Scrubber Bar (visible when route points exist) */}
          {points.length > 0 && (
            <TimelinePlayerBar
              points={points}
              currentIndex={currentIndex}
              onIndexChange={(idx) => {
                setIsPlaying(false)
                setCurrentIndex(idx)
              }}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onReset={handleReset}
              playbackSpeed={playbackSpeed}
              onChangeSpeed={setPlaybackSpeed}
              totalDistanceKm={summary.totalDistanceKm}
            />
          )}
        </div>
      </Panel>
    </div>
  )
}

export default TimelineTracking
