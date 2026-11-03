import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import {
  LocateFixed,
  CircleDashed,
  Search,
  Users,
  Layers,
  ArrowLeft,
  Loader2,
  Check,
  Minimize2,
  Maximize2,
  X,
  Compass,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import rdk, {
  GOOGLE_MAP_KEY,
  readItems,
  createItem,
  updateItem,
  customEndpoint,
} from '@/services/server'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

export default function CreateGeofencePage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const circleRef = useRef<any>(null)

  const [location, setLocation] = useState({ lat: 23.16995, lng: 87.640588 })
  const [locationOption, setLocationOption] = useState<'current' | 'away'>('current')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // Multi-select categories and employees matching v1
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('')
  const [activeCategoryTab, setActiveCategoryTab] = useState('all')
  const [isModalOpen, setIsModalOpen] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)

  const { control, handleSubmit, watch, setValue, register } = useForm({
    defaultValues: {
      radius: 100,
      geo_fence_address: '',
    },
  })

  const radius = watch('radius') || 100
  const radiusRef = useRef(radius)
  useEffect(() => {
    radiusRef.current = radius
  }, [radius])

  // 1. Fetch employee categories from Directus matching v1
  const { data: employeeCategory = [] } = useQuery({
    queryKey: ['empCategory'],
    queryFn: async () => {
      const res = await rdk.request(readItems('employee_category', { limit: -1 }))
      if (Array.isArray(res)) return res
      if (Array.isArray((res as any)?.data)) return (res as any).data
      return []
    },
    staleTime: 5 * 60 * 1000,
  })

  // 2. Fetch all staff / users matching v1
  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['all-users-geofence'],
    queryFn: async () => {
      try {
        const queryParams = {
          limit: -1,
          fields: [
            'id',
            'first_name',
            'last_name',
            'other_category_ids.*',
            'supervisor_id.*',
            'employee_category_id.*',
            'designation_id.*',
            'status',
          ],
        }
        const response: any = await rdk.request(
          customEndpoint({
            path: 'users',
            method: 'GET',
            params: queryParams,
          })
        )
        return Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : []
      } catch (err) {
        console.warn('customEndpoint users failed, falling back to readItems:', err)
        const fallback = await rdk.request(readItems('directus_users', { limit: -1 }))
        return Array.isArray(fallback) ? fallback : []
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  // Normalize staff list matching v1
  const cachedStaff = useMemo(() => {
    if (!Array.isArray(allUsers)) return []
    return allUsers.map((u: any) => ({
      id: String(u.id),
      name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'No Name',
      raw_category_id: String(
        u.employee_category_id?.employee_category_id ?? u.employee_category_id ?? ''
      ),
      category: u.employee_category_id?.employee_category_name || '-',
      designation: u.designation_id?.designation_name || 'Staff',
    }))
  }, [allUsers])

  const displayedEmployees = useMemo(() => {
    return cachedStaff.filter((emp) => {
      if (activeCategoryTab !== 'all' && String(emp.raw_category_id) !== activeCategoryTab) {
        return false
      }
      if (
        employeeSearchQuery.trim() &&
        !emp.name.toLowerCase().includes(employeeSearchQuery.toLowerCase())
      ) {
        return false
      }
      return true
    })
  }, [cachedStaff, activeCategoryTab, employeeSearchQuery])

  // 3. Fetch geofence by ID when in edit mode matching v1
  const { data: geofenceById } = useQuery({
    queryKey: ['geofence-by-id', id],
    queryFn: async () => {
      if (!id) return null
      const res = await rdk.request(
        readItems('geo_fences', {
          filter: { geo_fence_id: { _eq: id } },
          fields: [
            '*',
            'employee_category_id.employee_category_employee_category_id.*',
            'employee_id.*',
          ],
        })
      )
      const list = Array.isArray(res) ? res : Array.isArray((res as any)?.data) ? (res as any).data : []
      return list.length > 0 ? list[0] : null
    },
    enabled: isEdit,
  })

  // Preload data on Edit Mode
  useEffect(() => {
    if (geofenceById) {
      const geo = geofenceById
      const lat = parseFloat(String(geo.lat ?? geo.geo_lat ?? 0))
      const lng = parseFloat(String(geo.long ?? geo.geo_long ?? 0))
      const rad = Number(geo.radius) || 100

      if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
        const loc = { lat, lng }
        setLocation(loc)
        updateMarkerAndCircle(loc, rad)
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(loc)
          mapInstanceRef.current.setZoom(16)
        }
      }

      setValue('radius', rad)
      setValue('geo_fence_address', geo.geo_fence_address || '')

      // Map saved categories matching v1
      const savedCats = Array.isArray(geo.employee_category_id)
        ? geo.employee_category_id
            .map(
              (cat: any) =>
                cat.employee_category_employee_category_id?.employee_category_id ??
                cat.employee_category_id
            )
            .filter(Boolean)
            .map(String)
        : []
      setSelectedCategories(savedCats)

      // Map saved employees matching v1
      const savedEmps = Array.isArray(geo.employee_id)
        ? geo.employee_id.map((emp: any) => emp.directus_users_id).filter(Boolean).map(String)
        : []
      setSelectedEmployees(savedEmps)
    }
  }, [geofenceById, setValue])

  // Helper: Reverse Geocoding with Google Maps
  const reverseGeocode = useCallback(
    (lat: number, lng: number) => {
      if (window.google?.maps?.Geocoder) {
        const geocoder = new window.google.maps.Geocoder()
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
          if (status === 'OK' && results?.[0]) {
            setValue('geo_fence_address', results[0].formatted_address)
          }
        })
      }
    },
    [setValue]
  )

  // Helper: Marker & Circle visual update on Google Map matching v1
  const updateMarkerAndCircle = useCallback((loc: { lat: number; lng: number }, rad: number) => {
    if (!mapInstanceRef.current || !window.google?.maps) return

    // Marker
    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        position: loc,
        map: mapInstanceRef.current,
        draggable: true,
      })

      markerRef.current.addListener('dragend', (e: any) => {
        const newLoc = { lat: e.latLng.lat(), lng: e.latLng.lng() }
        setLocation(newLoc)
        updateMarkerAndCircle(newLoc, radiusRef.current)
        reverseGeocode(newLoc.lat, newLoc.lng)
      })
    } else {
      markerRef.current.setPosition(loc)
    }

    // Circle (orange color matching v1)
    if (!circleRef.current) {
      circleRef.current = new window.google.maps.Circle({
        map: mapInstanceRef.current,
        center: loc,
        radius: rad,
        fillColor: '#FF6A00',
        fillOpacity: 0.2,
        strokeColor: '#FF6A00',
        strokeOpacity: 0.6,
        strokeWeight: 2,
      })
    } else {
      circleRef.current.setCenter(loc)
      circleRef.current.setRadius(rad)
    }
  }, [reverseGeocode])

  // Live radius updates to circle
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(Number(radius) || 100)
    }
  }, [radius])

  // 4. Initialize Google Map
  const initMap = useCallback(() => {
    if (mapRef.current && !mapInstanceRef.current && window.google?.maps) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: location,
        zoom: 15,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: true,
      })

      // Click on map to select location matching v1
      mapInstanceRef.current.addListener('click', (e: any) => {
        const newLocation = { lat: e.latLng.lat(), lng: e.latLng.lng() }
        setLocation(newLocation)
        updateMarkerAndCircle(newLocation, radiusRef.current)
        reverseGeocode(newLocation.lat, newLocation.lng)
      })

      updateMarkerAndCircle(location, radiusRef.current)
    }
  }, [location, updateMarkerAndCircle, reverseGeocode])

  // Load Google Maps script matching v1
  useEffect(() => {
    if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAP_KEY}`
      script.async = true
      script.defer = true
      script.onload = () => initMap()
      document.head.appendChild(script)
    } else if (window.google?.maps) {
      initMap()
    }
  }, [initMap])

  // Fetch current device location matching v1
  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }

    const toastId = toast.loading('Fetching your current location…')

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss(toastId)
        const newLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLocation(newLocation)
        updateMarkerAndCircle(newLocation, radiusRef.current)
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(newLocation)
          mapInstanceRef.current.setZoom(16)
        }
        reverseGeocode(pos.coords.latitude, pos.coords.longitude)
        toast.success('Current location fetched successfully!')
      },
      (err) => {
        toast.dismiss(toastId)
        console.error('Geolocation error:', err)
        toast.error('Could not get device location. Please allow location permissions in browser.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Auto-fetch current location if creating new geofence
  useEffect(() => {
    if (!isEdit && locationOption === 'current') {
      fetchCurrentLocation()
    }
  }, [])

  const handleLocationOptionChange = (value: 'current' | 'away') => {
    setLocationOption(value)
    if (value === 'current') {
      fetchCurrentLocation()
    } else {
      setSearchQuery('')
      setSearchResults([])
    }
  }

  // Search places via backend API / Google Geocoder with debounce
  useEffect(() => {
    if (!searchQuery.trim() || locationOption !== 'away') {
      setSearchResults([])
      setSearchError('')
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      setSearchError('')
      try {
        const response: any = await rdk.request(
          customEndpoint({
            path: 'api/get_place_coordinates',
            method: 'POST',
            body: JSON.stringify({ query: searchQuery }),
          })
        )

        let results: any[] = []
        if (Array.isArray(response)) {
          results = response
        } else if (response && Array.isArray(response.results)) {
          results = response.results
        } else if (response && Array.isArray(response.data)) {
          results = response.data
        }

        if (results.length === 0 && window.google?.maps?.Geocoder) {
          // Fallback to Google Maps Geocoder if custom endpoint returned no items
          const geocoder = new window.google.maps.Geocoder()
          geocoder.geocode({ address: searchQuery }, (gResults: any, status: string) => {
            if (status === 'OK' && Array.isArray(gResults)) {
              setSearchResults(gResults)
            } else {
              setSearchError('No locations found')
            }
          })
        } else {
          setSearchResults(results)
          if (results.length === 0) setSearchError('No locations found')
        }
      } catch (err) {
        console.error('Search error:', err)
        // Fallback to Google Maps Geocoder
        if (window.google?.maps?.Geocoder) {
          const geocoder = new window.google.maps.Geocoder()
          geocoder.geocode({ address: searchQuery }, (gResults: any, status: string) => {
            if (status === 'OK' && Array.isArray(gResults)) {
              setSearchResults(gResults)
            } else {
              setSearchError('No locations found')
            }
          })
        } else {
          setSearchError('Error searching location')
        }
      } finally {
        setIsSearching(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery, locationOption])

  const handleSelectLocation = (item: any) => {
    let lat: number | null = null
    let lng: number | null = null

    if (item.lat !== undefined && item.lng !== undefined) {
      lat = parseFloat(item.lat)
      lng = parseFloat(item.lng)
    } else if (item.latitude !== undefined && item.longitude !== undefined) {
      lat = parseFloat(item.latitude)
      lng = parseFloat(item.longitude)
    } else if (item.geometry?.location) {
      const loc = item.geometry.location
      lat = typeof loc.lat === 'function' ? loc.lat() : parseFloat(loc.lat)
      lng = typeof loc.lng === 'function' ? loc.lng() : parseFloat(loc.lng)
    }

    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
      const newLoc = { lat, lng }
      setLocation(newLoc)
      updateMarkerAndCircle(newLoc, radiusRef.current)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo(newLoc)
        mapInstanceRef.current.setZoom(16)
      }
      const label = item.description || item.formatted_address || item.name || `Lat: ${lat}, Lng: ${lng}`
      setValue('geo_fence_address', label)
      toast.success(`Selected: ${label}`)
      setSearchResults([])
    } else {
      toast.error('Could not retrieve coordinates for this place')
    }
  }

  // Employee Selection helpers matching v1
  const handleEmployeeToggle = (empId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    )
  }

  const handleSelectAllVisible = () => {
    const visibleIds = displayedEmployees.map((emp) => emp.id)
    setSelectedEmployees((prev) => {
      const set = new Set([...prev, ...visibleIds])
      return Array.from(set)
    })
  }

  const handleDeselectAllVisible = () => {
    const visibleIds = displayedEmployees.map((emp) => emp.id)
    setSelectedEmployees((prev) => prev.filter((id) => !visibleIds.includes(id)))
  }

  // 5. Submit mutation matching v1 payload exactly
  const mutation = useMutation({
    mutationFn: async (formData: any) => {
      const payload: Record<string, any> = {
        lat: String(location.lat),
        long: String(location.lng),
        radius: Number(formData.radius) || 100,
        geo_fence_address: formData.geo_fence_address || '',
        status: 'active',
        employee_category_id:
          selectedCategories.length > 0
            ? selectedCategories.map((catId) => ({
                employee_category_employee_category_id: {
                  employee_category_id: Number(catId),
                },
              }))
            : null,
        employee_id:
          selectedEmployees.length > 0
            ? selectedEmployees.map((empId) => ({
                directus_users_id: empId,
              }))
            : null,
      }

      if (isEdit) {
        return await rdk.request(updateItem('geo_fences', id!, payload))
      } else {
        return await rdk.request(createItem('geo_fences', payload))
      }
    },
    onSuccess: () => {
      sound.success()
      toast.success(`Geofence ${isEdit ? 'updated' : 'created'} successfully`)
      queryClient.invalidateQueries({ queryKey: ['geofences'] })
      queryClient.invalidateQueries({ queryKey: ['geo_fences'] })
      navigate('/admin/geofence-list')
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to save geofence')
    },
  })

  const onSubmit = (data: any) => {
    mutation.mutate(data)
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col h-full w-full overflow-hidden bg-background">
      {/* Top Floating Back Bar */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-xl border border-border/80 bg-background/90 px-3.5 py-2 shadow-lg backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin/geofence-list')}
          className="size-7 cursor-pointer text-muted-foreground hover:text-foreground"
          title="Back to Geofence List"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex items-center gap-2">
          <LocateFixed className="size-4 text-orange-500" />
          <span className="text-xs font-semibold text-foreground">
            {isEdit ? 'Update Geofence Location' : 'Create Geofence Location'}
          </span>
        </div>
      </div>

      {/* Full-bleed Google Map Canvas */}
      <div ref={mapRef} className="size-full h-full w-full" />

      {/* Floating Re-open Button if closed */}
      {!isModalOpen && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/geofence-list')}
            className="h-9 shadow-lg bg-background font-medium"
          >
            Back to List
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setIsModalOpen(true)
              setIsMinimized(false)
            }}
            className="h-9 shadow-lg gap-2 bg-primary text-primary-foreground font-semibold"
          >
            <Compass className="size-4" />
            <span>{isEdit ? 'Click to Update Geofence' : 'Click to Configure Geofence'}</span>
          </Button>
        </div>
      )}

      {/* Floating Configuration Card matching v1 exactly */}
      {isModalOpen && (
        <div
          className={cn(
            'absolute z-20 transition-all duration-300',
            isMinimized
              ? 'bottom-5 right-6 w-[420px] max-w-[95vw]'
              : 'bottom-5 left-1/2 -translate-x-1/2 w-[95%] max-w-6xl'
          )}
        >
          <div className="rounded-2xl border border-border/80 bg-background/95 p-4 shadow-2xl backdrop-blur-md">
            {isMinimized ? (
              /* Minimized Compact View matching v1 */
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-orange-500/10 rounded-lg text-orange-600">
                      <LocateFixed className="size-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {isEdit ? 'Update Mode' : 'Configuration Mode'}
                      </div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">
                        LAT: {location.lat.toFixed(4)} | LNG: {location.lng.toFixed(4)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsMinimized(false)}
                      className="size-7"
                      title="Expand"
                    >
                      <Maximize2 className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsModalOpen(false)}
                      className="size-7 text-muted-foreground hover:text-foreground"
                      title="Close"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {watch('geo_fence_address') && (
                  <p className="text-[11px] text-muted-foreground truncate" title={watch('geo_fence_address')}>
                    {watch('geo_fence_address')}
                  </p>
                )}

                {/* Mini Radius Input */}
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase whitespace-nowrap">
                    Radius (m):
                  </Label>
                  <Input
                    type="number"
                    value={radius}
                    onChange={(e) => setValue('radius', Number(e.target.value))}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMinimized(false)}
                    className="h-8 text-xs"
                  >
                    Expand
                  </Button>
                  <Button
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={handleSubmit(onSubmit)}
                    className="h-8 text-xs gap-1.5 font-semibold bg-primary text-primary-foreground"
                  >
                    {mutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    <span>Save</span>
                  </Button>
                </div>
              </div>
            ) : (
              /* Expanded Maximized View matching v1 */
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-orange-500/10 rounded-lg text-orange-600">
                      <LocateFixed className="size-4.5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-foreground">
                        {isEdit ? 'Update Geofence Parameters' : 'Configure New Geofence'}
                      </h2>
                      <p className="text-[11px] text-muted-foreground">
                        Click anywhere on map to pin coordinates or choose from settings below.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsMinimized(true)}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <Minimize2 className="size-3.5 mr-1" />
                      Minimize
                    </Button>
                    <span className="text-border">|</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsModalOpen(false)}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Close
                    </Button>
                  </div>
                </div>

                {/* 3-Column Grid Layout matching v1 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Column 1: Settings */}
                  <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm h-[360px] justify-between">
                    <div className="space-y-3 overflow-y-auto pr-1">
                      <label className="font-bold text-xs text-foreground flex items-center gap-1.5 border-b border-border pb-2">
                        <LocateFixed className="size-3.5 text-orange-500" /> Settings
                      </label>

                      {/* Dropdown for location option */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">
                          Want to add location?
                        </Label>
                        <Select
                          value={locationOption}
                          onValueChange={(val: 'current' | 'away') => handleLocationOptionChange(val)}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="current" className="text-xs">
                              Current Location
                            </SelectItem>
                            <SelectItem value="away" className="text-xs">
                              Away from location (Search)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Search location input when away */}
                      {locationOption === 'away' && (
                        <div className="relative space-y-1">
                          <Label className="text-[11px] font-semibold text-muted-foreground">
                            Search Location
                          </Label>
                          <div className="relative">
                            <Input
                              value={searchQuery}
                              onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setSearchError('')
                              }}
                              placeholder="Type to search landmark or address…"
                              className="h-8 text-xs pr-7 bg-background"
                            />
                            {isSearching && (
                              <Loader2 className="absolute right-2.5 top-2 size-4 animate-spin text-muted-foreground" />
                            )}
                          </div>

                          {searchError && (
                            <p className="text-[11px] text-destructive">{searchError}</p>
                          )}

                          {searchResults.length > 0 && (
                            <div className="absolute z-50 w-full max-h-36 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg mt-1">
                              {searchResults.map((item, index) => {
                                const label =
                                  item.description ||
                                  item.formatted_address ||
                                  item.name ||
                                  `Result ${index + 1}`
                                return (
                                  <button
                                    key={index}
                                    type="button"
                                    onClick={() => handleSelectLocation(item)}
                                    className="w-full text-left py-2 px-3 text-xs border-b border-border/50 hover:bg-muted/70 transition-colors block cursor-pointer"
                                  >
                                    {label}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Geofence Address text */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">
                          Geofence Address
                        </Label>
                        <Textarea
                          {...register('geo_fence_address')}
                          placeholder="Enter address or landmark…"
                          className="h-16 text-xs resize-none bg-background"
                        />
                      </div>

                      {/* Radius Input */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                          <CircleDashed className="size-3.5 text-orange-500" /> Geofence Radius (meters)
                        </Label>
                        <Input
                          type="number"
                          value={radius}
                          onChange={(e) => setValue('radius', Number(e.target.value))}
                          className="h-8 text-xs bg-background"
                          min={10}
                          max={50000}
                        />
                      </div>
                    </div>

                    {/* Coordinates readout */}
                    <div className="border-t border-border pt-2 shrink-0">
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        <strong>LAT:</strong> {location.lat.toFixed(6)} |{' '}
                        <strong>LNG:</strong> {location.lng.toFixed(6)}
                      </p>
                    </div>
                  </div>

                  {/* Column 2: Employee Categories */}
                  <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm h-[360px]">
                    <label className="font-bold text-xs text-foreground mb-3 flex items-center gap-1.5 border-b border-border pb-2 shrink-0">
                      <Layers className="size-3.5 text-orange-500" /> Applicable Categories (
                      {selectedCategories.length} selected)
                    </label>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {employeeCategory.length > 0 ? (
                        employeeCategory.map((cat: any) => {
                          const catId = String(cat.employee_category_id ?? cat.id)
                          const isChecked = selectedCategories.includes(catId)

                          return (
                            <label
                              key={catId}
                              className={cn(
                                'flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors',
                                isChecked
                                  ? 'border-orange-500/50 bg-orange-500/10 font-medium text-foreground'
                                  : 'border-border hover:bg-muted/50 text-muted-foreground'
                              )}
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => {
                                  setSelectedCategories((prev) =>
                                    prev.includes(catId)
                                      ? prev.filter((id) => id !== catId)
                                      : [...prev, catId]
                                  )
                                }}
                              />
                              <span>{cat.employee_category_name || `Category #${catId}`}</span>
                            </label>
                          )
                        })
                      ) : (
                        <div className="text-center text-muted-foreground py-12 text-xs">
                          No categories available
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Column 3: Employee Selection */}
                  <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm h-[360px]">
                    <label className="font-bold text-xs text-foreground flex items-center gap-1.5 border-b border-border pb-2 mb-2 shrink-0">
                      <Users className="size-3.5 text-orange-500" /> Select Employees (
                      {selectedEmployees.length} selected)
                    </label>

                    {/* Filter tabs */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1.5 border-b border-border shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveCategoryTab('all')}
                        className={cn(
                          'px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap rounded-full transition-colors cursor-pointer',
                          activeCategoryTab === 'all'
                            ? 'bg-orange-500 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        )}
                      >
                        All ({cachedStaff.length})
                      </button>
                      {employeeCategory.map((cat: any) => {
                        const catId = String(cat.employee_category_id ?? cat.id)
                        const count = cachedStaff.filter(
                          (emp) => String(emp.raw_category_id) === catId
                        ).length
                        return (
                          <button
                            key={catId}
                            type="button"
                            onClick={() => setActiveCategoryTab(catId)}
                            className={cn(
                              'px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap rounded-full transition-colors cursor-pointer',
                              activeCategoryTab === catId
                                ? 'bg-orange-500 text-white'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            )}
                          >
                            {cat.employee_category_name} ({count})
                          </button>
                        )
                      })}
                    </div>

                    {/* Search and All/Clear */}
                    <div className="flex gap-2 items-center my-2 shrink-0">
                      <Input
                        value={employeeSearchQuery}
                        onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                        placeholder="Filter employees…"
                        className="h-7.5 text-xs bg-background"
                      />
                      <div className="flex gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleSelectAllVisible}
                          className="h-7.5 text-[11px] px-2"
                        >
                          All
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDeselectAllVisible}
                          className="h-7.5 text-[11px] px-2"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>

                    {/* Scrollable employee list */}
                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                      {isLoadingUsers ? (
                        <div className="text-center text-muted-foreground py-12 text-xs">
                          <Loader2 className="size-4 animate-spin inline mr-1 text-primary" /> Loading
                          employees…
                        </div>
                      ) : displayedEmployees.length > 0 ? (
                        displayedEmployees.map((emp) => {
                          const isChecked = selectedEmployees.includes(emp.id)
                          return (
                            <label
                              key={emp.id}
                              className={cn(
                                'flex items-center justify-between p-1.5 rounded-lg border text-xs cursor-pointer transition-colors',
                                isChecked
                                  ? 'border-orange-500/50 bg-orange-500/10'
                                  : 'border-border hover:bg-muted/50'
                              )}
                            >
                              <div className="flex items-center gap-2 truncate pr-1">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => handleEmployeeToggle(emp.id)}
                                />
                                <div className="truncate">
                                  <div className="font-semibold text-foreground truncate">
                                    {emp.name}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {emp.category}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0">
                                {emp.designation}
                              </span>
                            </label>
                          )
                        })
                      ) : (
                        <div className="text-center text-muted-foreground py-10 text-xs">
                          No employees found
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Center Submit Button matching v1 */}
                <div className="flex items-center justify-center pt-2 border-t border-border">
                  <Button
                    type="submit"
                    disabled={mutation.isPending}
                    className="h-9 px-6 text-xs font-semibold gap-2 cursor-pointer bg-primary text-primary-foreground hover:opacity-90 shadow-md"
                  >
                    {mutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    <span>{isEdit ? 'Update Geofence' : 'Confirm Location'}</span>
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
