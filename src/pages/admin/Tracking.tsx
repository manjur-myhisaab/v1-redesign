import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GoogleMap, Marker, Polyline, InfoWindow, useJsApiLoader } from '@react-google-maps/api'
import { RefreshCw, MapPin, BatteryWarning, Clock, Battery, Loader2, Route, Play, Pause } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import MetricCard from '@/components/admin/MetricCard'
import StatusBadge from '@/components/admin/StatusBadge'
import UpgradeModal from '@/components/admin/UpgradeModal'
import { EmployeeAvatar } from '@/lib/people'
import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'
import {
  getLiveTracking,
  getEmployeeJourney,
  type LiveLocation,
  type EmployeeJourney,
  type Paywall,
} from '@/lib/api'

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

const REFRESH_MS = 30_000
const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAP_KEY as string | undefined) ?? ''
const INDIA_CENTER = { lat: 22.5937, lng: 78.9629 } // geographic centre of India
const DEFAULT_ZOOM = 5
const SINGLE_MARKER_ZOOM = 14
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' }
const MAP_OPTIONS: google.maps.MapOptions = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
}

// battery → tone/color
type BatteryTone = 'green' | 'amber' | 'rose' | 'gray'
function batteryTone(pct: number | null): BatteryTone {
  if (pct == null) return 'gray'
  if (pct < 20) return 'rose'
  if (pct <= 50) return 'amber'
  return 'green'
}
const BAR_COLOR: Record<BatteryTone, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  gray: 'bg-muted-foreground/40',
}
const MARKER_COLOR: Record<BatteryTone, string> = {
  green: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  gray: '#9ca3af',
}

function markerColor(l: LiveLocation): string {
  if (l.stale) return '#9ca3af'
  return MARKER_COLOR[batteryTone(l.batteryPct)]
}

const lastSeen = (min: number) =>
  min <= 0 ? 'just now' : min === 1 ? '1 min ago' : min < 60 ? `${min} min ago` : `${Math.round(min / 60)}h ago`

export default function Tracking() {
  const { firstTabActive } = useShell()
  const { activeWorkspace } = useAuth()
  const wsId = activeWorkspace?.id

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  })

  const [locations, setLocations] = useState<LiveLocation[]>([])
  const [staleMinutes, setStaleMinutes] = useState(15)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [paywall, setPaywall] = useState<Paywall | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [journeyDate, setJourneyDate] = useState(todayISO())
  const [journey, setJourney] = useState<EmployeeJourney | null>(null)
  const [journeyLoading, setJourneyLoading] = useState(false)
  const [scrubIndex, setScrubIndex] = useState(0) // playhead position along the trail
  const [playing, setPlaying] = useState(false)

  const mapRef = useRef<google.maps.Map | null>(null)

  // Playback: advance the playhead ~6 points/sec; stop at the end.
  useEffect(() => {
    if (!playing) return
    const n = journey?.points.length ?? 0
    if (n < 2) {
      setPlaying(false)
      return
    }
    const id = setInterval(() => {
      setScrubIndex((i) => {
        if (i >= n - 1) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, 160)
    return () => clearInterval(id)
  }, [playing, journey])

  // Load the selected employee's full breadcrumb trail for the chosen day.
  useEffect(() => {
    if (!selectedId) {
      setJourney(null)
      return
    }
    let live = true
    setJourneyLoading(true)
    getEmployeeJourney(selectedId, journeyDate)
      .then((j) => {
        if (!live) return
        setJourney(j)
        setScrubIndex(Math.max(0, j.points.length - 1))
        setPlaying(false)
        const map = mapRef.current
        if (map && j.points.length > 1) {
          const bounds = new google.maps.LatLngBounds()
          j.points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }))
          map.fitBounds(bounds, 64)
        }
      })
      .catch(() => live && setJourney(null))
      .finally(() => live && setJourneyLoading(false))
    return () => {
      live = false
    }
  }, [selectedId, journeyDate])

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    else setRefreshing(true)
    try {
      const data = await getLiveTracking()
      setLocations(data.locations)
      setStaleMinutes(data.staleMinutes)
      setPaywall(null)
    } catch (err) {
      const e = err as { status?: number; payload?: { paywall?: Paywall } }
      if (e.status === 402 && e.payload?.paywall) {
        setPaywall(e.payload.paywall)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load(true)
    const id = setInterval(() => load(false), REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  // fit the map to all markers whenever the set of locations changes
  const fitToLocations = useCallback((map: google.maps.Map, locs: LiveLocation[]) => {
    if (locs.length === 0) return
    if (locs.length === 1) {
      map.setCenter({ lat: locs[0].lat, lng: locs[0].lng })
      map.setZoom(SINGLE_MARKER_ZOOM)
      return
    }
    const bounds = new google.maps.LatLngBounds()
    locs.forEach((l) => bounds.extend({ lat: l.lat, lng: l.lng }))
    map.fitBounds(bounds, 48)
  }, [])

  useEffect(() => {
    if (mapRef.current) fitToLocations(mapRef.current, locations)
  }, [locations, fitToLocations])

  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map
      fitToLocations(map, locations)
    },
    [fitToLocations, locations],
  )

  const onMapUnmount = useCallback(() => {
    mapRef.current = null
  }, [])

  // metrics
  const metrics = useMemo(() => {
    const sharing = locations.length
    const lowBattery = locations.filter((l) => l.batteryPct != null && l.batteryPct < 20).length
    const stale = locations.filter((l) => l.stale).length
    const withBattery = locations.filter((l) => l.batteryPct != null)
    const avgBattery = withBattery.length
      ? Math.round(withBattery.reduce((s, l) => s + (l.batteryPct ?? 0), 0) / withBattery.length)
      : null
    return { sharing, lowBattery, stale, avgBattery }
  }, [locations])

  const focusEmployee = (l: LiveLocation) => {
    setSelectedId(l.employeeId)
    const m = mapRef.current
    if (m) {
      m.panTo({ lat: l.lat, lng: l.lng })
      if ((m.getZoom() ?? 0) < SINGLE_MARKER_ZOOM) m.setZoom(SINGLE_MARKER_ZOOM)
    }
  }

  const selected = useMemo(
    () => locations.find((l) => l.employeeId === selectedId) ?? null,
    [locations, selectedId],
  )

  // ─── paywall gate ───
  if (paywall) {
    return (
      <div className="flex min-w-0 flex-1">
        <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div className="max-w-md">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#2f63d8]/10 text-[#2f63d8]">
                <MapPin className="size-7" />
              </div>
              <h2 className="mt-4 font-display text-xl font-semibold tracking-tight">
                Live field tracking is a Pro feature
              </h2>
              <p className="mt-2 text-[13px] text-muted-foreground">
                See where your field staff are in real time, with battery and last-seen status.
                Add a Pro seat to unlock live GPS tracking for your workspace.
              </p>
              <button
                onClick={() => setUpgradeOpen(true)}
                className="btn-3d mt-5 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <MapPin className="size-4" />
                Upgrade to Pro
              </button>
            </div>
          </div>
        </Panel>

        {upgradeOpen && wsId && (
          <UpgradeModal
            workspaceId={wsId}
            workspaceName={activeWorkspace?.name}
            paywall={paywall}
            onClose={() => setUpgradeOpen(false)}
            onSuccess={() => {
              setUpgradeOpen(false)
              load(true)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1">
      <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h1 className="font-display text-lg font-semibold tracking-tight">Field Tracking</h1>
            <p className="text-[13px] text-muted-foreground">
              Live locations of staff sharing their position · auto-refreshes every 30s
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 text-[13px] font-medium">
              <Route className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Journey</span>
              <input
                type="date"
                value={journeyDate}
                max={todayISO()}
                onChange={(e) => setJourneyDate(e.target.value || todayISO())}
                className="h-9 bg-transparent text-[13px] outline-none"
              />
            </label>
            <button
              onClick={() => load(false)}
              disabled={refreshing}
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-[13px] font-medium hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* metrics */}
        <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-border p-4 lg:grid-cols-4">
          <MetricCard label="Sharing location" value={String(metrics.sharing)} />
          <MetricCard label="Low battery (<20%)" value={String(metrics.lowBattery)} />
          <MetricCard label={`Stale (>${staleMinutes} min)`} value={String(metrics.stale)} />
          <MetricCard label="Avg battery" value={metrics.avgBattery == null ? '—' : `${metrics.avgBattery}%`} />
        </div>

        {/* map + side list */}
        <div className="flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1">
            {!GOOGLE_MAPS_API_KEY ? (
              <div className="grid size-full place-items-center bg-muted/30 p-8 text-center">
                <div className="max-w-sm text-[13px] text-muted-foreground">
                  <MapPin className="mx-auto mb-2 size-6 text-muted-foreground/70" />
                  Set <code className="rounded bg-muted px-1 py-0.5">VITE_GOOGLE_MAPS_API_KEY</code> to enable the map.
                </div>
              </div>
            ) : loadError ? (
              <div className="grid size-full place-items-center bg-muted/30 p-8 text-center">
                <div className="max-w-sm text-[13px] text-muted-foreground">
                  <MapPin className="mx-auto mb-2 size-6 text-muted-foreground/70" />
                  Could not load Google Maps. Check the API key and try again.
                </div>
              </div>
            ) : !isLoaded ? (
              <div className="grid size-full place-items-center bg-muted/30">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={INDIA_CENTER}
                zoom={DEFAULT_ZOOM}
                options={MAP_OPTIONS}
                onLoad={onMapLoad}
                onUnmount={onMapUnmount}
                onClick={() => setSelectedId(null)}
              >
                {locations.map((l) => (
                  <Marker
                    key={l.employeeId}
                    position={{ lat: l.lat, lng: l.lng }}
                    onClick={() => focusEmployee(l)}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 8,
                      fillColor: markerColor(l),
                      fillOpacity: 1,
                      strokeColor: '#fff',
                      strokeWeight: 2,
                    }}
                  />
                ))}

                {/* Selected employee's journey trail for the chosen day. */}
                {journey && journey.points.length > 1 && (
                  <>
                    <Polyline
                      path={journey.points.map((p) => ({ lat: p.lat, lng: p.lng }))}
                      options={{
                        strokeColor: '#2f63d8',
                        strokeOpacity: 0.9,
                        strokeWeight: 4,
                        geodesic: true,
                      }}
                    />
                    <Marker
                      position={{
                        lat: journey.points[0].lat,
                        lng: journey.points[0].lng,
                      }}
                      title={`Start · ${hhmm(journey.points[0].recordedAt)}`}
                      icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 6,
                        fillColor: '#10b981',
                        fillOpacity: 1,
                        strokeColor: '#fff',
                        strokeWeight: 2,
                      }}
                    />
                    <Marker
                      position={{
                        lat: journey.points[journey.points.length - 1].lat,
                        lng: journey.points[journey.points.length - 1].lng,
                      }}
                      title={`Latest · ${hhmm(journey.points[journey.points.length - 1].recordedAt)}`}
                      icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 6,
                        fillColor: '#f43f5e',
                        fillOpacity: 1,
                        strokeColor: '#fff',
                        strokeWeight: 2,
                      }}
                    />
                    {/* playhead — moves along the trail as you scrub/play */}
                    {journey.points[scrubIndex] && (
                      <Marker
                        position={{
                          lat: journey.points[scrubIndex].lat,
                          lng: journey.points[scrubIndex].lng,
                        }}
                        zIndex={1000}
                        title={hhmm(journey.points[scrubIndex].recordedAt)}
                        icon={{
                          path: google.maps.SymbolPath.CIRCLE,
                          scale: 9,
                          fillColor: '#2f63d8',
                          fillOpacity: 1,
                          strokeColor: '#fff',
                          strokeWeight: 3,
                        }}
                      />
                    )}
                  </>
                )}
                {selected && (
                  <InfoWindow
                    position={{ lat: selected.lat, lng: selected.lng }}
                    onCloseClick={() => setSelectedId(null)}
                  >
                    <div className="text-[13px]">
                      <div className="font-semibold">{selected.name || 'Unknown'}</div>
                      {selected.department && <div className="text-gray-500">{selected.department}</div>}
                      <div className="mt-1">
                        Battery: {selected.batteryPct == null ? 'unknown' : `${selected.batteryPct}%`}
                      </div>
                      <div>Last seen: {lastSeen(selected.lastSeenMinutes)}</div>
                      {selected.source === 'attendance' && (
                        <div className="text-gray-500">from attendance punch</div>
                      )}
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            )}

            {loading && (
              <div className="absolute inset-0 z-[400] grid place-items-center bg-background/60">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* journey summary chip */}
            {selected && (
              <div className="absolute left-3 top-3 z-[401] max-w-[260px] rounded-xl border border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <Route className="size-3.5 text-[#2f63d8]" />
                  {selected.name || 'Unknown'}’s journey
                </div>
                {journeyLoading ? (
                  <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Loading route…
                  </div>
                ) : journey && journey.points.length > 1 ? (
                  <div className="mt-1 text-[12px] text-muted-foreground">
                    <span className="font-medium text-foreground tabular-nums">
                      {journey.distanceKm} km
                    </span>{' '}
                    · {journey.points.length} points ·{' '}
                    {hhmm(journey.points[0].recordedAt)}–
                    {hhmm(journey.points[journey.points.length - 1].recordedAt)}
                  </div>
                ) : (
                  <div className="mt-1 text-[12px] text-muted-foreground">
                    No route recorded for this day.
                  </div>
                )}
              </div>
            )}

            {/* playback scrubber — animate the position along the day's trail */}
            {journey && journey.points.length > 1 && (
              <div className="absolute inset-x-3 bottom-3 z-[401] flex items-center gap-3 rounded-xl border border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
                <button
                  onClick={() => setPlaying((p) => !p)}
                  className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg bg-[#2f63d8] text-white transition-opacity hover:opacity-90"
                  aria-label={playing ? 'Pause' : 'Play'}
                >
                  {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={journey.points.length - 1}
                  value={scrubIndex}
                  onChange={(e) => {
                    setPlaying(false)
                    setScrubIndex(Number(e.target.value))
                  }}
                  className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[#2f63d8]"
                />
                <span className="shrink-0 text-[12px] font-medium tabular-nums text-muted-foreground">
                  {hhmm(journey.points[scrubIndex].recordedAt)}
                </span>
              </div>
            )}
          </div>

          {/* side list */}
          <div className="flex w-72 shrink-0 flex-col border-l border-border lg:w-80">
            <div className="border-b border-border px-4 py-2.5 text-[13px] font-medium">
              Field staff
              <span className="ml-1.5 text-muted-foreground">({locations.length})</span>
            </div>
            {locations.length === 0 ? (
              <div className="grid flex-1 place-items-center px-6 text-center text-[13px] text-muted-foreground">
                {loading ? 'Loading…' : 'Nobody is sharing their location right now. Field staff appear here once their mobile app reports a position.'}
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                {locations.map((l) => {
                  const tone = batteryTone(l.batteryPct)
                  return (
                    <button
                      key={l.employeeId}
                      onClick={() => focusEmployee(l)}
                      className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted"
                    >
                      <EmployeeAvatar
                        name={l.name}
                        employeeId={l.employeeId}
                        className="size-9 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium">{l.name || 'Unknown'}</span>
                          {l.stale && <StatusBadge tone="gray">Stale</StatusBadge>}
                        </div>
                        <div className="truncate text-[12px] text-muted-foreground">
                          {l.department || '—'}
                        </div>
                        {/* battery bar */}
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <Battery className="size-3.5 shrink-0 text-muted-foreground" />
                          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn('h-full rounded-full', BAR_COLOR[tone])}
                              style={{ width: `${l.batteryPct ?? 0}%` }}
                            />
                          </div>
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {l.batteryPct == null ? '—' : `${l.batteryPct}%`}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="size-3" />
                          {lastSeen(l.lastSeenMinutes)}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            {/* legend */}
            <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <BatteryWarning className="size-3 text-rose-500" /> &lt;20%
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-amber-500" /> 20-50%
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-emerald-500" /> &gt;50%
              </span>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}
