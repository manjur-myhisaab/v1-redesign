import React, { useState, useMemo } from 'react'
import {
  Search,
  Crosshair,
  Battery,
  Navigation,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  X,
  User,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatLastSeen } from '../utils/firmResolver'
import { getFullAvatarUrl } from '../utils/markerIconBuilder'
import type { TrackingEmployee, EmployeeCategory } from '../types'

interface TrackingSidebarProps {
  employees: TrackingEmployee[]
  categories: EmployeeCategory[]
  selectedCategory: string
  onCategoryChange: (catId: string) => void
  selectedEmployeeId: string
  onSelectEmployee: (empId: string) => void
  onTrackAll: () => void
  onCenterMap: () => void
  onViewProfile: (userId: string | number) => void
}

export const TrackingSidebar: React.FC<TrackingSidebarProps> = ({
  employees,
  categories,
  selectedCategory,
  onCategoryChange,
  selectedEmployeeId,
  onSelectEmployee,
  onTrackAll,
  onCenterMap,
  onViewProfile,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'located' | 'offline'>('all')

  const categoryOptions = useMemo(() => {
    return [
      { label: 'All Categories', value: 'all' },
      ...categories.map((c) => ({
        label: c.employee_category_name || c.category_name || `Category ${c.id || c.employee_category_id}`,
        value: String(c.employee_category_id || c.id),
      })),
    ]
  }, [categories])

  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return employees.filter((emp) => {
      // Category filter
      if (selectedCategory !== 'all' && String(emp.category_id) !== String(selectedCategory)) {
        return false
      }
      // Status filter tab
      const isLocated = Boolean(emp.current_lat && emp.current_long)
      if (statusFilter === 'located' && !isLocated) return false
      if (statusFilter === 'offline' && isLocated) return false

      // Search query
      if (q) {
        const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase()
        const dept = (emp.department_name || '').toLowerCase()
        const cat = (emp.category_name || '').toLowerCase()
        const email = (emp.email || '').toLowerCase()
        return (
          fullName.includes(q) ||
          dept.includes(q) ||
          cat.includes(q) ||
          email.includes(q)
        )
      }
      return true
    })
  }, [employees, selectedCategory, statusFilter, searchQuery])

  const counts = useMemo(() => {
    const total = employees.length
    const located = employees.filter((e) => e.current_lat && e.current_long).length
    const offline = total - located
    return { total, located, offline }
  }, [employees])

  return (
    <div
      className={cn(
        'relative flex flex-col border-r border-border bg-card/95 backdrop-blur-md transition-all duration-300 z-20 shrink-0 h-full shadow-sm',
        isCollapsed ? 'w-14' : 'w-80 sm:w-96'
      )}
    >
      {/* Floating Collapse / Expand Toggle Button - Positioned over the boundary */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3.5 top-5 z-30 flex size-7 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md hover:bg-muted hover:scale-105 active:scale-95 transition-all cursor-pointer"
        title={isCollapsed ? 'Expand Staff List' : 'Collapse Staff List'}
        aria-label={isCollapsed ? 'Expand Staff List' : 'Collapse Staff List'}
      >
        {isCollapsed ? <ChevronRight className="size-4 text-primary" /> : <ChevronLeft className="size-4" />}
      </button>

      {isCollapsed ? (
        <div className="flex flex-col items-center py-5 gap-3 h-full overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={onTrackAll}
            title="Track All"
            className="size-8 text-primary hover:bg-primary/10 cursor-pointer"
          >
            <Navigation className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCenterMap}
            title="Center Map"
            className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Crosshair className="size-4" />
          </Button>
          <div className="w-6 h-px bg-border my-1" />
          <div className="flex flex-col items-center gap-1 text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground">{counts.located}</span>
            <span className="text-[9px] uppercase tracking-wider">Live</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          {/* Top Panel Actions & Search */}
          <div className="p-3.5 border-b border-border space-y-3 bg-muted/20 shrink-0">
            {/* Header row with title & collapse button */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Navigation className="size-3.5 text-primary" />
                Staff Directory
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCollapsed(true)}
                title="Collapse Sidebar"
                className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
            </div>

            {/* Quick Map Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={onTrackAll}
                className="h-8 gap-1.5 text-xs font-semibold cursor-pointer shadow-2xs"
              >
                <Navigation className="size-3.5" />
                <span>Track All</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onCenterMap}
                className="h-8 gap-1.5 text-xs font-medium cursor-pointer bg-background"
              >
                <Crosshair className="size-3.5 text-muted-foreground" />
                <span>Center Map</span>
              </Button>
            </div>

            {/* Category Filter */}
            <div className="space-y-1">
              <Select value={selectedCategory} onValueChange={onCategoryChange}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {categoryOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search staff by name, dept..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-7 text-xs bg-background"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Status Tabs: All, Located, No GPS */}
            <div className="grid grid-cols-3 p-0.5 bg-muted/60 rounded-lg text-[11px] font-medium border border-border/50 text-center">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={cn(
                  'py-1 rounded-md transition-all cursor-pointer',
                  statusFilter === 'all'
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                All ({counts.total})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('located')}
                className={cn(
                  'py-1 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1',
                  statusFilter === 'located'
                    ? 'bg-background text-emerald-600 font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="size-1.5 rounded-full bg-emerald-500" />
                GPS ({counts.located})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('offline')}
                className={cn(
                  'py-1 rounded-md transition-all cursor-pointer',
                  statusFilter === 'offline'
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                No GPS ({counts.offline})
              </button>
            </div>
          </div>

          {/* Scrollable Employee List */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/60">
            {filteredList.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                <User className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-semibold text-foreground">No staff members found</p>
                <p className="text-[11px]">Try adjusting your search or category filter</p>
              </div>
            ) : (
              filteredList.map((emp) => {
                const isSelected = String(emp.id) === String(selectedEmployeeId)
                const hasGps = Boolean(emp.current_lat && emp.current_long)
                const isLiveOn = emp.live_tracking !== false
                const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Staff Member'
                const avatarSrc = getFullAvatarUrl(emp.avatar)
                const lastSeenText = formatLastSeen(emp.current_last_seen)

                const rawBat = emp.battery_percentage ? parseFloat(String(emp.battery_percentage)) : null
                const batVal = rawBat !== null ? (rawBat > 1 ? Math.round(rawBat) : Math.round(rawBat * 100)) : null

                return (
                  <div
                    key={String(emp.id)}
                    onClick={() => onSelectEmployee(String(emp.id))}
                    className={cn(
                      'p-3 hover:bg-muted/50 transition-colors cursor-pointer group space-y-2',
                      isSelected && 'bg-primary/5 border-l-2 border-primary'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {/* Avatar & User Details */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={avatarSrc}
                            alt={fullName}
                            className="size-9 rounded-full object-cover border border-border shadow-2xs"
                            onError={(e) => {
                              ;(e.target as HTMLImageElement).src =
                                'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'
                            }}
                          />
                          <span
                            className={cn(
                              'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background',
                              hasGps && isLiveOn
                                ? 'bg-emerald-500'
                                : isLiveOn
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                            )}
                            title={isLiveOn ? (hasGps ? 'GPS Active' : 'Live ON (No GPS)') : 'Live OFF'}
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                            {fullName}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {emp.title || emp.category_name || emp.department_name || 'Staff'}
                          </p>
                        </div>
                      </div>

                      {/* GPS Status Badge */}
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {hasGps ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-medium py-0 px-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                          >
                            Located
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">No GPS</span>
                        )}
                        <span className="text-[9px] text-muted-foreground">{lastSeenText}</span>
                      </div>
                    </div>

                    {/* Telemetry Bar: Battery, Movement, Address */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                      <div className="flex items-center gap-2.5">
                        {batVal !== null && (
                          <span
                            className={cn(
                              'flex items-center gap-1 font-medium',
                              batVal < 20
                                ? 'text-rose-600'
                                : batVal < 50
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            )}
                          >
                            <Battery className="size-3" />
                            {batVal}%
                          </span>
                        )}

                        {emp.is_moving !== undefined && emp.is_moving !== null && (
                          <span className="flex items-center gap-1">
                            <span
                              className={cn(
                                'size-1.5 rounded-full',
                                emp.is_moving ? 'bg-emerald-500' : 'bg-muted-foreground'
                              )}
                            />
                            {emp.is_moving ? 'Moving' : 'Stationary'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {hasGps && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px] text-primary hover:bg-primary/10 gap-0.5"
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectEmployee(String(emp.id))
                            }}
                          >
                            <Crosshair className="size-2.5" />
                            Locate
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-5 text-muted-foreground hover:text-foreground"
                          title="View Profile"
                          onClick={(e) => {
                            e.stopPropagation()
                            onViewProfile(emp.id)
                          }}
                        >
                          <ExternalLink className="size-2.5" />
                        </Button>
                      </div>
                    </div>

                    {emp.last_geo_address && (
                      <p className="text-[10px] text-muted-foreground truncate leading-tight flex items-center gap-1">
                        <MapPin className="size-2.5 shrink-0 text-muted-foreground/70" />
                        <span className="truncate">{emp.last_geo_address}</span>
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
