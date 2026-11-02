import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { GoogleMap, Marker, Circle, useJsApiLoader } from '@react-google-maps/api'
import {
  MapPin,
  Crosshair,
  Users,
  Search,
  X,
  Minimize2,
  Maximize2,
  Loader2,
  Save,
  Layers,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Combobox,
  ComboboxChips,
  ComboboxValue,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
  useComboboxAnchor,
} from '@/components/ui/combobox'
import { geofencingApi } from '../api/geofencingApi'
import { useEmployeesQuery } from '@/features/employees/hooks/useEmployees'
import type { Employee } from '@/lib/employees'
import { useCategoriesQuery } from '@/features/categories/hooks/useCategories'
import type { GeofenceCategoryAssignment } from '../api/geofencingApi.types'
import { getCurrentBrowserCoordinates } from '@/features/attendance/hooks/useAttendance'
import LocationPermissionModal from '@/components/common/LocationPermissionModal'
import { sound } from '@/lib/sound'
import { toast } from 'sonner'

const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAP_KEY as string | undefined) ||
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
  ''

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' }
const DEFAULT_CENTER = { lat: 23.914586, lng: 85.143298 }
const MAP_OPTIONS: google.maps.MapOptions = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  clickableIcons: false,
}

type TabType = 'general' | 'assignments'

export interface CategoryRuleRow {
  category_id: string
  sub_category_ids: string[]
}

// Subcategory Multi-select Combobox (Matching Shift Form Modal style)
function SubcategoryCombobox({
  subcategories,
  value,
  onChange,
}: {
  subcategories: any[]
  value: string[]
  onChange: (val: string[]) => void
}) {
  const anchor = useComboboxAnchor()
  const items = subcategories.map((s) => s.subcategory_id || (s as any).id)

  return (
    <Combobox
      multiple
      autoHighlight
      items={items}
      value={value}
      onValueChange={(nextVal) => onChange((nextVal || []) as string[])}
    >
      <ComboboxChips ref={anchor} className="min-h-9 text-xs bg-card w-full rounded-md border border-input px-2 py-1">
        <ComboboxValue>
          {(values: string[]) => (
            <>
              {(values || []).map((subId: string) => {
                const subObj = subcategories.find(
                  (s) => (s.subcategory_id || (s as any).id) === subId
                )
                return (
                  <ComboboxChip key={subId} className="text-xs bg-primary/10 text-primary border border-primary/20">
                    {subObj?.subcategory_name || subId}
                  </ComboboxChip>
                )
              })}
              <ComboboxChipsInput
                placeholder={value.length === 0 ? 'Select subcategories…' : ''}
                className="text-xs"
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor} side="bottom" align="start" className="z-50 max-h-48">
        <ComboboxEmpty className="text-xs p-2 text-muted-foreground">No subcategory found.</ComboboxEmpty>
        <ComboboxList>
          {(subId: string) => {
            const subObj = subcategories.find(
              (s) => (s.subcategory_id || (s as any).id) === subId
            )
            return (
              <ComboboxItem
                key={subId}
                value={subId}
                className="text-xs cursor-pointer font-medium"
              >
                {subObj?.subcategory_name || subId}
              </ComboboxItem>
            )
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export default function CreateGeofencePage() {
  const navigate = useNavigate()
  const { id: editId } = useParams<{ id?: string }>()

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  })

  const mapRef = useRef<google.maps.Map | null>(null)

  // React Query hooks matching Shift Modal
  const { data: rawEmployees = [], isLoading: loadingEmployees } = useEmployeesQuery()
  const employees: Employee[] = useMemo(
    () =>
      rawEmployees.filter((e: Employee) => {
        const st = (e.status || '').toLowerCase()
        return st !== 'archived' && st !== 'suspended'
      }),
    [rawEmployees],
  )
  const { data: categories = [] } = useCategoriesQuery()

  // Form & Tab states
  const [activeTab, setActiveTab] = useState<TabType>('general')
  const [geoName, setGeoName] = useState('')
  const [geoAddress, setGeoAddress] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [radius, setRadius] = useState<number>(100)
  const [status] = useState<'active' | 'inactive'>('active')
  const [locationMode, setLocationMode] = useState<string>('current')

  // Assignments state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [categoryRules, setCategoryRules] = useState<CategoryRuleRow[]>([])
  const [userSearch, setUserSearch] = useState('')

  // UI state
  const [minimized, setMinimized] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If editing an existing geofence, fetch its details
  useEffect(() => {
    if (!editId) return
    let active = true

    const applyGeofenceData = (g: any) => {
      if (!g) return
      setGeoName(g.geo_fence_name || g.name || '')
      setGeoAddress(g.geo_fence_address || g.address || '')
      const gLat = Number(g.geo_lat || g.latitude || DEFAULT_CENTER.lat)
      const gLng = Number(g.geo_long || g.longitude || DEFAULT_CENTER.lng)
      setLat(gLat)
      setLng(gLng)
      setRadius(Number(g.radius) || 100)
      setIsLocationFetched(true)

      if (mapRef.current) {
        mapRef.current.panTo({ lat: gLat, lng: gLng })
        mapRef.current.setZoom(16)
      }

      if (Array.isArray(g.applicable_user)) {
        setSelectedUserIds(g.applicable_user.map(String))
      } else if (Array.isArray(g.users)) {
        setSelectedUserIds(g.users.map((u: any) => String(u.id || u.user_id || u)))
      }

      if (Array.isArray(g.applicable_categories_for)) {
        const rules: CategoryRuleRow[] = g.applicable_categories_for
          .map((item: any) => ({
            category_id: String(item.category_id || item.id || ''),
            sub_category_ids: Array.isArray(item.sub_category_id)
              ? item.sub_category_id.map(String)
              : Array.isArray(item.sub_categories)
              ? item.sub_categories.map(String)
              : [],
          }))
          .filter((r: CategoryRuleRow) => Boolean(r.category_id))
        setCategoryRules(rules)
      }
    }

    geofencingApi
      .getGeofenceById(editId)
      .then((res: any) => {
        if (!active) return
        const g = res?.data?.data || res?.data || res
        if (g && (g.geo_fence_name || g.name || g.geo_lat)) {
          applyGeofenceData(g)
        } else {
          geofencingApi.getGeofences().then((listRes: any) => {
            if (!active) return
            const list = Array.isArray(listRes?.data) ? listRes.data : Array.isArray(listRes) ? listRes : []
            const found = list.find((item: any) => (item.geo_fence_id || item.id) === editId)
            if (found) applyGeofenceData(found)
          })
        }
      })
      .catch(() => {
        if (!active) return
        geofencingApi
          .getGeofences()
          .then((listRes: any) => {
            if (!active) return
            const list = Array.isArray(listRes?.data) ? listRes.data : Array.isArray(listRes) ? listRes : []
            const found = list.find((item: any) => (item.geo_fence_id || item.id) === editId)
            if (found) {
              applyGeofenceData(found)
            } else {
              setError('Failed to load geofence details')
            }
          })
          .catch((err) => {
            setError(err?.message || 'Failed to load geofence details')
          })
      })

    return () => {
      active = false
    }
  }, [editId])

  const [isLocationFetching, setIsLocationFetching] = useState(false)
  const [isLocationFetched, setIsLocationFetched] = useState(false)
  const [locationModalOpen, setLocationModalOpen] = useState(false)

  // Get current device geolocation with desktop & mobile support and alert modal
  const handleGetCurrentLocation = useCallback(async (showSuccessToast = false) => {
    setIsLocationFetching(true)
    setError(null)

    const res = await getCurrentBrowserCoordinates()
    setIsLocationFetching(false)

    if (res.latitude !== null && res.longitude !== null) {
      setLat(res.latitude)
      setLng(res.longitude)
      setError(null)
      setIsLocationFetched(true)
      if (showSuccessToast) {
        toast.success(`Location detected successfully! (${res.latitude}, ${res.longitude})`)
      }
      if (mapRef.current) {
        mapRef.current.panTo({ lat: res.latitude, lng: res.longitude })
        mapRef.current.setZoom(16)
      }
    } else {
      setIsLocationFetched(false)
      const msg =
        res.errorCode === 1
          ? 'Location permission is denied! Please allow location permissions in browser settings.'
          : res.errorCode === 2
          ? 'Device/Windows location is unavailable or OFF.'
          : res.error || 'Unable to retrieve location.'
      setError(msg)
      if (showSuccessToast) {
        toast.error(msg, { duration: 5000 })
        sound.error()
        // Open alert troubleshooting modal so user can click to enable
        setLocationModalOpen(true)
      }
    }
  }, [])

  useEffect(() => {
    if (locationMode === 'current' && !editId) {
      handleGetCurrentLocation(false)
    }
  }, [locationMode, handleGetCurrentLocation, editId])

  const [mapSearchQuery, setMapSearchQuery] = useState('')
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)

  // Search Location on map handler
  const handleSearchLocation = useCallback(() => {
    const query = mapSearchQuery.trim()
    if (!query) {
      toast.info('Please enter a location name or address to search.')
      return
    }

    setIsSearchingLocation(true)

    // Try Google Geocoding API if available on Google Maps instance
    if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
      try {
        const geocoder = new (window as any).google.maps.Geocoder()
        geocoder.geocode({ address: query }, (results: any, status: any) => {
          setIsSearchingLocation(false)
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location
            const sLat = Number(loc.lat().toFixed(6))
            const sLng = Number(loc.lng().toFixed(6))
            setLat(sLat)
            setLng(sLng)
            setGeoAddress((prev) => prev || results[0].formatted_address || query)
            if (mapRef.current) {
              mapRef.current.panTo({ lat: sLat, lng: sLng })
              mapRef.current.setZoom(16)
            }
            toast.success(`Location found: ${results[0].formatted_address}`)
            sound.success()
          } else {
            toast.info(`Search location: "${query}". (Google Geocoding API integration ready)`)
          }
        })
        return
      } catch (err) {
        console.warn('Geocoder error:', err)
      }
    }

    setIsSearchingLocation(false)
    toast.info(`Search location for "${query}" recorded. (API integration pending)`)
  }, [mapSearchQuery])

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const clickedLat = Number(e.latLng.lat().toFixed(6))
      const clickedLng = Number(e.latLng.lng().toFixed(6))
      setLat(clickedLat)
      setLng(clickedLng)
      setIsLocationFetched(true)
    }
  }, [])

  const onMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setLat(Number(e.latLng.lat().toFixed(6)))
      setLng(Number(e.latLng.lng().toFixed(6)))
      setIsLocationFetched(true)
    }
  }, [])

  // Employee Selection (matching Shift Modal)
  const toggleUser = (empId: string) => {
    if (!empId) return
    setSelectedUserIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    )
  }

  const toggleAllUsers = () => {
    if (selectedUserIds.length === employees.length) {
      setSelectedUserIds([])
    } else {
      setSelectedUserIds(employees.map((e) => e.id || (e as any).employee_id || (e as any).user_id).filter(Boolean))
    }
  }

  const filteredEmployees = employees.filter((emp) => {
    if (!userSearch.trim()) return true
    const search = userSearch.toLowerCase()
    return (
      (emp.name || '').toLowerCase().includes(search) ||
      (emp.phone || '').toLowerCase().includes(search) ||
      (emp.department || '').toLowerCase().includes(search)
    )
  })

  // Category Rules handlers (matching Shift Modal)
  const addCategoryRow = () => {
    const firstCat = categories[0]?.category_id || (categories[0] as any)?.id || ''
    setCategoryRules((prev) => [...prev, { category_id: firstCat, sub_category_ids: [] }])
  }

  const handleCategoryChange = (idx: number, catId: string) => {
    setCategoryRules((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, category_id: catId, sub_category_ids: [] } : r))
    )
  }

  const handleSubcategoriesChange = (idx: number, subIds: string[]) => {
    setCategoryRules((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, sub_category_ids: subIds } : r))
    )
  }

  const removeCategoryRow = (idx: number) => {
    setCategoryRules((prev) => prev.filter((_, i) => i !== idx))
  }

  // Submit Handler
  const handleSave = async () => {
    if (!geoName.trim()) {
      setError('Please enter a Geofence Name')
      setActiveTab('general')
      return
    }

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      const msg =
        locationMode === 'current'
          ? 'Device location is required. Please turn ON device GPS and click "Fetch", or switch to "Pick on Map".'
          : 'Please select a location on the map.'
      toast.error(msg, { duration: 5000 })
      setError(msg)
      sound.error()
      setActiveTab('general')
      return
    }

    setSubmitting(true)
    setError(null)

    const applicableCategories: GeofenceCategoryAssignment[] = categoryRules
      .filter((r) => r.category_id)
      .map((r) => ({
        category_id: r.category_id,
        sub_category_id: r.sub_category_ids && r.sub_category_ids.length > 0 ? r.sub_category_ids : [],
      }))

    const payload = {
      geo_fence_name: geoName.trim(),
      geo_fence_address: geoAddress.trim() || `${lat}, ${lng}`,
      geo_lat: Number(lat),
      geo_long: Number(lng),
      radius: Number(radius) || 100,
      status,
      applicable_user: selectedUserIds,
      applicable_categories_for: applicableCategories,
    }

    // ── Log payload directly to browser console ──
    console.log(
      '%c=== GEOFENCE SUBMISSION PAYLOAD ===',
      'color: #2f63d8; font-weight: bold; font-size: 14px;'
    )
    console.log(JSON.stringify(payload, null, 2))
    console.log('Payload Object:', payload)

    try {
      if (editId) {
        const updatePayload = {
          ...payload,
          geo_fence_id: editId,
          id: editId,
        }
        const res: any = await geofencingApi.updateGeofence(updatePayload)
        if (res && res.success === false) {
          throw new Error(res.message || 'Failed to update geofence')
        }
        toast.success(res?.message || 'Geofence updated successfully!')
      } else {
        const res: any = await geofencingApi.createGeofence(payload)
        if (res && res.success === false) {
          throw new Error(res.message || 'Failed to create geofence')
        }
        toast.success(res?.message || 'Geofence created successfully!')
      }
      sound.success()
      if (window.opener) {
        try {
          window.opener.postMessage('geofence_updated', '*')
        } catch {}
      }
      navigate('/admin/settings?section=geofencing')
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save geofence'
      console.error('Geofence save error:', err)
      toast.error(msg)
      setError(msg)
      sound.error()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex flex-1 min-h-0 min-w-0 h-full w-full flex-col overflow-hidden bg-background rounded-xl border border-border">
      {/* Top Navigation Bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Crosshair className="size-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">
              {editId ? 'Edit Geofence' : 'Configure New Geofence'}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Set geographic boundary & assign employee access rules
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {error && <span className="text-[12px] font-medium text-destructive mr-2">{error}</span>}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/settings?section=geofencing')}
          >
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={submitting}
            onClick={handleSave}
            className="btn-3d"
          >
            {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            <span>Confirm Location</span>
          </Button>
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div className="relative flex-1 overflow-hidden">
        {!GOOGLE_MAPS_API_KEY ? (
          <div className="grid size-full place-items-center bg-muted/30 p-8 text-center">
            <div className="max-w-sm text-[13px] text-muted-foreground">
              <MapPin className="mx-auto mb-2 size-6 text-muted-foreground/70" />
              Set <code className="rounded bg-muted px-1 py-0.5">VITE_GOOGLE_MAP_KEY</code> to use map picker.
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
            center={{ lat: lat ?? DEFAULT_CENTER.lat, lng: lng ?? DEFAULT_CENTER.lng }}
            zoom={lat && lng ? 16 : 14}
            options={MAP_OPTIONS}
            onClick={onMapClick}
            onLoad={(map) => {
              mapRef.current = map
            }}
          >
            {lat !== null && lng !== null && (
              <>
                <Marker position={{ lat, lng }} draggable onDragEnd={onMarkerDragEnd} />
                <Circle
                  center={{ lat, lng }}
                  radius={Number(radius) || 100}
                  options={{
                    strokeColor: '#2f63d8',
                    strokeOpacity: 0.9,
                    strokeWeight: 2,
                    fillColor: '#2f63d8',
                    fillOpacity: 0.2,
                  }}
                />
              </>
            )}
          </GoogleMap>
        )}

        {/* Floating search bar on map when in Pick on Map mode and minimized */}
        {minimized && locationMode === 'map' && (
          <div className="absolute top-4 left-4 z-30 flex items-center gap-2 bg-card/95 backdrop-blur-md p-1.5 rounded-xl border border-border shadow-xl max-w-sm w-full animate-in fade-in duration-200">
            <div className="relative flex-1">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search location on map..."
                value={mapSearchQuery}
                onChange={(e) => setMapSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearchLocation()
                  }
                }}
                className="w-full bg-transparent pl-8 pr-7 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {mapSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMapSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
            <Button
              type="button"
              size="xs"
              disabled={isSearchingLocation}
              onClick={handleSearchLocation}
              className="h-7 px-2.5 text-xs gap-1"
            >
              {isSearchingLocation ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Search className="size-3" />
              )}
              <span>Find</span>
            </Button>
          </div>
        )}

        {/* ── MINIMIZED CONFIG MODE WIDGET ── */}
        {minimized ? (
          <div className="absolute right-6 bottom-6 z-30 w-80 rounded-2xl border border-border bg-card p-4 shadow-2xl backdrop-blur-md transition-all">
            <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Crosshair className="size-4" />
                <span>Config Mode</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setMinimized(false)}
                title="Expand Form"
              >
                <Maximize2 className="size-3.5" />
              </Button>
            </div>

            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between text-muted-foreground">
                <span>LAT: <strong className="text-foreground tabular-nums">{lat !== null ? lat : '—'}</strong></span>
                <span>LNG: <strong className="text-foreground tabular-nums">{lng !== null ? lng : '—'}</strong></span>
              </div>
              <div>
                <Label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  RADIUS (M):
                </Label>
                <Input
                  type="number"
                  value={radius}
                  onChange={(e) => setRadius(Math.max(10, Number(e.target.value) || 0))}
                  className="h-8 text-[12px]"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setMinimized(false)}
              >
                Expand
              </Button>
              <Button
                type="button"
                size="xs"
                disabled={submitting}
                onClick={handleSave}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          /* ── TABBED FORM PANEL OVERLAY (Matching Shift Modal design) ── */
          <div className="absolute inset-x-4 sm:inset-x-6 top-4 sm:top-6 bottom-4 sm:bottom-6 z-30 mx-auto max-w-3xl flex flex-col rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur-md transition-all overflow-hidden">
            {/* Header & Controls */}
            <div className="flex items-center justify-between border-b border-border p-4 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary">
                  <Crosshair className="size-4" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">
                  {editId ? 'Edit Geofence Parameters' : 'Configure New Geofence'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setMinimized(true)}
                >
                  <Minimize2 className="size-3" />
                  <span>Minimize Form</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => navigate('/admin/settings?section=geofencing')}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* TAB SYSTEM NAVIGATION (Matching Shift Modal tabs) */}
            <div className="flex border-b border-border text-xs font-medium px-4 shrink-0 bg-muted/20">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 border-b-2 font-medium transition-colors cursor-pointer',
                  activeTab === 'general'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Crosshair className="size-3.5" />
                <span>General &amp; Location</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('assignments')}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 border-b-2 font-medium transition-colors cursor-pointer',
                  activeTab === 'assignments'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Users className="size-3.5" />
                <span>Assignments ({selectedUserIds.length + categoryRules.length})</span>
              </button>
            </div>

            {/* SCROLLABLE TAB CONTENT BODY */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 min-h-0 space-y-4">
              {/* TAB 1: GENERAL & LOCATION */}
              {activeTab === 'general' && (
                <div className="space-y-4 py-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-1 block text-xs font-semibold text-foreground">
                        Location Mode
                      </Label>
                      <div className="flex gap-2">
                        <select
                          value={locationMode}
                          onChange={(e) => {
                            const val = e.target.value
                            setLocationMode(val)
                            if (val === 'current') handleGetCurrentLocation(true)
                          }}
                          className="h-9 w-full rounded-md border border-input bg-card px-2.5 text-xs text-foreground outline-none focus:border-ring"
                        >
                          <option value="current">Current Location (GPS Mandatory)</option>
                          <option value="map">Pick on Map (Click Pin)</option>
                        </select>
                        {locationMode === 'current' && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isLocationFetching}
                            onClick={() => handleGetCurrentLocation(true)}
                            className="h-9 shrink-0 gap-1 text-xs px-2.5"
                            title="Fetch GPS Location"
                          >
                            {isLocationFetching ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Crosshair className="size-3.5" />
                            )}
                            <span>{isLocationFetched ? 'Re-fetch' : 'Fetch'}</span>
                          </Button>
                        )}
                      </div>
                      {locationMode === 'current' && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                          {isLocationFetching ? (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Loader2 className="size-3 animate-spin" /> Detecting device location...
                            </span>
                          ) : isLocationFetched && lat !== null && lng !== null ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 className="size-3" /> GPS Location acquired ({lat}, {lng})
                            </span>
                          ) : (
                            <span className="text-destructive font-medium flex items-center gap-1">
                              <AlertCircle className="size-3" /> Location is OFF or not detected. Please turn ON GPS &amp; click &quot;Fetch&quot; or use &quot;Pick on Map&quot;.
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label className="mb-1 block text-xs font-semibold text-foreground">
                        Geofence Radius (meters) *
                      </Label>
                      <Input
                        type="number"
                        min={10}
                        value={radius}
                        onChange={(e) => setRadius(Math.max(10, Number(e.target.value) || 0))}
                        className="text-xs h-9"
                      />
                    </div>
                  </div>

                  {/* Search Location on Map when Pick on Map mode is selected */}
                  {locationMode === 'map' && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Search className="size-3.5 text-primary" />
                          <span>Search Location on Map</span>
                        </Label>
                        <span className="text-[10px] text-muted-foreground bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                          Search Area
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="text"
                            placeholder="Search city, street, landmark, business or address..."
                            value={mapSearchQuery}
                            onChange={(e) => setMapSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleSearchLocation()
                              }
                            }}
                            className="text-xs h-9 pl-8 bg-card"
                          />
                          {mapSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setMapSearchQuery('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <X className="size-3.5" />
                            </button>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isSearchingLocation}
                          onClick={handleSearchLocation}
                          className="h-9 shrink-0 gap-1.5 text-xs px-3.5 btn-3d"
                        >
                          {isSearchingLocation ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Search className="size-3.5" />
                          )}
                          <span>Search</span>
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Type an address or click &amp; drag the map marker to set your geofence center.
                      </p>
                    </div>
                  )}

                  <div>
                    <Label className="mb-1 block text-xs font-semibold text-foreground">
                      Geofence Name *
                    </Label>
                    <Input
                      type="text"
                      placeholder="e.g. Corporate HQ, Main Office"
                      value={geoName}
                      onChange={(e) => setGeoName(e.target.value)}
                      className="text-xs h-9"
                    />
                  </div>

                  <div>
                    <Label className="mb-1 block text-xs font-semibold text-foreground">
                      Address / Description
                    </Label>
                    <Input
                      type="text"
                      placeholder="789 HQ Towers, Tech District"
                      value={geoAddress}
                      onChange={(e) => setGeoAddress(e.target.value)}
                      className="text-xs h-9"
                    />
                  </div>

                  <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground flex justify-between">
                    <span>LAT: <strong className="font-mono text-foreground">{lat}</strong></span>
                    <span>LNG: <strong className="font-mono text-foreground">{lng}</strong></span>
                  </div>
                </div>
              )}

              {/* TAB 2: ASSIGNMENTS (Matching Shift Modal Assignments Tab) */}
              {activeTab === 'assignments' && (
                <div className="space-y-6 py-1">
                  {/* Employee Direct Assignment */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-semibold text-foreground">Target Employees</h3>
                        <p className="text-[11px] text-muted-foreground">
                          Select users to directly assign to this geofence
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={toggleAllUsers}
                        className="text-xs h-auto p-0"
                      >
                        {selectedUserIds.length === employees.length ? 'Deselect All' : 'Select All'}
                      </Button>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search employees by name, phone or department…"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="text-xs pl-8 h-9"
                      />
                    </div>

                    <div className="max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border bg-card shadow-inner">
                      {loadingEmployees ? (
                        <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                          <Loader2 className="size-3.5 animate-spin text-primary" /> Loading employees…
                        </div>
                      ) : filteredEmployees.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">No employees found.</div>
                      ) : (
                        filteredEmployees.map((emp) => {
                          const empId = emp.id || (emp as any).employee_id || (emp as any).user_id
                          const isSelected = selectedUserIds.some((su) => {
                            const suStr = String(su).trim()
                            const targetId = String(empId).trim()
                            const empUserId = emp.rawUser?.user_id ? String(emp.rawUser.user_id).trim() : ''
                            const empUfid = emp.rawUser?.ufid ? String(emp.rawUser.ufid).trim() : ''
                            return suStr && (suStr === targetId || (empUserId && suStr === empUserId) || (empUfid && suStr === empUfid))
                          })

                          return (
                            <label
                              key={empId || emp.name}
                              className="flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/40 cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleUser(empId)}
                                  className="border-[#c4c8d1] data-[state=checked]:bg-[#2F63D8] data-[state=checked]:border-[#2F63D8]"
                                />
                                <div>
                                  <span className="font-medium text-foreground">{emp.name}</span>
                                </div>
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {emp.phone || emp.department || emp.empCode || '-'}
                              </span>
                            </label>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {/* Category & Subcategory Assignment */}
                  <div className="space-y-3 border-t border-border pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Layers className="size-3.5 text-primary" />
                          Target Categories &amp; Subcategories
                        </h3>
                        <p className="text-[11px] text-muted-foreground">
                          Assign geofence based on employee category rules
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={addCategoryRow}
                        className="text-xs h-auto p-0 gap-1"
                      >
                        <Plus className="size-3" /> Add Category Rule
                      </Button>
                    </div>

                    {categoryRules.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                        No category rules defined for this geofence. Click "+ Add Category Rule" to specify.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {categoryRules.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2 rounded-xl border border-border p-2.5 bg-muted/20">
                            <Select
                              value={item.category_id}
                              onValueChange={(val) => handleCategoryChange(idx, val)}
                            >
                              <SelectTrigger className="w-44 shrink-0 text-xs h-9 bg-card">
                                <SelectValue placeholder="Select Category" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((c) => (
                                  <SelectItem
                                    key={c.category_id || (c as any).id}
                                    value={c.category_id || (c as any).id}
                                  >
                                    {c.category_name || (c as any).name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <div className="flex-1 min-w-0">
                              <SubcategoryCombobox
                                subcategories={
                                  categories.find(
                                    (c) => (c.category_id || (c as any).id) === item.category_id
                                  )?.subCategoryName || []
                                }
                                value={item.sub_category_ids}
                                onChange={(val) => handleSubcategoriesChange(idx, val)}
                              />
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeCategoryRow(idx)}
                              className="size-9 shrink-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Fixed Footer with Action Buttons */}
            <div className="flex items-center justify-end gap-2 border-t border-border p-3 px-5 bg-card/90 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/settings?section=geofencing')}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={submitting}
                onClick={handleSave}
                className="btn-3d text-xs h-9"
              >
                {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                <span>Confirm Location</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Troubleshooting & Location Activation Modal */}
      <LocationPermissionModal
        open={locationModalOpen}
        onOpenChange={setLocationModalOpen}
        title="Enable Device Location"
        description="Current Location mode requires your desktop/device location to establish geofence boundaries."
        actionLabel="Verify & Acquire Location"
        onLocationObtained={(coords) => {
          setLat(coords.latitude)
          setLng(coords.longitude)
          setIsLocationFetched(true)
          setError(null)
          if (mapRef.current) {
            mapRef.current.panTo({ lat: coords.latitude, lng: coords.longitude })
            mapRef.current.setZoom(16)
          }
        }}
      />
    </div>
  )
}
