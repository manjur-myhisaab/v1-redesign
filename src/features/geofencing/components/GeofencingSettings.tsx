import { useState, useCallback, useRef, useEffect } from 'react'
import { GoogleMap, Marker, Circle, useJsApiLoader } from '@react-google-maps/api'
import { MapPin, Loader2, Power } from 'lucide-react'
import { useGeofencing } from '../hooks/useGeofencing'
import GeofenceListTable from './GeofenceListTable'
import { useShell } from '@/components/admin/shell-context'
import type { Geofence } from '../api/geofencingApi.types'

const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAP_KEY as string | undefined) ||
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
  ''

const DEFAULT_CENTER = { lat: 23.04, lng: 72.59 } // Default center
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' }
const MAP_OPTIONS: google.maps.MapOptions = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
}

export default function GeofencingSettings() {
  const { openTab } = useShell()
  const { enabled, setEnabled, geofences, loading, refresh, deleteGeofence } = useGeofencing()
  const [selectedGeofence, setSelectedGeofence] = useState<Geofence | null>(null)

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  })

  const mapRef = useRef<google.maps.Map | null>(null)

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
  }, [])

  const onMapUnmount = useCallback(() => {
    mapRef.current = null
  }, [])

  // Auto-fit map to geofences when loaded
  useEffect(() => {
    if (!mapRef.current || geofences.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    geofences.forEach((g) => {
      if (g.geo_lat && g.geo_long) {
        bounds.extend({ lat: Number(g.geo_lat), lng: Number(g.geo_long) })
      }
    })
    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, 64)
    }
  }, [geofences])

  const handleSelectGeofence = (g: Geofence | null) => {
    setSelectedGeofence(g)
    if (g && mapRef.current && g.geo_lat && g.geo_long) {
      mapRef.current.panTo({ lat: Number(g.geo_lat), lng: Number(g.geo_long) })
      mapRef.current.setZoom(15)
    }
  }

  const handleAddNew = () => {
    openTab('/admin/create-geo-location')
  }

  const handleEdit = (g: Geofence) => {
    const id = g.geo_fence_id || g.id
    if (id) {
      openTab(`/admin/edit-geo-location/${id}`)
    } else {
      openTab('/admin/create-geo-location')
    }
  }

  const handleDelete = async (id: string) => {
    await deleteGeofence(id)
    if (selectedGeofence && (selectedGeofence.geo_fence_id === id || selectedGeofence.id === id)) {
      setSelectedGeofence(null)
    }
    refresh()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col h-full">
      {/* Top Bar Switcher */}
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={`grid size-9 place-items-center rounded-xl transition-colors ${
              enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
            }`}
          >
            <Power className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Geofencing Service</h2>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  enabled
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {enabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground">
              {enabled
                ? 'Geofence rules are active for attendance punch restrictions.'
                : 'Geofencing is currently disabled. Punch restrictions are bypassed.'}
            </p>
          </div>
        </div>

        {/* Toggle Switch Button */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            enabled ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`pointer-events-none inline-block size-5 rounded-full bg-background shadow-md ring-0 transition duration-200 ease-in-out ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Main Content Area */}
      {!enabled ? (
        <div className="grid flex-1 place-items-center bg-muted/20 p-8 text-center">
          <div className="max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
            <MapPin className="mx-auto mb-3 size-10 text-muted-foreground/60" />
            <h3 className="font-display text-base font-semibold">Geofencing Disabled</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Turn on Geofencing at the top to view active geofences on the map and manage location rules for your workspace employees.
            </p>
            <button
              type="button"
              onClick={() => setEnabled(true)}
              className="btn-3d mt-4 inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Enable Geofencing
            </button>
          </div>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {/* Map background */}
          {!GOOGLE_MAPS_API_KEY ? (
            <div className="grid size-full place-items-center bg-muted/30 p-8 text-center">
              <div className="max-w-sm text-[13px] text-muted-foreground">
                <MapPin className="mx-auto mb-2 size-6 text-muted-foreground/70" />
                Set <code className="rounded bg-muted px-1 py-0.5">VITE_GOOGLE_MAP_KEY</code> to view interactive geofence maps.
              </div>
            </div>
          ) : loadError ? (
            <div className="grid size-full place-items-center bg-muted/30 p-8 text-center">
              <div className="max-w-sm text-[13px] text-muted-foreground">
                Could not load Google Maps. Check your internet connection or API key.
              </div>
            </div>
          ) : !isLoaded ? (
            <div className="grid size-full place-items-center bg-muted/30">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={
                selectedGeofence && selectedGeofence.geo_lat && selectedGeofence.geo_long
                  ? { lat: Number(selectedGeofence.geo_lat), lng: Number(selectedGeofence.geo_long) }
                  : DEFAULT_CENTER
              }
              zoom={7}
              options={MAP_OPTIONS}
              onLoad={onMapLoad}
              onUnmount={onMapUnmount}
            >
              {geofences.map((g) => {
                const id = g.geo_fence_id || g.id || ''
                if (!g.geo_lat || !g.geo_long) return null
                const lat = Number(g.geo_lat)
                const lng = Number(g.geo_long)
                const radius = Number(g.radius) || 100
                const isSelected = selectedGeofence && (selectedGeofence.geo_fence_id === id || selectedGeofence.id === id)

                return (
                  <div key={id}>
                    <Marker
                      position={{ lat, lng }}
                      onClick={() => handleSelectGeofence(g)}
                      title={g.geo_fence_name || 'Geofence'}
                    />
                    <Circle
                      center={{ lat, lng }}
                      radius={radius}
                      options={{
                        strokeColor: isSelected ? '#10b981' : '#3b82f6',
                        strokeOpacity: 0.8,
                        strokeWeight: isSelected ? 3 : 2,
                        fillColor: isSelected ? '#10b981' : '#3b82f6',
                        fillOpacity: isSelected ? 0.25 : 0.15,
                      }}
                    />
                  </div>
                )
              })}
            </GoogleMap>
          )}

          {/* Floating Manage Geofences Overlay Card */}
          <div className="absolute inset-x-4 bottom-4 z-10 flex justify-center pointer-events-none">
            <div className="pointer-events-auto w-full max-w-4xl">
              <GeofenceListTable
                geofences={geofences}
                loading={loading}
                selectedId={selectedGeofence ? (selectedGeofence.geo_fence_id || selectedGeofence.id || null) : null}
                onSelectGeofence={handleSelectGeofence}
                onAddClick={handleAddNew}
                onEditClick={handleEdit}
                onDeleteClick={handleDelete}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
