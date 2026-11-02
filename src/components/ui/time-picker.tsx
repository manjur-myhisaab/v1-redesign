import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface TimePickerProps {
  value?: string // "HH:mm" e.g. "09:00" or "18:00"
  onChange?: (time: string) => void
  placeholder?: string
  className?: string
  inline?: boolean
}

// Convert "18:30" -> { hour12: "06", minute: "30", period: "PM" }
function parseTime(timeStr?: string) {
  if (!timeStr) return { hour: '09', minute: '00', period: 'AM', hour12: '09' }
  const [hStr, mStr] = timeStr.split(':')
  let h = parseInt(hStr || '9', 10)
  if (isNaN(h)) h = 9
  const period = h >= 12 ? 'PM' : 'AM'
  let h12 = h % 12
  if (h12 === 0) h12 = 12
  const h12Str = String(h12).padStart(2, '0')
  const m = mStr ? mStr.substring(0, 2) : '00'
  return {
    hour: String(h).padStart(2, '0'),
    minute: m,
    period,
    hour12: h12Str,
  }
}

// Convert 12h + AM/PM -> "HH:mm" (24h)
function format24h(h12: string, min: string, period: string): string {
  let h = parseInt(h12, 10)
  if (period === 'PM' && h < 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${min.padStart(2, '0')}`
}

function formatDisplay(timeStr?: string): string {
  if (!timeStr) return 'Select time'
  const { hour12, minute, period } = parseTime(timeStr)
  return `${hour12}:${minute} ${period}`
}

const POPULAR_PRESETS = [
  '09:00',
  '09:30',
  '10:00',
  '13:00',
  '14:00',
  '17:00',
  '18:00',
  '18:30',
  '19:00',
  '22:00',
]

export function TimePicker({
  value = '09:00',
  onChange,
  placeholder = 'Select time',
  className,
  inline = false,
}: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const [internalVal, setInternalVal] = useState(value)

  useEffect(() => {
    setInternalVal(value)
  }, [value])

  const parsed = parseTime(internalVal)

  const handleHourChange = (h12: string) => {
    const new24 = format24h(h12, parsed.minute, parsed.period)
    setInternalVal(new24)
    onChange?.(new24)
  }

  const handleMinChange = (min: string) => {
    const new24 = format24h(parsed.hour12, min, parsed.period)
    setInternalVal(new24)
    onChange?.(new24)
  }

  const handlePeriodChange = (period: 'AM' | 'PM') => {
    const new24 = format24h(parsed.hour12, parsed.minute, period)
    setInternalVal(new24)
    onChange?.(new24)
  }

  const timeContent = (
    <div
      className="space-y-3"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-border pb-2">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Clock className="size-3.5 text-primary" />
          Pick Time
        </span>
        <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
          {formatDisplay(internalVal)} ({internalVal})
        </span>
      </div>

      {/* Hour, Minute, Period Selectors */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {/* Hours */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Hour</label>
          <div className="max-h-36 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {['12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'].map((h) => {
              const active = parsed.hour12 === h
              return (
                <button
                  key={h}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleHourChange(h)
                  }}
                  className={cn(
                    'w-full py-1 text-xs font-medium transition-colors hover:bg-muted',
                    active && 'bg-primary text-primary-foreground font-semibold',
                  )}
                >
                  {h}
                </button>
              )
            })}
          </div>
        </div>

        {/* Minutes */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Minute</label>
          <div className="max-h-36 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => {
              const active = parsed.minute === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMinChange(m)
                  }}
                  className={cn(
                    'w-full py-1 text-xs font-medium transition-colors hover:bg-muted',
                    active && 'bg-primary text-primary-foreground font-semibold',
                  )}
                >
                  {m}
                </button>
              )
            })}
          </div>
        </div>

        {/* Period */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">AM / PM</label>
          <div className="flex flex-col gap-1.5 pt-1">
            {(['AM', 'PM'] as const).map((p) => {
              const active = parsed.period === p
              return (
                <button
                  key={p}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePeriodChange(p)
                  }}
                  className={cn(
                    'w-full py-2 rounded-lg border border-border text-xs font-semibold transition-all',
                    active
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-background hover:bg-muted text-muted-foreground',
                  )}
                >
                  {p}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Presets */}
      <div className="border-t border-border pt-2 space-y-1">
        <span className="text-[10px] font-semibold text-muted-foreground block uppercase">Quick Presets</span>
        <div className="flex flex-wrap gap-1">
          {POPULAR_PRESETS.map((preset) => {
            const active = internalVal === preset
            return (
              <button
                key={preset}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setInternalVal(preset)
                  onChange?.(preset)
                  setOpen(false)
                }}
                className={cn(
                  'rounded-md px-2 py-0.5 text-[11px] font-medium transition-all',
                  active
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                )}
              >
                {formatDisplay(preset)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Precise Native Time fallback */}
      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="text-[11px] text-muted-foreground">Exact 24h:</span>
        <input
          type="time"
          value={internalVal}
          onChange={(e) => {
            setInternalVal(e.target.value)
            onChange?.(e.target.value)
          }}
          className="rounded border border-border bg-background px-2 py-0.5 text-xs outline-none focus:border-primary"
        />
      </div>
    </div>
  )

  if (inline) {
    return (
      <div className={cn('w-72 p-3 rounded-xl border border-border bg-popover shadow-2xl text-foreground', className)}>
        {timeContent}
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-empty={!value}
          className={cn(
            'w-full justify-start text-left font-normal border-border bg-background hover:bg-muted/50 data-[empty=true]:text-muted-foreground',
            className,
          )}
        >
          <Clock className="mr-2 size-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium">{value ? formatDisplay(value) : placeholder}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-3 space-y-3" align="start">
        {timeContent}
      </PopoverContent>
    </Popover>
  )
}
