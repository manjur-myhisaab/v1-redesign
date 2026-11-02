import React, { useEffect, useRef, useCallback } from 'react'
import { GOOGLE_MAP_KEY } from '@/services/server'
import type { ParsedTimelinePoint, TimelineLocationGroup } from '../types'

interface TimelineMapProps {
  points: ParsedTimelinePoint[]
  groups: TimelineLocationGroup[]
  currentIndex: number
  onSelectGroup: (group: TimelineLocationGroup) => void
  autoFollow: boolean
  mapInstanceRef: React.MutableRefObject<any>
}

const DEFAULT_CENTER = { lat: 26.8535, lng: 75.8235 }

export const TimelineMap: React.FC<TimelineMapProps> = ({
  points,
  groups,
  currentIndex,
  onSelectGroup,
  autoFollow,
  mapInstanceRef,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const isMapLoadedRef = useRef<boolean>(false)

  // Overlay element references
  const polylineRef = useRef<any>(null)
  const circlesRef = useRef<any[]>([])
  const startMarkerRef = useRef<any>(null)
  const endMarkerRef = useRef<any>(null)
  const playheadMarkerRef = useRef<any>(null)

  // Clear all map overlays
  const clearOverlays = useCallback(() => {
    if (polylineRef.current) {
      polylineRef.current.setMap(null)
      polylineRef.current = null
    }
    circlesRef.current.forEach((c) => c.setMap(null))
    circlesRef.current = []

    if (startMarkerRef.current) {
      startMarkerRef.current.setMap(null)
      startMarkerRef.current = null
    }
    if (endMarkerRef.current) {
      endMarkerRef.current.setMap(null)
      endMarkerRef.current = null
    }
    if (playheadMarkerRef.current) {
      playheadMarkerRef.current.setMap(null)
      playheadMarkerRef.current = null
    }
  }, [])

  // Initialize Map
  const initMap = useCallback(() => {
    if (!mapContainerRef.current || !window.google?.maps?.Map) return
    if (mapInstanceRef.current) return

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 13,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      zoomControlOptions: {
        position: window.google.maps.ControlPosition.RIGHT_BOTTOM,
      },
    })

    mapInstanceRef.current = map
    isMapLoadedRef.current = true
  }, [mapInstanceRef])

  // Ensure Google Maps script is available
  useEffect(() => {
    if (window.google?.maps?.Map) {
      initMap()
      return
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
    if (existingScript) {
      const interval = setInterval(() => {
        if (window.google?.maps?.Map) {
          clearInterval(interval)
          initMap()
        }
      }, 100)
      setTimeout(() => clearInterval(interval), 10000)
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAP_KEY}&libraries=geometry`
    script.async = true
    script.defer = true
    script.onload = () => initMap()
    document.head.appendChild(script)
  }, [initMap])

  // Plot Polyline, Group Circles, and Markers (matching v1 logic)
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !window.google?.maps) return

    clearOverlays()

    if (groups.length === 0 && points.length === 0) return

    // 1. Draw Polyline Route connecting location groups (or points if single group)
    const coordinates =
      groups.length > 1
        ? groups.map((g) => g.position)
        : points.map((p) => ({ lat: p.lat, lng: p.lng }))

    if (coordinates.length > 1) {
      const arrowSymbol = {
        path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 2.8,
        strokeColor: '#ffffff',
        strokeWeight: 1,
        fillColor: '#1d4ed8',
        fillOpacity: 1,
      }

      polylineRef.current = new window.google.maps.Polyline({
        path: coordinates,
        geodesic: true,
        strokeColor: '#2563EB',
        strokeOpacity: 0.85,
        strokeWeight: 4,
        icons: [
          {
            icon: arrowSymbol,
            offset: '35px',
            repeat: '70px',
          },
        ],
        map,
      })
    }

    // 2. Create Clickable Circles for Location Groups (like v1)
    groups.forEach((group, index) => {
      let circleColor = '#FF9800' // Amber default for stayed / intermediate
      let circleRadius = 25

      if (group.status === 'start' || index === 0) {
        circleColor = '#10B981' // Green for start
        circleRadius = 35
      } else if (group.status === 'end' || index === groups.length - 1) {
        circleColor = '#2563EB' // Blue for end
        circleRadius = 35
      }

      if (group.hasPoorAccuracy) {
        circleColor = '#9E9E9E' // Gray for poor accuracy
      }

      const circle = new window.google.maps.Circle({
        center: group.position,
        radius: circleRadius,
        fillColor: circleColor,
        fillOpacity: group.hasPoorAccuracy ? 0.35 : 0.55,
        strokeColor: circleColor,
        strokeOpacity: 0.85,
        strokeWeight: group.hasPoorAccuracy ? 1 : 2,
        map,
        clickable: true,
      })

      circle.addListener('click', () => {
        onSelectGroup(group)
      })

      circlesRef.current.push(circle)
    })

    // 3. Start Marker (Green circle with "S")
    const startPos = groups[0]?.position || (points[0] ? { lat: points[0].lat, lng: points[0].lng } : null)
    if (startPos) {
      startMarkerRef.current = new window.google.maps.Marker({
        position: startPos,
        map,
        title: `Start Point`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 11,
          fillColor: '#10B981',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2.5,
        },
        label: {
          text: 'S',
          color: '#FFFFFF',
          fontWeight: 'bold',
          fontSize: '11px',
        },
        zIndex: 5,
      })
    }

    // 4. End Marker (Red/Blue circle with "E")
    if (groups.length > 1 || points.length > 1) {
      const lastGroup = groups[groups.length - 1]
      const lastPt = points[points.length - 1]
      const endPos = lastGroup?.position || (lastPt ? { lat: lastPt.lat, lng: lastPt.lng } : null)

      if (endPos) {
        endMarkerRef.current = new window.google.maps.Marker({
          position: endPos,
          map,
          title: `End Point`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 11,
            fillColor: '#EF4444',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2.5,
          },
          label: {
            text: 'E',
            color: '#FFFFFF',
            fontWeight: 'bold',
            fontSize: '11px',
          },
          zIndex: 5,
        })
      }
    }

    // 5. Fit Bounds to whole journey
    if (coordinates.length > 0) {
      const bounds = new window.google.maps.LatLngBounds()
      coordinates.forEach((c) => bounds.extend(c))
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 120, left: 60 })
    }
  }, [points, groups, clearOverlays, mapInstanceRef, onSelectGroup])

  // Update Active Playhead Marker position
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !window.google?.maps || points.length === 0) return

    const currentPt = points[currentIndex]
    if (!currentPt) return

    const pos = { lat: currentPt.lat, lng: currentPt.lng }

    if (!playheadMarkerRef.current) {
      playheadMarkerRef.current = new window.google.maps.Marker({
        position: pos,
        map,
        title: `Playhead: ${currentPt.timeFormatted}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 13,
          fillColor: '#2563EB',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3.5,
        },
        zIndex: 15,
      })
    } else {
      playheadMarkerRef.current.setPosition(pos)
      playheadMarkerRef.current.setTitle(
        `Time: ${currentPt.timeFormatted}\nSpeed: ${currentPt.speed ?? 0} km/h`
      )
    }

    // Auto-follow pan
    if (autoFollow) {
      map.panTo(pos)
    }
  }, [currentIndex, points, autoFollow, mapInstanceRef])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearOverlays()
    }
  }, [clearOverlays])

  return (
    <div className="relative flex-1 w-full h-full min-h-0 bg-muted/20">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  )
}
