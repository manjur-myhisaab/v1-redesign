import { useState, useEffect, useRef } from 'react'
import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api'
import {
  Play,
  Pause,
  RotateCcw,
  MapPin,
  Clock,
  Compass,
  Loader2,
  Gauge,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import Panel from '@/components/admin/Panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getEmployeeJourney, type EmployeeJourney, type JourneyPoint } from '@/lib/api'
import rdk, { readItems } from '@/services/server'

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAP_KEY as string | undefined) ?? ''
const DEFAULT_CENTER = { lat: 26.8535, lng: 75.8235 }

interface EmployeeItem {
  id: string
  first_name: string
  last_name: string
}

const formatPointTime = (p?: JourneyPoint) => {
  if (!p?.recordedAt) return '—'
  const d = new Date(p.recordedAt)
  return isNaN(d.getTime())
    ? p.recordedAt
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function LiveTrackingTimeline() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-timeline',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  })

  const today = new Date().toISOString().slice(0, 10)
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedEmpId, setSelectedEmpId] = useState('')
  const [journey, setJourney] = useState<EmployeeJourney | null>(null)
  const [scrubIndex, setScrubIndex] = useState(0)
  const [playing, setPlaying] = useState(false)

  const mapRef = useRef<google.maps.Map | null>(null)

  // Fetch employees
  const { data: employees = [] } = useQuery<EmployeeItem[]>({
    queryKey: ['employees_for_timeline'],
    queryFn: async () => {
      const res = await rdk.request(
        readItems('employees', {
          fields: ['id', 'first_name', 'last_name', 'status'],
          filter: { status: { _nin: ['archived', 'suspended'] } },
          limit: -1,
        }),
      )
      const raw = Array.isArray(res) ? (res as any[]) : []
      return raw.filter((u: any) => { const st = (u.status || '').toLowerCase(); return st !== 'archived' && st !== 'suspended'; }) as EmployeeItem[]
    },
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (employees.length > 0 && !selectedEmpId) {
      setSelectedEmpId(employees[0].id)
    }
  }, [employees, selectedEmpId])

  // Load journey data
  useEffect(() => {
    if (!selectedEmpId || !selectedDate) return
    let active = true
    setPlaying(false)
    setScrubIndex(0)

    getEmployeeJourney(selectedEmpId, selectedDate)
      .then((data) => {
        if (!active) return
        setJourney(data)
        if (data && data.points.length > 0 && mapRef.current) {
          const bounds = new window.google.maps.LatLngBounds()
          data.points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }))
          mapRef.current.fitBounds(bounds)
        }
      })
      .catch((err) => {
        console.error('Failed to load employee journey:', err)
        if (active) setJourney(null)
      })

    return () => {
      active = false
    }
  }, [selectedEmpId, selectedDate])

  // Playback timer
  useEffect(() => {
    if (!playing) return
    const n = journey?.points.length ?? 0
    if (n < 2) {
      setPlaying(false)
      return
    }

    const t = setInterval(() => {
      setScrubIndex((curr) => {
        if (curr >= n - 1) {
          setPlaying(false)
          return n - 1
        }
        return curr + 1
      })
    }, 250)

    return () => clearInterval(t)
  }, [playing, journey])

  const pathCoordinates = (journey?.points ?? []).map((p) => ({
    lat: p.lat,
    lng: p.lng,
  }))

  const currentPoint: JourneyPoint | undefined =
    journey?.points && journey.points[scrubIndex]

  const startPoint = journey?.points?.[0]
  const endPoint = journey?.points?.[journey.points.length - 1]

  return (
    <Panel className="p-4 md:p-6 flex-1 flex flex-col gap-4 overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Timeline & Playback</h1>
          <p className="text-sm text-muted-foreground">
            Replay employee routes, inspect timestamps, stops, and distance covered
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2">
          <select
            value={selectedEmpId}
            onChange={(e) => setSelectedEmpId(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-xs focus:outline-none"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.first_name} {e.last_name}
              </option>
            ))}
          </select>

          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-9 text-xs w-36"
          />
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
        {/* Map View */}
        <div className="flex-1 rounded-lg border border-border bg-card overflow-hidden relative">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={
                currentPoint
                  ? { lat: currentPoint.lat, lng: currentPoint.lng }
                  : startPoint
                    ? { lat: startPoint.lat, lng: startPoint.lng }
                    : DEFAULT_CENTER
              }
              zoom={13}
              onLoad={(map) => {
                mapRef.current = map
              }}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}
            >
              {pathCoordinates.length > 0 && (
                <Polyline
                  path={pathCoordinates}
                  options={{
                    strokeColor: '#2563eb',
                    strokeOpacity: 0.8,
                    strokeWeight: 4,
                  }}
                />
              )}

              {startPoint && (
                <Marker
                  position={{ lat: startPoint.lat, lng: startPoint.lng }}
                  title="Journey Start"
                />
              )}

              {endPoint && (
                <Marker
                  position={{ lat: endPoint.lat, lng: endPoint.lng }}
                  title="Journey End"
                />
              )}

              {currentPoint && (
                <Marker
                  position={{ lat: currentPoint.lat, lng: currentPoint.lng }}
                  title={`Live Playhead (${formatPointTime(currentPoint)})`}
                />
              )}
            </GoogleMap>
          ) : (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Floating Playback Controls */}
          {journey && journey.points.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur-md rounded-xl border border-border p-3 shadow-lg flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-3.5 text-primary" />
                  Time: <strong className="text-foreground">{formatPointTime(currentPoint)}</strong>
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Gauge className="size-3.5 text-emerald-600" />
                  Total Distance: <strong className="text-foreground">{journey.distanceKm.toFixed(2)} km</strong>
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8 cursor-pointer"
                  onClick={() => setPlaying(!playing)}
                >
                  {playing ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 cursor-pointer text-muted-foreground"
                  onClick={() => {
                    setPlaying(false)
                    setScrubIndex(0)
                  }}
                >
                  <RotateCcw className="size-3.5" />
                </Button>

                <input
                  type="range"
                  min="0"
                  max={journey.points.length - 1}
                  value={scrubIndex}
                  onChange={(e) => {
                    setPlaying(false)
                    setScrubIndex(Number(e.target.value))
                  }}
                  className="flex-1 accent-primary h-1.5 bg-muted rounded cursor-pointer"
                />

                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {scrubIndex + 1}/{journey.points.length}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Summary & Waypoints */}
        <div className="w-full lg:w-72 rounded-lg border border-border bg-card p-4 flex flex-col gap-3 overflow-hidden">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Compass className="size-4 text-primary" />
            Route Summary
          </h2>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-border p-2">
              <span className="text-muted-foreground block mb-0.5">Start Time</span>
              <span className="font-semibold text-foreground">
                {formatPointTime(startPoint)}
              </span>
            </div>
            <div className="rounded border border-border p-2">
              <span className="text-muted-foreground block mb-0.5">End Time</span>
              <span className="font-semibold text-foreground">
                {formatPointTime(endPoint)}
              </span>
            </div>
          </div>

          <div className="rounded border border-border p-2.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Distance Recorded</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {journey ? `${journey.distanceKm.toFixed(2)} km` : '0.00 km'}
            </span>
          </div>

          <div className="border-t border-border pt-2 flex flex-col flex-1 overflow-hidden">
            <span className="text-xs font-semibold text-muted-foreground mb-2">
              Waypoints ({journey?.points.length || 0})
            </span>
            <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1 text-xs">
              {journey?.points.map((pt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPlaying(false)
                    setScrubIndex(idx)
                  }}
                  className={`flex items-center justify-between p-2 rounded text-left transition-colors cursor-pointer ${
                    scrubIndex === idx
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3" />
                    Point {idx + 1}
                  </span>
                  <span className="tabular-nums">{formatPointTime(pt)}</span>
                </button>
              ))}
              {(!journey || journey.points.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No tracking breadcrumbs for this date
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  )
}
