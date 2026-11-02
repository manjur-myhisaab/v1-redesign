import React, { useEffect, useRef, useCallback } from 'react'
import { GOOGLE_MAP_KEY } from '@/services/server'
import { createMarkerIcon } from '../utils/markerIconBuilder'
import { formatLastSeen } from '../utils/firmResolver'
import type { TrackingEmployee } from '../types'

declare global {
  interface Window {
    google: any
    liveTrackingNavigate?: (userId: string | number) => void
  }
}

interface TrackingMapProps {
  employees: TrackingEmployee[]
  selectedEmployeeId: string
  onSelectEmployee: (empId: string) => void
  onViewProfile: (userId: string | number) => void
  mapInstanceRef: React.MutableRefObject<any>
}

const DEFAULT_CENTER = { lat: 26.8535, lng: 75.8235 } // Default or Jaipur center

export const TrackingMap: React.FC<TrackingMapProps> = ({
  employees,
  selectedEmployeeId,
  onSelectEmployee,
  onViewProfile,
  mapInstanceRef,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<Record<string, { marker: any; infoWindow: any }>>({})
  const activeInfoWindowRef = useRef<any>(null)
  const isMapLoadedRef = useRef<boolean>(false)

  // Attach global navigation callback for InfoWindow button
  useEffect(() => {
    window.liveTrackingNavigate = (userId: string | number) => {
      onViewProfile(userId)
    }
    return () => {
      delete window.liveTrackingNavigate
    }
  }, [onViewProfile])

  // Initialize Map
  const initMap = useCallback(() => {
    if (!mapContainerRef.current || !window.google?.maps?.Map) return
    if (mapInstanceRef.current) return

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 12,
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

    // Try HTML5 geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          if (employees.length === 0) {
            map.setCenter(userPos)
          }
        },
        () => {},
        { timeout: 8000 }
      )
    }
  }, [employees.length, mapInstanceRef])

  // Google Maps Script Loader
  useEffect(() => {
    if (window.google && window.google.maps) {
      initMap()
      return
    }

    const scriptId = 'google-maps-realtime-tracking'
    let script = document.getElementById(scriptId) as HTMLScriptElement

    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAP_KEY}`
      script.async = true
      script.defer = true
      script.onload = () => {
        initMap()
      }
      document.head.appendChild(script)
    } else {
      const interval = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(interval)
          initMap()
        }
      }, 100)
      return () => clearInterval(interval)
    }
  }, [initMap])

  // Update Markers on employees update
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return

    const activeIds = new Set(employees.map((e) => String(e.id)))

    // Remove obsolete markers
    Object.keys(markersRef.current).forEach((id) => {
      if (!activeIds.has(String(id))) {
        markersRef.current[id]?.marker?.setMap(null)
        delete markersRef.current[id]
      }
    })

    // Add or update markers
    employees.forEach(async (emp) => {
      if (!emp.current_lat || !emp.current_long) {
        if (markersRef.current[String(emp.id)]) {
          markersRef.current[String(emp.id)].marker.setMap(null)
          delete markersRef.current[String(emp.id)]
        }
        return
      }

      const lat = parseFloat(String(emp.current_lat))
      const lng = parseFloat(String(emp.current_long))
      if (isNaN(lat) || isNaN(lng)) return

      const position = { lat, lng }
      const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Staff'
      const isLiveOn = emp.live_tracking !== false
      const lastSeenText = formatLastSeen(emp.current_last_seen)

      const rawBat = emp.battery_percentage ? parseFloat(String(emp.battery_percentage)) : null
      const batVal = rawBat !== null ? (rawBat > 1 ? Math.round(rawBat) : Math.round(rawBat * 100)) : null

      const trackingBadge = isLiveOn
        ? `<span style="display:inline-block;padding:2px 8px;border-radius:12px;background:#dcfce7;color:#15803d;font-size:11px;font-weight:600;">● Live Tracking Active</span>`
        : `<span style="display:inline-block;padding:2px 8px;border-radius:12px;background:#fee2e2;color:#b91c1c;font-size:11px;font-weight:600;">○ Live Offline</span>`

      const batteryHtml =
        batVal !== null
          ? `<p style="margin:3px 0 0;font-size:12px;color:#4b5563;">🔋 Battery: <strong>${batVal}%</strong></p>`
          : ''

      const statusHtml =
        emp.is_moving !== undefined && emp.is_moving !== null
          ? `<p style="margin:3px 0 0;font-size:12px;color:#4b5563;">Status: <strong>${emp.is_moving ? '🟢 Moving' : '🔴 Stationary'}</strong></p>`
          : ''

      const addressHtml = emp.last_geo_address
        ? `<p style="margin:4px 0 0;font-size:11px;color:#6b7280;max-width:230px;line-height:1.3;">📍 ${emp.last_geo_address}</p>`
        : ''

      const infoContent = `
        <div style="padding:10px 12px;min-width:210px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <div style="margin-bottom:6px;">${trackingBadge}</div>
          <h3 style="margin:0 0 2px;font-size:14px;font-weight:700;color:#111827;">${fullName}</h3>
          ${emp.title ? `<p style="margin:0 0 4px;font-size:11px;color:#6b7280;font-weight:500;">${emp.title}</p>` : ''}
          <p style="margin:2px 0 0;font-size:12px;color:#4b5563;">Last seen: <strong>${lastSeenText}</strong></p>
          ${batteryHtml}
          ${statusHtml}
          ${addressHtml}
          <button onclick="window.liveTrackingNavigate('${emp.id}')" style="margin-top:10px;padding:6px 12px;background:#10b981;color:#ffffff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;width:100%;transition:background 0.2s;">
            View Staff Profile
          </button>
        </div>
      `

      const markerIcon = await createMarkerIcon(emp.avatar, emp.id, isLiveOn)

      const existing = markersRef.current[String(emp.id)]

      if (existing?.marker) {
        existing.marker.setPosition(position)
        existing.marker.setTitle(fullName)
        if (markerIcon) {
          existing.marker.setIcon({
            url: markerIcon,
            scaledSize: new window.google.maps.Size(56, 62),
            origin: new window.google.maps.Point(0, 0),
            anchor: new window.google.maps.Point(28, 31),
          })
        }
        existing.infoWindow.setContent(infoContent)
      } else {
        const marker = new window.google.maps.Marker({
          position,
          map: mapInstanceRef.current,
          title: fullName,
          ...(markerIcon && {
            icon: {
              url: markerIcon,
              scaledSize: new window.google.maps.Size(56, 62),
              origin: new window.google.maps.Point(0, 0),
              anchor: new window.google.maps.Point(28, 31),
            },
          }),
        })

        const infoWindow = new window.google.maps.InfoWindow({ content: infoContent })

        marker.addListener('click', () => {
          if (activeInfoWindowRef.current) {
            activeInfoWindowRef.current.close()
          }
          infoWindow.open(mapInstanceRef.current, marker)
          activeInfoWindowRef.current = infoWindow
          onSelectEmployee(String(emp.id))
        })

        markersRef.current[String(emp.id)] = { marker, infoWindow }
      }
    })
  }, [employees, onSelectEmployee, mapInstanceRef])

  // Center / Fly to selected employee
  useEffect(() => {
    if (!selectedEmployeeId || selectedEmployeeId === 'all' || !mapInstanceRef.current) return

    const target = employees.find((e) => String(e.id) === String(selectedEmployeeId))
    if (!target || !target.current_lat || !target.current_long) return

    const lat = parseFloat(String(target.current_lat))
    const lng = parseFloat(String(target.current_long))
    if (isNaN(lat) || isNaN(lng)) return

    const position = { lat, lng }
    mapInstanceRef.current.panTo(position)
    mapInstanceRef.current.setZoom(15)

    const record = markersRef.current[String(target.id)]
    if (record?.marker && record?.infoWindow) {
      if (activeInfoWindowRef.current) activeInfoWindowRef.current.close()
      record.infoWindow.open(mapInstanceRef.current, record.marker)
      activeInfoWindowRef.current = record.infoWindow
    }
  }, [selectedEmployeeId, employees, mapInstanceRef])

  return (
    <div className="relative flex-1 min-h-0 h-full w-full bg-muted/20">
      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  )
}
