import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Crosshair,
  Loader2,
  Shield,
  Layers,
  Users,
  Navigation,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import rdk, {
  readItems,
  deleteItem,
  GOOGLE_MAP_KEY,
} from '@/services/server'
import { sound } from '@/lib/sound'

export const GeofencingSettings: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const circleRef = useRef<any>(null)

  const [selectedFence, setSelectedFence] = useState<any | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [fenceToDelete, setFenceToDelete] = useState<any | null>(null)

  // 1. Fetch Geofences directly via Directus RDK from "geo_fences" collection
  const { data: geofences = [], isLoading, error } = useQuery({
    queryKey: ['geo_fences'],
    queryFn: async () => {
      const res = await rdk.request(
        readItems('geo_fences', {
          fields: [
            '*',
            'employee_category_id.employee_category_employee_category_id.*',
            'employee_id.*',
          ],
          sort: ['-date_created'],
        })
      )
      if (Array.isArray(res)) return res
      if (Array.isArray((res as any)?.data)) return (res as any).data
      return res ? [res] : []
    },
    refetchOnWindowFocus: false,
  })

  // 2. Load Google Maps Script
  const initMap = useCallback(() => {
    if (mapContainerRef.current && !mapInstanceRef.current && window.google?.maps) {
      mapInstanceRef.current = new window.google.maps.Map(mapContainerRef.current, {
        center: { lat: 23.16995, lng: 87.640588 },
        zoom: 13,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: true,
      })
    }
  }, [])

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

  // 3. Highlight Geofence on Map
  const highlightFence = useCallback((fence: any) => {
    if (!fence || !fence.lat || !fence.long) return
    setSelectedFence(fence)

    const lat = parseFloat(fence.lat)
    const lng = parseFloat(fence.long)
    const radius = Number(fence.radius) || 100

    if (isNaN(lat) || isNaN(lng) || !mapInstanceRef.current || !window.google?.maps) return

    const pos = { lat, lng }

    // Update / Create Marker
    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        title: fence.geo_fence_location_name || 'Geofence Location',
      })
    } else {
      markerRef.current.setPosition(pos)
      markerRef.current.setTitle(fence.geo_fence_location_name || 'Geofence Location')
    }

    // Update / Create Circle boundary
    if (!circleRef.current) {
      circleRef.current = new window.google.maps.Circle({
        strokeColor: '#3b82f6',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        map: mapInstanceRef.current,
        center: pos,
        radius,
      })
    } else {
      circleRef.current.setCenter(pos)
      circleRef.current.setRadius(radius)
    }

    mapInstanceRef.current.panTo(pos)
    mapInstanceRef.current.setZoom(16)
  }, [])

  // Auto-select first fence once loaded
  useEffect(() => {
    if (geofences.length > 0 && !selectedFence && mapInstanceRef.current) {
      highlightFence(geofences[0])
    }
  }, [geofences, selectedFence, highlightFence])

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      return await rdk.request(deleteItem('geo_fences', id))
    },
    onSuccess: () => {
      sound.success()
      toast.success('Geofence location deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['geo_fences'] })
      queryClient.invalidateQueries({ queryKey: ['geofences'] })
      setDeleteConfirmOpen(false)
      setFenceToDelete(null)
      if (selectedFence && (selectedFence.geo_fence_id === fenceToDelete?.geo_fence_id || selectedFence.id === fenceToDelete?.id)) {
        setSelectedFence(null)
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete geofence location')
    },
  })

  const handleAddNew = () => {
    navigate('/admin/create-geo-location')
  }

  const handleEdit = (fence: any) => {
    const id = fence.geo_fence_id || fence.id
    navigate(`/admin/edit-geo-location/${id}`)
  }

  const handleDeletePrompt = (fence: any) => {
    setFenceToDelete(fence)
    setDeleteConfirmOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center text-sm text-destructive">
        Failed to load geofencing locations.
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header Card */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-5 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <MapPin className="size-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Geofencing &amp; Location Restrictions</h2>
            <p className="text-xs text-muted-foreground">
              Define physical branch boundaries and radius thresholds for mobile punch-in verification
            </p>
          </div>
        </div>

        <Button
          onClick={handleAddNew}
          size="sm"
          className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>Add Location</span>
        </Button>
      </div>

      {/* Main Interactive Container: Map + Geofence Cards List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Interactive Google Map Panel */}
        <div className="lg:col-span-7 h-[420px] rounded-xl border border-border overflow-hidden bg-muted/30 relative shadow-2xs">
          <div ref={mapContainerRef} className="size-full" />

          {selectedFence && (
            <div className="absolute top-3 left-3 bg-card/95 backdrop-blur-md border border-border rounded-lg px-3 py-2 shadow-md max-w-xs space-y-0.5">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 truncate">
                <Navigation className="size-3.5 text-primary" />
                {selectedFence.geo_fence_location_name || 'Selected Location'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Radius: <span className="font-semibold text-foreground">{selectedFence.radius || 100} meters</span>
              </p>
            </div>
          )}
        </div>

        {/* Geofence List */}
        <div className="lg:col-span-5 flex flex-col h-[420px] overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
          <div className="p-3.5 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary" />
              Configured Boundaries ({geofences.length})
            </span>
            <Badge variant="outline" className="text-[10px]">
              Collection: geo_fences
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {geofences.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
                <MapPin className="size-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs font-medium">No Geofence Locations Defined</p>
                <p className="text-[11px] mt-1">
                  Add office or client sites to restrict staff punches.
                </p>
                <Button onClick={handleAddNew} size="sm" className="mt-3 h-7 text-xs">
                  Create Location
                </Button>
              </div>
            ) : (
              geofences.map((fence: any) => {
                const fId = fence.geo_fence_id || fence.id
                const isSelected = selectedFence && (selectedFence.geo_fence_id === fId || selectedFence.id === fId)

                const categoryCount = Array.isArray(fence.employee_category_id)
                  ? fence.employee_category_id.length
                  : 0
                const employeeCount = Array.isArray(fence.employee_id)
                  ? fence.employee_id.length
                  : 0

                return (
                  <div
                    key={fId}
                    onClick={() => highlightFence(fence)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20'
                        : 'border-border bg-card hover:bg-muted/30 hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-semibold text-foreground truncate">
                            {fence.geo_fence_location_name || `Location #${fId}`}
                          </h4>
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-mono">
                            {fence.radius || 100}m
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {fence.geo_fence_address || fence.address || 'Address not specified'}
                        </p>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => highlightFence(fence)}
                          className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Locate on Map"
                        >
                          <Crosshair className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(fence)}
                          className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Edit Location"
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePrompt(fence)}
                          className="size-6 text-destructive/70 hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                          title="Delete Location"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2 mt-2 border-t border-border/60 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Shield className="size-3 text-primary" />
                        {categoryCount > 0 ? `${categoryCount} Categories` : 'All Categories'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="size-3 text-blue-500" />
                        {employeeCount > 0 ? `${employeeCount} Staff Assigned` : 'All Staff'}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold">Delete Geofence Location</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete <strong className="text-foreground">{fenceToDelete?.geo_fence_location_name || 'this location'}</strong>?
              Employees will no longer be restricted to this perimeter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending} className="text-xs h-8">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                fenceToDelete &&
                deleteMutation.mutate(fenceToDelete.geo_fence_id || fenceToDelete.id)
              }
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs h-8"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Location'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default GeofencingSettings
