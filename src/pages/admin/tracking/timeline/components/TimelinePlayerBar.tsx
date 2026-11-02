import React, { useEffect } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Clock,
  MapPin,
  Milestone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import type { ParsedTimelinePoint, PlaybackSpeed } from '../types'

interface TimelinePlayerBarProps {
  points: ParsedTimelinePoint[]
  currentIndex: number
  onIndexChange: (idx: number) => void
  isPlaying: boolean
  onTogglePlay: () => void
  onReset: () => void
  playbackSpeed: PlaybackSpeed
  onChangeSpeed: (spd: PlaybackSpeed) => void
  totalDistanceKm: number
}

export const TimelinePlayerBar: React.FC<TimelinePlayerBarProps> = ({
  points,
  currentIndex,
  onIndexChange,
  isPlaying,
  onTogglePlay,
  onReset,
  playbackSpeed,
  onChangeSpeed,
  totalDistanceKm,
}) => {
  const currentPoint = points[currentIndex]
  const totalPoints = points.length

  // Keyboard shortcut listener (Space to play/pause, Left/Right arrows to step)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase()
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        onTogglePlay()
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        onIndexChange(Math.max(0, currentIndex - 1))
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        onIndexChange(Math.min(totalPoints - 1, currentIndex + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onTogglePlay, onIndexChange, currentIndex, totalPoints])

  const speeds: PlaybackSpeed[] = [1, 2, 4, 8]

  return (
    <div className="absolute bottom-5 left-5 right-5 z-20 mx-auto max-w-4xl rounded-2xl border border-border/80 bg-background/95 backdrop-blur-md px-4 py-3 shadow-2xl transition-all duration-200">
      {/* Top telemetry & timestamp row */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium pb-2 border-b border-border/40">
        <div className="flex items-center gap-3">
          {/* Current Time Badge */}
          <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-primary font-semibold">
            <Clock className="size-3.5" />
            <span className="tabular-nums text-xs">
              {currentPoint ? currentPoint.timeFormatted : '--:--'}
            </span>
          </div>

          {/* Current Address / Location Snippet */}
          <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground max-w-sm truncate" title={currentPoint?.address}>
            <MapPin className="size-3.5 text-rose-500 shrink-0" />
            <span className="truncate text-[11px] text-foreground font-normal">
              {currentPoint?.address || 'Locating waypoint...'}
            </span>
          </div>
        </div>

        {/* Total Route Distance Metric */}
        <div className="flex items-center gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-md border border-border/40">
            <Milestone className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Total Route:</span>
            <strong className="text-foreground tabular-nums font-semibold">
              {totalDistanceKm.toFixed(2)} km
            </strong>
          </div>
        </div>
      </div>

      {/* Scrubber slider bar (Shadcn Slider) */}
      <div className="pt-2 pb-1.5 px-0.5">
        <Slider
          value={[currentIndex]}
          max={Math.max(0, totalPoints - 1)}
          step={1}
          onValueChange={(val) => onIndexChange(val[0] ?? 0)}
          className="w-full py-1.5"
        />
      </div>

      {/* Bottom video control buttons */}
      <div className="flex items-center justify-between pt-1">
        {/* Playback Controls (Play/Pause, Rewind, Step) */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Reset / Rewind */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onReset}
            className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Rewind to Journey Start"
          >
            <RotateCcw className="size-3.5" />
          </Button>

          {/* Step Back */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}
            disabled={currentIndex <= 0}
            className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Step Backward (Left Arrow)"
          >
            <SkipBack className="size-3.5" />
          </Button>

          {/* Primary Play / Pause Button */}
          <Button
            variant="default"
            size="sm"
            onClick={onTogglePlay}
            className="h-8 px-3.5 rounded-full font-semibold gap-1.5 cursor-pointer shadow-md"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <>
                <Pause className="size-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="size-3.5 fill-current ml-0.5" />
                <span>Play</span>
              </>
            )}
          </Button>

          {/* Step Forward */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onIndexChange(Math.min(totalPoints - 1, currentIndex + 1))}
            disabled={currentIndex >= totalPoints - 1}
            className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Step Forward (Right Arrow)"
          >
            <SkipForward className="size-3.5" />
          </Button>
        </div>

        {/* Speed multiplier selector */}
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/50 text-[11px]">
          {speeds.map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => onChangeSpeed(spd)}
              className={cn(
                'px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer',
                playbackSpeed === spd
                  ? 'bg-background text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Point Index Counter */}
        <div className="text-right tabular-nums text-xs font-medium text-muted-foreground">
          <span className="text-foreground font-semibold">{currentIndex + 1}</span>
          <span className="text-[11px] opacity-75"> / {totalPoints}</span>
        </div>
      </div>
    </div>
  )
}
