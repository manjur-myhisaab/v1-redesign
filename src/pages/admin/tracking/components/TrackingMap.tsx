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
  const markersRef = useRef<Record<string, { marker: any; infoWindow: any }>>(
    {},
  )
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
          const userPos = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }
          if (employees.length === 0) {
            map.setCenter(userPos)
          }
        },
        () => {},
        { timeout: 8000 },
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
      const fullName =
        `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Staff'
      const isLiveOn = emp.live_tracking !== false
      const lastSeenText = formatLastSeen(emp.current_last_seen)

      const rawBat = emp.battery_percentage
        ? parseFloat(String(emp.battery_percentage))
        : null
      const batVal =
        rawBat !== null
          ? rawBat > 1
            ? Math.round(rawBat)
            : Math.round(rawBat * 100)
          : null

      const trackingBadge = isLiveOn
        ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:9999px;background:#dcfce7;color:#15803d;font-size:11px;font-weight:600;"><span style="width:6px;height:6px;border-radius:50%;background:#22c55e;"></span>Live Active</span>`
        : `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:9999px;background:#f1f5f9;color:#64748b;font-size:11px;font-weight:600;"><span style="width:6px;height:6px;border-radius:50%;background:#94a3b8;"></span>Live Offline</span>`

      const batteryHtml =
        batVal !== null
          ? `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#475569;margin-top:4px;"><span>🔋 Battery:</span><strong style="color:${batVal < 20 ? '#e11d48' : batVal < 50 ? '#d97706' : '#16a34a'};">${batVal}%</strong></div>`
          : ''

      const statusHtml =
        emp.is_moving !== undefined && emp.is_moving !== null
          ? `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#475569;margin-top:3px;"><span>Movement:</span><strong>${emp.is_moving ? '🟢 Moving' : '🔴 Stationary'}</strong></div>`
          : ''

      const addressHtml = emp.last_geo_address
        ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;line-height:1.35;max-width:240px;"> ${emp.last_geo_address}</div>`
        : ''

      const infoContent = `
        <div class="font-sans" style="padding:10px 12px;min-width:220px;max-width:260px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:8px;">
            ${trackingBadge}
            <span style="font-size:10px;color:#64748b;">${lastSeenText}</span>
          </div>
          <h3 style="margin:0 0 2px;font-size:14px;font-weight:700;color:#0f172a;line-height:1.2;">${fullName}</h3>
          ${emp.title || emp.category_name ? `<p style="margin:0 0 6px;font-size:11px;color:#64748b;font-weight:500;">${emp.title || emp.category_name}</p>` : ''}
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 8px;margin:6px 0;">
            ${batteryHtml}
            ${statusHtml}
            ${addressHtml}
          </div>
          <button onclick="window.liveTrackingNavigate('${emp.id}')" class="rounded-md px-5 bg-primary text-primary-foreground hover:bg-primary/90 h-8 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs">
            View Staff Profile
          </button>
        </div>
      `

      const markerIcon = await createMarkerIcon(
        emp.avatar,
        emp.id,
        isLiveOn,
        fullName,
      )

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

        const infoWindow = new window.google.maps.InfoWindow({
          content: infoContent,
        })

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
    if (
      !selectedEmployeeId ||
      selectedEmployeeId === 'all' ||
      !mapInstanceRef.current
    )
      return

    const target = employees.find(
      (e) => String(e.id) === String(selectedEmployeeId),
    )
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
