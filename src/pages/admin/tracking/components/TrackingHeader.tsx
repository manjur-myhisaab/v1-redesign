import React from 'react'
import { MapPin, RotateCw, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ConnectionStatus } from '../types'

interface TrackingHeaderProps {
  connectionStatus: ConnectionStatus
  totalEmployees: number
  locatedEmployees: number
  liveOnCount: number
  liveOffCount: number
  isLoading: boolean
  onRefresh: () => void
}

export const TrackingHeader: React.FC<TrackingHeaderProps> = ({
  connectionStatus,
  totalEmployees,
  locatedEmployees,
  liveOnCount,
  liveOffCount,
  isLoading,
  onRefresh,
}) => {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-card shadow-2xs">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <MapPin className="size-5 text-primary" />
            Live Realtime Tracking
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor real-time GPS locations, battery levels, and active field movement.
          </p>
        </div>
      </div>

      {/* Right side status indicators and action buttons */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Stream Status Indicator */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-border/60 bg-background text-xs">
          <span
            className={cn(
              'size-2 rounded-full',
              connectionStatus === 'connected'
                ? 'bg-emerald-500 shadow-[0_0_8px_#22c55e]'
                : connectionStatus === 'connecting'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-rose-500'
            )}
          />
          <span className="text-[11px] font-medium text-foreground">
            {connectionStatus === 'connected' ? (
              <span>
                Live <span className="text-muted-foreground">({locatedEmployees} visible / {totalEmployees} active)</span>
              </span>
            ) : connectionStatus === 'connecting' ? (
              <span className="text-muted-foreground">Connecting stream...</span>
            ) : (
              <span className="text-destructive font-semibold">Stream Offline</span>
            )}
          </span>
        </div>

        {/* Live ON / OFF Badges */}
        <Badge
          variant="secondary"
          className="gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium py-1 px-2.5"
        >
          <Radio className="size-3 text-emerald-600 animate-pulse" />
          <span>Live ON: {liveOnCount}</span>
        </Badge>

        {liveOffCount > 0 && (
          <Badge
            variant="secondary"
            className="gap-1 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-[11px] font-medium py-1 px-2.5"
          >
            <span>Live OFF: {liveOffCount}</span>
          </Badge>
        )}

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-2xs bg-background"
        >
          <RotateCw className={cn('size-3.5', isLoading && 'animate-spin text-primary')} />
          <span>Refresh</span>
        </Button>
      </div>
    </div>
  )
}
