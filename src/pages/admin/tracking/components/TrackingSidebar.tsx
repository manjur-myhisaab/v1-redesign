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
  Clock,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmployeeAvatar } from '@/lib/people'
import { cn } from '@/lib/utils'
import { formatLastSeen } from '../utils/firmResolver'
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
      {/* Floating Collapse / Expand Toggle Button */}
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
                  type="button"
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

          {/* Scrollable Employee Cards List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
            {filteredList.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <CardContent className="p-0 space-y-1">
                  <User className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="font-semibold text-xs text-foreground">No staff members found</p>
                  <p className="text-[11px] text-muted-foreground">Try adjusting your search or category filter</p>
                </CardContent>
              </Card>
            ) : (
              filteredList.map((emp) => {
                const isSelected = String(emp.id) === String(selectedEmployeeId)
                const hasGps = Boolean(emp.current_lat && emp.current_long)
                const isLiveOn = emp.live_tracking !== false
                const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Staff Member'
                const lastSeenText = formatLastSeen(emp.current_last_seen)

                const rawBat = emp.battery_percentage ? parseFloat(String(emp.battery_percentage)) : null
                const batVal = rawBat !== null ? (rawBat > 1 ? Math.round(rawBat) : Math.round(rawBat * 100)) : null

                return (
                  <Card
                    key={String(emp.id)}
                    onClick={() => onSelectEmployee(String(emp.id))}
                    className={cn(
                      'gap-2.5 p-3 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs group',
                      isSelected
                        ? 'border-primary bg-primary/[0.04] ring-1.5 ring-primary/40 shadow-xs'
                        : 'border-border/80 bg-card hover:border-primary/40 hover:bg-card/90'
                    )}
                  >
                    {/* Header: Avatar, Name, Category/Title, Badge */}
                    <CardHeader className="p-0 flex flex-row items-start justify-between gap-2 space-y-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <EmployeeAvatar
                            name={fullName}
                            employeeId={String(emp.id)}
                            avatar={emp.avatar}
                            className="size-9 rounded-full"
                          />
                          <span
                            className={cn(
                              'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background ring-1 ring-border/20',
                              hasGps && isLiveOn
                                ? 'bg-emerald-500 ring-emerald-500/30 animate-pulse'
                                : isLiveOn
                                ? 'bg-amber-500 ring-amber-500/30'
                                : 'bg-slate-400'
                            )}
                            title={isLiveOn ? (hasGps ? 'GPS Active' : 'Live ON (No GPS)') : 'Live OFF'}
                          />
                        </div>

                        <div className="min-w-0">
                          <CardTitle className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {fullName}
                          </CardTitle>
                          <CardDescription className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {emp.title || emp.category_name || emp.department_name || 'Staff Member'}
                          </CardDescription>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0">
                        {hasGps ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-semibold py-0.5 px-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1"
                          >
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            GPS
                          </Badge>
                        ) : isLiveOn ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-medium py-0.5 px-2 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded-full"
                          >
                            No GPS
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-medium px-1.5 py-0.5 rounded-md bg-muted border border-border/50">
                            Offline
                          </span>
                        )}
                      </div>
                    </CardHeader>

                    {/* Telemetry Bar: Battery, Movement, Last Seen */}
                    <CardContent className="p-0 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5 border border-border/40">
                        <div className="flex items-center gap-2">
                          {batVal !== null && (
                            <span
                              className={cn(
                                'flex items-center gap-1 font-semibold text-[10px]',
                                batVal < 20
                                  ? 'text-rose-600'
                                  : batVal < 50
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                              )}
                              title={`Battery: ${batVal}%`}
                            >
                              <Battery className="size-3" />
                              {batVal}%
                            </span>
                          )}

                          {emp.is_moving !== undefined && emp.is_moving !== null && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-foreground">
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

                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/90 shrink-0">
                          <Clock className="size-2.5" />
                          <span>{lastSeenText}</span>
                        </div>
                      </div>

                      {/* Geo Address if available */}
                      {emp.last_geo_address && (
                        <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground px-0.5">
                          <MapPin className="size-3 shrink-0 text-muted-foreground/70 mt-0.5" />
                          <span className="line-clamp-1 leading-tight">{emp.last_geo_address}</span>
                        </div>
                      )}
                    </CardContent>

                    {/* Footer Actions: Locate & View Staff Profile */}
                    <CardFooter className="p-0 pt-1 border-t border-border/40 flex items-center justify-between gap-2">
                      {hasGps ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6.5 px-2 text-[11px] font-medium text-primary hover:text-primary hover:bg-primary/10 border-primary/20 gap-1 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectEmployee(String(emp.id))
                          }}
                        >
                          <Crosshair className="size-3" />
                          <span>Locate</span>
                        </Button>
                      ) : (
                        <div />
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6.5 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted gap-1 ml-auto cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          onViewProfile(emp.id)
                        }}
                      >
                        <span>View Staff Profile</span>
                        <ExternalLink className="size-3" />
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
