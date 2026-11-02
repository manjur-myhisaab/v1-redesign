import React, { useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Battery,
  Footprints,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TimelineLocationGroup, TimelineSummary } from '../types'

interface TimelineSidebarProps {
  groups: TimelineLocationGroup[]
  summary: TimelineSummary
  currentIndex: number
  onSelectGroup: (group: TimelineLocationGroup) => void
  isLoading: boolean
}

export const TimelineSidebar: React.FC<TimelineSidebarProps> = ({
  groups,
  summary,
  currentIndex,
  onSelectGroup,
  isLoading,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)

  // Determine which group is active based on current scrubber point index
  const activeGroupIndex = groups.findIndex(
    (g) => currentIndex >= g.startIndex && currentIndex <= g.endIndex
  )

  const getStatusBadge = (status: TimelineLocationGroup['status'], duration: number) => {
    switch (status) {
      case 'start':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold">
            Start
          </Badge>
        )
      case 'end':
        return (
          <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] font-semibold">
            End
          </Badge>
        )
      case 'stayed':
        return (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-semibold">
            Stayed {duration}m
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            Transit
          </Badge>
        )
    }
  }

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
        title={isCollapsed ? 'Expand Journey Stops' : 'Collapse Journey Stops'}
      >
        {isCollapsed ? (
          <ChevronRight className="size-4 text-primary" />
        ) : (
          <ChevronLeft className="size-4" />
        )}
      </button>

      {isCollapsed ? (
        <div className="flex flex-col items-center py-6 gap-4 h-full overflow-hidden">
          <div className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
            <Footprints className="size-4 text-primary" />
            <span className="font-bold text-foreground text-xs">{summary.totalGroups}</span>
            <span className="text-[9px] uppercase tracking-wider">Stops</span>
          </div>

          <div className="w-6 h-px bg-border my-2" />

          <div className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
              {summary.totalDistanceKm}
            </span>
            <span className="text-[9px] uppercase tracking-wider">KM</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          {/* Header Summary Cards */}
          <div className="p-3.5 border-b border-border bg-muted/20 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Footprints className="size-4 text-primary" />
                Journey Waypoints & Stops
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                {summary.totalGroups} stops • {summary.totalPoints} pts
              </span>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Distance Card */}
              <div className="rounded-lg border border-border bg-background p-2 shadow-2xs">
                <span className="text-[10px] text-muted-foreground block mb-0.5">
                  Total Distance
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="font-bold text-foreground text-sm">
                    {summary.totalDistanceKm.toFixed(2)} km
                  </span>
                  {summary.odometerDistanceKm > 0 && (
                    <span className="text-[10px] text-muted-foreground" title="Odometer Distance">
                      Odo: {summary.odometerDistanceKm} km
                    </span>
                  )}
                </div>
              </div>

              {/* Duration Card */}
              <div className="rounded-lg border border-border bg-background p-2 shadow-2xs">
                <span className="text-[10px] text-muted-foreground block mb-0.5">
                  Active Duration
                </span>
                <span className="font-bold text-foreground text-sm">
                  {summary.totalDurationFormatted}
                </span>
              </div>
            </div>
          </div>

          {/* Stops / Waypoints Scrollable List */}
          <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-border/50">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs">Processing route breadcrumbs...</span>
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <MapPin className="size-8 text-muted-foreground/40 mb-2" />
                <span className="text-xs font-medium text-foreground">No route recorded</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  Select a staff member and date, then click Load Journey.
                </span>
              </div>
            ) : (
              groups.map((grp, idx) => {
                const isActive = activeGroupIndex === idx
                return (
                  <div
                    key={grp.id}
                    onClick={() => onSelectGroup(grp)}
                    className={cn(
                      'p-3 transition-colors cursor-pointer text-xs space-y-1.5',
                      isActive
                        ? 'bg-primary/10 border-l-3 border-l-primary'
                        : 'hover:bg-muted/40'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-foreground shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-foreground text-[11px]">
                          {grp.timeRangeString}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {getStatusBadge(grp.status, grp.durationMinutes)}
                      </div>
                    </div>

                    <div className="flex items-start gap-1.5 text-muted-foreground text-[11px] pl-6.5">
                      <MapPin className="size-3 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="line-clamp-2 text-foreground/80">{grp.address}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pl-6.5 pt-0.5">
                      <span>{grp.pointCount} breadcrumbs</span>
                      {grp.batteryPercentage !== null && (
                        <span className="flex items-center gap-1">
                          <Battery className="size-3 text-muted-foreground" />
                          <span>{grp.batteryPercentage}%</span>
                        </span>
                      )}
                    </div>
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
