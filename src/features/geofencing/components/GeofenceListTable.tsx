import { useState, useMemo } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  MapPin,
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Layers,
} from 'lucide-react'
import StatusBadge from '@/components/admin/StatusBadge'
import type { Geofence } from '../api/geofencingApi.types'

interface GeofenceListTableProps {
  geofences: Geofence[]
  loading: boolean
  selectedId: string | null
  onSelectGeofence: (g: Geofence | null) => void
  onAddClick: () => void
  onEditClick: (g: Geofence) => void
  onDeleteClick: (id: string) => void
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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const handleDelete = async (e: React.MouseEvent, id: string) => {
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
      const name = (g.geo_fence_name || '').toLowerCase()
      const addr = (g.geo_fence_address || '').toLowerCase()
      return name.includes(q) || addr.includes(q)
    })
  }, [geofences, search])

  const selectedGeofence = useMemo(
    () => geofences.find((g) => (g.geo_fence_id || g.id) === selectedId) || null,
    [geofences, selectedId]
  )

  // Minimized Mode: Sleek, compact floating bar allowing full view of the map
  if (isMinimized) {
    return (
      <div className="w-full max-w-4xl mx-auto rounded-2xl border border-border/80 bg-background/95 p-2.5 sm:px-4 sm:py-3 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Summary and expand trigger */}
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-2.5 text-left cursor-pointer group min-w-0 flex-1 hover:opacity-85 transition-opacity"
            title="Click to expand Geo-fences list"
          >
            <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
              <Layers className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-xs sm:text-sm font-semibold text-foreground truncate">
                  Manage Geo-fences
                </span>
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {geofences.length}
                </span>
              </div>
              {selectedGeofence ? (
                <p className="text-[11px] text-primary truncate font-medium">
                  Highlighted: {selectedGeofence.geo_fence_name || 'Geofence'}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                  Click to expand list &amp; select fences
                </p>
              )}
            </div>
          </button>

          {/* Right: Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onAddClick}
              className="btn-3d inline-flex h-8 sm:h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-3 sm:px-3.5 text-xs sm:text-[13px] font-medium text-background transition-opacity hover:opacity-90 active:scale-95"
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">Add Geo Fence</span>
              <span className="sm:hidden">Add</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="grid size-8 sm:size-9 cursor-pointer place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 shadow-2xs"
              title="Expand Geo-fences (Maximize)"
              aria-label="Expand Geo-fences list"
            >
              <ChevronUp className="size-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Expanded Mode: Full table with header controls and scrollable list
  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl border border-border/80 bg-background/95 p-4 sm:p-5 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
      {/* Header section inside card */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Layers className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-sm sm:text-base font-semibold tracking-tight text-foreground">
                Manage Geo-fences
              </h2>
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {geofences.length} Total
              </span>
            </div>
            <p className="text-[11.5px] sm:text-[12.5px] text-muted-foreground">
              Select a geofence to highlight on map, or edit/delete existing rules.
            </p>
          </div>
        </div>

        {/* Action buttons: Add Fence + Minimize */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddClick}
            className="btn-3d inline-flex h-8 sm:h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-3 sm:px-4 text-xs sm:text-[13px] font-medium text-background transition-opacity hover:opacity-90 active:scale-95 shadow-xs"
          >
            <Plus className="size-3.5 sm:size-4" />
            <span>Add New Geo Fence</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="grid size-8 sm:size-9 cursor-pointer place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 shadow-2xs"
            title="Minimize to view full map"
            aria-label="Minimize Geo-fences list"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
      </div>

      {/* Optional Search / Filter bar if more than 3 geofences */}
      {geofences.length > 3 && (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search geofences by name or address…"
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

      {/* Table grid container with custom overflow scroller */}
      <div className="max-h-56 sm:max-h-64 overflow-y-auto overflow-x-auto rounded-xl border border-border/60 bg-muted/10 shadow-inner">
        <table className="w-full text-left text-[12.5px] sm:text-[13px]">
          <thead className="sticky top-0 bg-background/95 dark:bg-card/95 text-[11.5px] font-semibold text-muted-foreground backdrop-blur-md shadow-2xs z-10">
            <tr className="border-b border-border/60">
              <th className="px-3.5 py-2">Name / Address</th>
              <th className="px-3 py-2">Latitude</th>
              <th className="px-3 py-2">Longitude</th>
              <th className="px-3 py-2">Radius</th>
              <th className="px-3 py-2">Target Category</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3.5 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin text-primary" /> Loading geofences…
                  </span>
                </td>
              </tr>
            ) : filteredGeofences.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <MapPin className="size-5 text-muted-foreground/60" />
                    <span>
                      {search ? 'No matching geofences found.' : 'No geofences added yet. Click "+ Add New Geo Fence" to create one.'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredGeofences.map((g) => {
                const id = g.geo_fence_id || g.id || ''
                const isSelected = selectedId === id
                return (
                  <tr
                    key={id}
                    onClick={() => onSelectGeofence(isSelected ? null : g)}
                    className={`cursor-pointer transition-colors hover:bg-muted/60 ${
                      isSelected
                        ? 'bg-primary/10 font-medium text-foreground'
                        : 'text-foreground/90'
                    }`}
                  >
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {isSelected && <span className="size-1.5 rounded-full bg-primary shrink-0" />}
                        <span className="font-medium text-foreground truncate max-w-[200px]">
                          {g.geo_fence_name || 'Unnamed'}
                        </span>
                      </div>
                      {g.geo_fence_address && (
                        <div className="truncate text-[11px] text-muted-foreground max-w-[220px]">
                          {g.geo_fence_address}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{g.geo_lat?.toFixed(4) ?? '-'}</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{g.geo_long?.toFixed(4) ?? '-'}</td>
                    <td className="px-3 py-2.5 tabular-nums">{g.radius ? `${g.radius}m` : '-'}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {g.applicable_categories_for && g.applicable_categories_for.length > 0
                        ? `${g.applicable_categories_for.length} Selected`
                        : 'All Employees'}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge tone={g.status === 'active' ? 'green' : 'gray'}>
                        {g.status || 'active'}
                      </StatusBadge>
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onEditClick(g)}
                          title="Edit Geofence"
                          className="grid size-7 cursor-pointer place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === id}
                          onClick={(e) => handleDelete(e, id)}
                          title="Delete Geofence"
                          className="grid size-7 cursor-pointer place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                        >
                          {deletingId === id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </button>
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

