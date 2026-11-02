import React, { useState, useMemo } from 'react'
import { CalendarDays, Calendar as CalendarIcon, Check } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { DateSelectionMode } from '../../types'

interface ReportDateSelectorProps {
  supportedModes: DateSelectionMode[]
  currentMode: DateSelectionMode
  onModeChange: (mode: DateSelectionMode) => void
  singleDate: string
  onSingleDateChange: (date: string) => void
  selectedMonth: string
  onSelectedMonthChange: (month: string) => void
  selectedYear: string
  onSelectedYearChange: (year: string) => void
  startDate: string
  endDate: string
  onRangeChange: (start: string, end: string) => void
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

// Safe local date to YYYY-MM-DD (immune to UTC offset shifts)
function formatDateToYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Display date string in UK format (e.g., 02 Nov 2026)
function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3) return dateStr
  const [y, m, d] = parts
  const dateObj = new Date(y, m - 1, d)
  return dateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export const ReportDateSelector: React.FC<ReportDateSelectorProps> = ({
  supportedModes,
  currentMode,
  onModeChange,
  singleDate,
  onSingleDateChange,
  selectedMonth,
  onSelectedMonthChange,
  selectedYear,
  onSelectedYearChange,
  startDate,
  endDate,
  onRangeChange,
}) => {
  const currentYearNum = new Date().getFullYear()
  const years = Array.from({ length: 6 }, (_, i) => String(currentYearNum - 3 + i))

  // Popover open states
  const [singlePopoverOpen, setSinglePopoverOpen] = useState(false)
  const [rangePopoverOpen, setRangePopoverOpen] = useState(false)

  // Single date object
  const singleDateObj = useMemo(() => {
    if (!singleDate) return undefined
    const parts = singleDate.split('-').map(Number)
    if (parts.length !== 3) return undefined
    return new Date(parts[0], parts[1] - 1, parts[2])
  }, [singleDate])

  const handleSingleSelect = (d: Date | undefined) => {
    if (!d) return
    onSingleDateChange(formatDateToYMD(d))
    setSinglePopoverOpen(false)
  }

  // Parse current startDate and endDate into DateRange
  const selectedRange: DateRange | undefined = useMemo(() => {
    if (!startDate && !endDate) return undefined
    let from: Date | undefined
    let to: Date | undefined
    if (startDate) {
      const p = startDate.split('-').map(Number)
      if (p.length === 3) from = new Date(p[0], p[1] - 1, p[2])
    }
    if (endDate) {
      const p = endDate.split('-').map(Number)
      if (p.length === 3) to = new Date(p[0], p[1] - 1, p[2])
    }
    return { from, to }
  }, [startDate, endDate])

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (!range) return
    const fromStr = range.from ? formatDateToYMD(range.from) : ''
    const toStr = range.to ? formatDateToYMD(range.to) : fromStr
    onRangeChange(fromStr, toStr)
  }

  // Quick range presets
  const setPreset = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days + 1)
    onRangeChange(formatDateToYMD(start), formatDateToYMD(end))
  }

  const setThisMonthPreset = () => {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    onRangeChange(formatDateToYMD(first), formatDateToYMD(now))
  }

  const setLastMonthPreset = () => {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last = new Date(now.getFullYear(), now.getMonth(), 0)
    onRangeChange(formatDateToYMD(first), formatDateToYMD(last))
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-card p-3.5 shadow-2xs">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
          <CalendarDays className="size-3.5 text-primary" />
          Period & Range
        </label>
      </div>

      {/* Mode Selector Tabs (only shown if more than 1 mode supported) */}
      {supportedModes.length > 1 && (
        <div className="flex items-center rounded-lg bg-muted/70 p-0.5 text-xs">
          {supportedModes.includes('singleDate') && (
            <button
              type="button"
              onClick={() => onModeChange('singleDate')}
              className={cn(
                'flex-1 py-1 rounded-md text-[11px] font-medium transition-all text-center cursor-pointer',
                currentMode === 'singleDate'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Single Date
            </button>
          )}
          {supportedModes.includes('fixed') && (
            <button
              type="button"
              onClick={() => onModeChange('fixed')}
              className={cn(
                'flex-1 py-1 rounded-md text-[11px] font-medium transition-all text-center cursor-pointer',
                currentMode === 'fixed'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Month Selection
            </button>
          )}
          {supportedModes.includes('range') && (
            <button
              type="button"
              onClick={() => onModeChange('range')}
              className={cn(
                'flex-1 py-1 rounded-md text-[11px] font-medium transition-all text-center cursor-pointer',
                currentMode === 'range'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Date Range
            </button>
          )}
        </div>
      )}

      {/* Shadcn UI inputs based on current active mode */}
      <div className="pt-0.5">
        {/* 1. Single Date Mode (Shadcn DatePicker) */}
        {currentMode === 'singleDate' && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Select Attendance Date</span>
            <Popover open={singlePopoverOpen} onOpenChange={setSinglePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left text-xs h-8.5 font-normal bg-background cursor-pointer border-input',
                    !singleDate && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 size-3.5 text-primary" />
                  {singleDate ? (
                    <span>{formatDisplayDate(singleDate)}</span>
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={singleDateObj}
                  onSelect={handleSingleSelect}
                  defaultMonth={singleDateObj || new Date()}
                  autoFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* 2. Fixed Month Mode (Shadcn Select) */}
        {currentMode === 'fixed' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="block text-[11px] font-medium text-muted-foreground">Month</span>
              <Select value={selectedMonth} onValueChange={onSelectedMonthChange}>
                <SelectTrigger className="h-8.5 text-xs bg-background cursor-pointer">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, idx) => (
                    <SelectItem key={m} value={String(idx + 1)} className="text-xs cursor-pointer">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="block text-[11px] font-medium text-muted-foreground">Year</span>
              <Select value={selectedYear} onValueChange={onSelectedYearChange}>
                <SelectTrigger className="h-8.5 text-xs bg-background cursor-pointer">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y} className="text-xs cursor-pointer">
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* 3. Range Mode (Shadcn Date Range Picker) */}
        {currentMode === 'range' && (
          <div className="space-y-2">
            <span className="block text-[11px] font-medium text-muted-foreground">
              Select Date Range
            </span>
            <Popover open={rangePopoverOpen} onOpenChange={setRangePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left text-xs h-8.5 font-normal bg-background cursor-pointer border-input',
                    (!startDate || !endDate) && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 size-3.5 text-primary" />
                  {startDate && endDate ? (
                    <span>
                      {formatDisplayDate(startDate)} – {formatDisplayDate(endDate)}
                    </span>
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-2.5 border-b border-border/60 flex items-center gap-1.5 flex-wrap bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setPreset(7)}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-background border border-border hover:bg-muted text-foreground cursor-pointer transition-colors"
                  >
                    Last 7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreset(15)}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-background border border-border hover:bg-muted text-foreground cursor-pointer transition-colors"
                  >
                    Last 15 Days
                  </button>
                  <button
                    type="button"
                    onClick={setThisMonthPreset}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-background border border-border hover:bg-muted text-foreground cursor-pointer transition-colors"
                  >
                    This Month
                  </button>
                  <button
                    type="button"
                    onClick={setLastMonthPreset}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-background border border-border hover:bg-muted text-foreground cursor-pointer transition-colors"
                  >
                    Last Month
                  </button>
                </div>
                <Calendar
                  mode="range"
                  defaultMonth={selectedRange?.from || new Date()}
                  selected={selectedRange}
                  onSelect={handleRangeSelect}
                  numberOfMonths={1}
                />
                <div className="p-2 border-t border-border flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => setRangePopoverOpen(false)}
                    className="h-7 text-xs px-2.5 cursor-pointer"
                  >
                    <Check className="size-3 mr-1" />
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>
    </div>
  )
}
