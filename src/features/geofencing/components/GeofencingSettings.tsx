import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import rdk, { GOOGLE_MAP_KEY, readItems, deleteItem } from '@/services/server'
import { sound } from '@/lib/sound'
import GeofenceListTable from './GeofenceListTable'
import type { Geofence } from '../api/geofencingApi.types'

export default function GeofencingSettings() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const circleRef = useRef<any>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [highlightedFence, setHighlightedFence] = useState<Geofence | null>(null)

  // 1. Fetch geofences with exact v1 fields
  const { data: geoFenceData = [], isLoading } = useQuery({
    queryKey: ['geofences'],
    queryFn: async () => {
      const res = await rdk.request(
        readItems('geo_fences', {
          fields: [
            '*',
            'employee_category_id.employee_category_employee_category_id.*',
            'employee_id.*',
          ],
          sort: ['date_created'],
        })
      )
      if (Array.isArray(res)) return res
      if (Array.isArray((res as any)?.data)) return (res as any).data
      return []
    },
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  })

  // 2. Initialize Google Map
  const initMap = useCallback(() => {
    if (mapRef.current && !mapInstanceRef.current && window.google?.maps) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 23.16995, lng: 87.640588 },
        zoom: 6,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: true,
      })

      // If a fence was already highlighted before map finished loading, apply it
      if (highlightedFence) {
        applyHighlight(highlightedFence)
      }
    }
  }, [highlightedFence])

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

  // Helper to place marker & orange circle on map matching v1
  const applyHighlight = (fence: any) => {
    if (!mapInstanceRef.current || !window.google?.maps) return

    const lat = parseFloat(String(fence.lat ?? fence.geo_lat ?? 0))
    const lng = parseFloat(String(fence.long ?? fence.geo_long ?? 0))
    const rad = Number(fence.radius) || 100

    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return

    const loc = { lat, lng }

    // Marker
    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        position: loc,
        map: mapInstanceRef.current,
        title: fence.geo_fence_address || 'Geofence',
      })
    } else {
      markerRef.current.setPosition(loc)
      markerRef.current.setTitle(fence.geo_fence_address || 'Geofence')
    }

    // Circle (matching v1 orange styling)
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

    // Zoom into location
    mapInstanceRef.current.panTo(loc)
    mapInstanceRef.current.setZoom(16)
  }

  // Highlight geofence handler
  const highlightFence = (fence: any) => {
    setHighlightedFence(fence)
    if (fence) {
      applyHighlight(fence)
    }
  }

  // Auto-highlight first geofence when data is loaded matching v1
  useEffect(() => {
    if (geoFenceData && geoFenceData.length > 0 && !highlightedFence) {
      highlightFence(geoFenceData[0])
    }
  }, [geoFenceData])

  // Delete mutation matching v1
  const deleteMutation = useMutation({
    mutationFn: async (id: string | number) => {
      return await rdk.request(deleteItem('geo_fences', id))
    },
    onSuccess: () => {
      sound.success()
      toast.success('Geofence deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['geofences'] })
      queryClient.invalidateQueries({ queryKey: ['geo_fences'] })
      if (
        highlightedFence &&
        (String(highlightedFence.geo_fence_id) === String(highlightedFence.id))
      ) {
        setHighlightedFence(null)
      }
    },
    onError: () => {
      toast.error('Failed to delete geofence')
    },
  })

  const handleAddNew = () => {
    navigate('/admin/create-geo-location')
  }

  const handleEdit = (fence: any) => {
    const id = fence.geo_fence_id || fence.id
    navigate(`/admin/edit-geo-location/${id}`)
  }

  const handleDelete = (id: string | number) => {
    deleteMutation.mutate(id)
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col h-full w-full overflow-hidden bg-background">
      {/* Top Floating Breadcrumb Bar */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-xl border border-border/80 bg-background/90 px-3.5 py-2 shadow-lg backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin/settings?section=system-settings')}
          className="size-7 cursor-pointer text-muted-foreground hover:text-foreground"
          title="Back to Settings"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-orange-500" />
          <span className="text-xs font-semibold text-foreground">Geo-fencing Locations</span>
          <span className="text-muted-foreground text-xs">•</span>
          <span className="text-xs text-muted-foreground">{geoFenceData.length} Registered</span>
        </div>
      </div>

      {/* Full-bleed Google Map Canvas */}
      <div ref={mapRef} className="size-full h-full w-full" />

      {/* Floating Manage Geo-fences Panel at Bottom matching v1 */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 w-[95%] max-w-5xl">
        <GeofenceListTable
          geofences={geoFenceData}
          loading={isLoading}
          selectedId={highlightedFence?.geo_fence_id || highlightedFence?.id || null}
          onSelectGeofence={highlightFence}
          onAddClick={handleAddNew}
          onEditClick={handleEdit}
          onDeleteClick={handleDelete}
        />
      </div>
    </div>
  )
}
