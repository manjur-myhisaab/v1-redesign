import React, { useState, useMemo } from 'react'
import {
  Plus,
  Edit3,
  Trash2,
  MapPin,
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Geofence } from '../api/geofencingApi.types'

interface GeofenceListTableProps {
  geofences: Geofence[]
  loading: boolean
  selectedId: string | number | null
  onSelectGeofence: (g: Geofence | null) => void
  onAddClick: () => void
  onEditClick: (g: Geofence) => void
  onDeleteClick: (id: string | number) => void
  initialMinimized?: boolean
}

export default function GeofenceListTable({
  geofences,
  loading,
  selectedId,
  onSelectGeofence,
  onAddClick,
  onEditClick,
  onDeleteClick,
  initialMinimized = false,
}: GeofenceListTableProps) {
  const [isMinimized, setIsMinimized] = useState(initialMinimized)
  const [deletingId, setDeletingId] = useState<string | number | null>(null)
  const [search, setSearch] = useState('')

  const handleDelete = async (e: React.MouseEvent, id: string | number) => {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this geofence?')) return
    setDeletingId(id)
    try {
      await onDeleteClick(id)
    } finally {
      setDeletingId(null)
    }
  }

  const filteredGeofences = useMemo(() => {
    if (!search.trim()) return geofences
    const q = search.toLowerCase().trim()
    return geofences.filter((g) => {
      const addr = (g.geo_fence_address || '').toLowerCase()
      const lat = String(g.lat ?? '')
      const long = String(g.long ?? '')
      return addr.includes(q) || lat.includes(q) || long.includes(q)
    })
  }, [geofences, search])

  const selectedGeofence = useMemo(
    () => geofences.find((g) => String(g.geo_fence_id || g.id) === String(selectedId)) || null,
    [geofences, selectedId]
  )

  const formatCoord = (val?: string | number | null) => {
    if (val === undefined || val === null || val === '') return '-'
    const num = parseFloat(String(val))
    return isNaN(num) ? '-' : num.toFixed(4)
  }

  const getCategoryDisplay = (fence: any) => {
    const list = Array.isArray(fence.employee_category_id) ? fence.employee_category_id : []
    const names = list
      .map((cat: any) => cat.employee_category_employee_category_id?.employee_category_name)
      .filter(Boolean)
    return names.length > 0 ? names.join(', ') : '-'
  }

  // Minimized Floating Bar
  if (isMinimized) {
    return (
      <div className="w-full max-w-4xl mx-auto rounded-2xl border border-border/80 bg-background/95 p-3 shadow-2xl backdrop-blur-md transition-all duration-300">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-2.5 text-left cursor-pointer group min-w-0 flex-1"
            title="Click to expand Geo-fences list"
          >
            <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-orange-600">
              <Layers className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-semibold text-foreground truncate">
                  Manage Geo-fences
                </span>
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {geofences.length}
                </span>
              </div>
              {selectedGeofence ? (
                <p className="text-[11px] text-orange-600 truncate font-medium">
                  Highlighted: {selectedGeofence.geo_fence_address || 'Selected Geofence'}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                  Click to expand list &amp; select fences
                </p>
              )}
            </div>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={onAddClick}
              className="h-8 gap-1.5 text-xs font-semibold cursor-pointer bg-primary text-primary-foreground hover:opacity-90"
            >
              <Plus className="size-3.5" />
              <span>Add New Geo Fence</span>
            </Button>

            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="grid size-8 cursor-pointer place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Expand Geo-fences list"
            >
              <ChevronUp className="size-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Expanded Floating Card matching v1
  return (
    <div className="w-full max-w-5xl mx-auto rounded-2xl border border-border/80 bg-background/95 p-4 shadow-2xl backdrop-blur-md transition-all duration-300">
      {/* Banner matching v1 info box */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
        <div>
          <h3 className="text-xs sm:text-sm font-bold text-foreground">
            Manage Geo-fences ({geofences.length} Total)
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Select a geofence to highlight it on the map. You can also edit or delete existing fences.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onAddClick}
            className="h-8 gap-1.5 text-xs font-semibold cursor-pointer bg-primary text-primary-foreground hover:opacity-90"
          >
            <Plus className="size-3.5" />
            <span>+ Add New Geo Fence</span>
          </Button>

          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="grid size-8 cursor-pointer place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Minimize"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {geofences.length > 3 && (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search geofences by address or coordinates…"
            className="h-8 w-full rounded-lg border border-border bg-muted/40 pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      )}

      {/* Table matching v1 exactly */}
      <div className="max-h-56 sm:max-h-64 overflow-y-auto overflow-x-auto rounded-xl border border-border/80 bg-card">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-muted/90 text-[11px] font-semibold text-muted-foreground backdrop-blur-md z-10">
            <tr className="border-b border-border">
              <th className="p-2.5 text-left">Address</th>
              <th className="p-2.5 text-left">Latitude</th>
              <th className="p-2.5 text-left">Longitude</th>
              <th className="p-2.5 text-left">Radius (m)</th>
              <th className="p-2.5 text-left">Category</th>
              <th className="p-2.5 text-left">Status</th>
              <th className="p-2.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin text-primary" /> Loading geofences…
                  </span>
                </td>
              </tr>
            ) : filteredGeofences.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <MapPin className="size-5 text-muted-foreground/60" />
                    <span>
                      {search ? 'No matching geofences found.' : 'No geofences added yet. Click "+ Add New Geo Fence" to create one.'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredGeofences.map((fence) => {
                const id = fence.geo_fence_id || fence.id || ''
                const isSelected = String(selectedId) === String(id)

                return (
                  <tr
                    key={id}
                    onClick={() => onSelectGeofence(isSelected ? null : fence)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-500/10 dark:bg-blue-500/20 font-medium'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <td
                      className="p-2.5 max-w-[220px] truncate font-medium text-foreground"
                      title={fence.geo_fence_address || '-'}
                    >
                      {fence.geo_fence_address || '-'}
                    </td>
                    <td className="p-2.5 tabular-nums text-muted-foreground">
                      {formatCoord(fence.lat ?? fence.geo_lat)}
                    </td>
                    <td className="p-2.5 tabular-nums text-muted-foreground">
                      {formatCoord(fence.long ?? fence.geo_long)}
                    </td>
                    <td className="p-2.5 tabular-nums">{fence.radius || 100}</td>
                    <td className="p-2.5 max-w-[180px] truncate text-muted-foreground" title={getCategoryDisplay(fence)}>
                      {getCategoryDisplay(fence)}
                    </td>
                    <td className="p-2.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] py-0 px-2 font-medium capitalize ${
                          fence.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {fence.status || 'active'}
                      </Badge>
                    </td>
                    <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditClick(fence)}
                          className="size-7 cursor-pointer text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Edit3 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deletingId === id}
                          onClick={(e) => handleDelete(e, id)}
                          className="size-7 cursor-pointer text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                          title="Delete"
                        >
                          {deletingId === id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
