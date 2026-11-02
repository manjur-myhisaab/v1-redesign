import React, { useState, useMemo, useEffect } from 'react'
import {
  Search,
  Calendar as CalendarIcon,
  Users,
  Layers,
  Clock,
  CalendarDays,
  X,
  Plus,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

interface BulkShiftUpdateModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    employees: string[]
    shifts: string[]
    dateRange: { start: Date; end: Date }
    dates: Date[]
    selectionMode: 'single' | 'range' | 'multiple'
  }) => Promise<void>
  categoryOptions: Array<{ label: string; value: string }>
  employeeOptions: Array<{ label: string; value: string; categoryId?: string }>
  shiftOptions: Array<{ label: string; value: string }>
  initialCategories?: string[]
  initialEmployees?: string[]
  initialShifts?: string[]
  initialDateRange?: { start: Date; end: Date }
  initialSelectionMode?: 'single' | 'range' | 'multiple'
}

const toInputDate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const fromInputDate = (str: string) => {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const BulkShiftUpdateModal: React.FC<BulkShiftUpdateModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  categoryOptions,
  employeeOptions,
  shiftOptions,
  initialCategories = [],
  initialEmployees = [],
  initialShifts = [],
  initialDateRange = { start: new Date(), end: new Date() },
  initialSelectionMode = 'single',
}) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategories)
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>(initialEmployees)
  const [selectedShifts, setSelectedShifts] = useState<string[]>(initialShifts)
  const [selectionMode, setSelectionMode] = useState<'single' | 'range' | 'multiple'>(
    initialSelectionMode
  )

  // Single date state
  const [singleDate, setSingleDate] = useState<Date>(initialDateRange.start)

  // Date range state
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(initialDateRange)
  const [calendarRange, setCalendarRange] = useState<
    { from: Date | undefined; to?: Date | undefined } | undefined
  >({
    from: initialDateRange.start,
    to: initialDateRange.end,
  })

  // Multiple dates state
  const [multipleDates, setMultipleDates] = useState<Date[]>([initialDateRange.start])

  const [catSearch, setCatSearch] = useState('')
  const [empSearch, setEmpSearch] = useState('')
  const [shiftSearch, setShiftSearch] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [datePopoverOpen, setDatePopoverOpen] = useState(false)

  // Sync state when modal opens or initial values change
  useEffect(() => {
    if (isOpen) {
      setSelectedCategories(initialCategories)
      setSelectedEmployees(initialEmployees)
      setSelectedShifts(initialShifts)
      setSelectionMode(initialSelectionMode)

      setSingleDate(initialDateRange.start)
      setDateRange(initialDateRange)
      setCalendarRange({ from: initialDateRange.start, to: initialDateRange.end })
      setMultipleDates([initialDateRange.start])

      setCatSearch('')
      setEmpSearch('')
      setShiftSearch('')
    }
  }, [
    isOpen,
    initialCategories,
    initialEmployees,
    initialShifts,
    initialDateRange,
    initialSelectionMode,
  ])

  // Filter categories by search
  const filteredCategories = useMemo(
    () => categoryOptions.filter((c) => c.label.toLowerCase().includes(catSearch.toLowerCase())),
    [categoryOptions, catSearch]
  )

  // Filter employees based on selected categories (Exact V1 logic) and search query
  const availableEmployees = useMemo(() => {
    if (selectedCategories.length === 0) {
      return employeeOptions
    }
    return employeeOptions.filter((emp) =>
      emp.categoryId ? selectedCategories.includes(String(emp.categoryId)) : true
    )
  }, [employeeOptions, selectedCategories])

  const filteredEmployees = useMemo(
    () => availableEmployees.filter((e) => e.label.toLowerCase().includes(empSearch.toLowerCase())),
    [availableEmployees, empSearch]
  )

  // Filter shifts by search
  const filteredShifts = useMemo(
    () => shiftOptions.filter((s) => s.label.toLowerCase().includes(shiftSearch.toLowerCase())),
    [shiftOptions, shiftSearch]
  )

  const handleSelectAll = (
    allValues: string[],
    currentSelected: string[],
    setter: (vals: string[]) => void
  ) => {
    const allInCurrent = allValues.every((val) => currentSelected.includes(val))
    if (allInCurrent) {
      setter(currentSelected.filter((val) => !allValues.includes(val)))
    } else {
      const merged = Array.from(new Set([...currentSelected, ...allValues]))
      setter(merged)
    }
  }

  const toggleValue = (current: string[], value: string, setter: (vals: string[]) => void) => {
    if (current.includes(value)) {
      setter(current.filter((v) => v !== value))
    } else {
      setter([...current, value])
    }
  }

  // Remove individual date in multiple dates mode
  const removeMultipleDate = (targetDate: Date) => {
    const targetStr = toInputDate(targetDate)
    setMultipleDates((prev) => prev.filter((d) => toInputDate(d) !== targetStr))
  }

  // Calculate computed dates list based on mode
  const computedDates = useMemo<Date[]>(() => {
    if (selectionMode === 'single') {
      return [singleDate]
    }
    if (selectionMode === 'range') {
      const list: Date[] = []
      const curr = new Date(dateRange.start)
      const end = new Date(dateRange.end)
      // Normalize times
      curr.setHours(0, 0, 0, 0)
      end.setHours(0, 0, 0, 0)
      while (curr <= end) {
        list.push(new Date(curr))
        curr.setDate(curr.getDate() + 1)
      }
      return list
    }
    if (selectionMode === 'multiple') {
      return [...multipleDates].sort((a, b) => a.getTime() - b.getTime())
    }
    return []
  }, [selectionMode, singleDate, dateRange, multipleDates])

  const handleFormSubmit = async () => {
    if (selectedEmployees.length === 0 || selectedShifts.length === 0 || computedDates.length === 0) {
      return
    }
    setIsSubmitting(true)
    try {
      await onSubmit({
        employees: selectedEmployees,
        shifts: selectedShifts,
        dateRange:
          selectionMode === 'single'
            ? { start: singleDate, end: singleDate }
            : selectionMode === 'range'
            ? dateRange
            : {
                start: computedDates[0] || new Date(),
                end: computedDates[computedDates.length - 1] || new Date(),
              },
        dates: computedDates,
        selectionMode,
      })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const formattedDateSummary = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
    if (selectionMode === 'single') {
      return singleDate.toLocaleDateString('en-GB', opts)
    }
    if (selectionMode === 'range') {
      return `${dateRange.start.toLocaleDateString('en-GB', opts)} - ${dateRange.end.toLocaleDateString('en-GB', opts)} (${computedDates.length} days)`
    }
    return `${multipleDates.length} date${multipleDates.length !== 1 ? 's' : ''} selected`
  }, [selectionMode, singleDate, dateRange, multipleDates, computedDates])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl md:max-w-6xl w-full max-h-[92vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Bulk Monthly Shift Update
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Assign or update shifts for single or multiple employees across specific dates.
          </p>
        </DialogHeader>

        {/* 4-column spacious grid matching larger modal requirements */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-4 flex-1 min-h-0 overflow-y-auto">
          {/* 1. Category Column */}
          <div className="flex flex-col border border-border/80 rounded-xl p-3 bg-muted/20 space-y-2.5">
            <div className="flex items-center justify-between gap-1 pb-1 border-b border-border/40">
              <span className="text-xs font-semibold flex items-center gap-1.5 truncate">
                <Layers className="size-3.5 text-primary" />
                Categories ({selectedCategories.length})
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px] text-primary shrink-0 hover:bg-primary/10"
                onClick={() =>
                  handleSelectAll(
                    categoryOptions.map((c) => c.value),
                    selectedCategories,
                    setSelectedCategories
                  )
                }
              >
                {selectedCategories.length === categoryOptions.length && categoryOptions.length > 0
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search categories..."
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>
            <div className="flex-1 min-h-[220px] max-h-[280px] overflow-y-auto space-y-1 pr-1">
              {filteredCategories.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 text-center">No categories found</p>
              ) : (
                filteredCategories.map((cat) => (
                  <label
                    key={cat.value}
                    className="flex items-center gap-2 p-1.5 hover:bg-muted/80 rounded-md text-xs cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedCategories.includes(cat.value)}
                      onCheckedChange={() =>
                        toggleValue(selectedCategories, cat.value, setSelectedCategories)
                      }
                    />
                    <span className="truncate">{cat.label}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* 2. Employee Column */}
          <div className="flex flex-col border border-border/80 rounded-xl p-3 bg-muted/20 space-y-2.5">
            <div className="flex items-center justify-between gap-1 pb-1 border-b border-border/40">
              <span className="text-xs font-semibold flex items-center gap-1.5 truncate">
                <Users className="size-3.5 text-primary" />
                Employees ({selectedEmployees.length})
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px] text-primary shrink-0 hover:bg-primary/10"
                onClick={() =>
                  handleSelectAll(
                    availableEmployees.map((e) => e.value),
                    selectedEmployees,
                    setSelectedEmployees
                  )
                }
              >
                {selectedEmployees.length === availableEmployees.length && availableEmployees.length > 0
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>
            <div className="flex-1 min-h-[220px] max-h-[280px] overflow-y-auto space-y-1 pr-1">
              {filteredEmployees.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 text-center">No employees found</p>
              ) : (
                filteredEmployees.map((emp) => (
                  <label
                    key={emp.value}
                    className="flex items-center gap-2 p-1.5 hover:bg-muted/80 rounded-md text-xs cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedEmployees.includes(emp.value)}
                      onCheckedChange={() =>
                        toggleValue(selectedEmployees, emp.value, setSelectedEmployees)
                      }
                    />
                    <span className="truncate">{emp.label}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* 3. Shifts Column */}
          <div className="flex flex-col border border-border/80 rounded-xl p-3 bg-muted/20 space-y-2.5">
            <div className="flex items-center justify-between gap-1 pb-1 border-b border-border/40">
              <span className="text-xs font-semibold flex items-center gap-1.5 truncate">
                <Clock className="size-3.5 text-primary" />
                Shifts ({selectedShifts.length})
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px] text-primary shrink-0 hover:bg-primary/10"
                onClick={() =>
                  handleSelectAll(
                    shiftOptions.map((s) => s.value),
                    selectedShifts,
                    setSelectedShifts
                  )
                }
              >
                {selectedShifts.length === shiftOptions.length && shiftOptions.length > 0
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search shifts..."
                value={shiftSearch}
                onChange={(e) => setShiftSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>
            <div className="flex-1 min-h-[220px] max-h-[280px] overflow-y-auto space-y-1 pr-1">
              {filteredShifts.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 text-center">No shifts found</p>
              ) : (
                filteredShifts.map((shift) => (
                  <label
                    key={shift.value}
                    className="flex items-center gap-2 p-1.5 hover:bg-muted/80 rounded-md text-xs cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedShifts.includes(shift.value)}
                      onCheckedChange={() =>
                        toggleValue(selectedShifts, shift.value, setSelectedShifts)
                      }
                    />
                    <span
                      className={cn(
                        'truncate',
                        shift.value === '0' &&
                          'text-emerald-600 font-semibold dark:text-emerald-400'
                      )}
                    >
                      {shift.label}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* 4. Date Settings Column with Single, Range & Multiple Dates support */}
          <div className="flex flex-col border border-border/80 rounded-xl p-3 bg-muted/20 space-y-3">
            {/* Selection Mode Dropdown */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <CalendarDays className="size-3.5 text-primary" />
                Selection Mode
              </span>
              <Select
                value={selectionMode}
                onValueChange={(val: 'single' | 'range' | 'multiple') => {
                  setSelectionMode(val)
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single" className="text-xs">
                    Single Date
                  </SelectItem>
                  <SelectItem value="range" className="text-xs">
                    Date Range (From - To)
                  </SelectItem>
                  <SelectItem value="multiple" className="text-xs">
                    Multiple Dates
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mode 1: Single Date */}
            {selectionMode === 'single' && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-foreground">Pick Date</span>
                <div className="flex gap-1.5">
                  <Input
                    type="date"
                    value={toInputDate(singleDate)}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSingleDate(fromInputDate(e.target.value))
                      }
                    }}
                    className="h-8 text-xs bg-background flex-1"
                  />
                  <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0 bg-background"
                      >
                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border border-border shadow-md" align="end">
                      <Calendar
                        mode="single"
                        selected={singleDate}
                        onSelect={(day) => {
                          if (day) {
                            setSingleDate(day)
                            setDatePopoverOpen(false)
                          }
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Mode 2: Date Range */}
            {selectionMode === 'range' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Date Range</span>
                  <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[11px] gap-1 bg-background text-primary hover:bg-primary/10"
                      >
                        <CalendarIcon className="h-3 w-3" />
                        Pick on Calendar
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3 border border-border shadow-md" align="end">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold px-1">
                          Click start date then end date:
                        </p>
                        <Calendar
                          mode="range"
                          selected={calendarRange}
                          onSelect={(newRange) => {
                            setCalendarRange(newRange)
                            if (newRange?.from && newRange?.to) {
                              setDateRange({ start: newRange.from, end: newRange.to })
                            } else if (newRange?.from) {
                              setDateRange({ start: newRange.from, end: newRange.from })
                            }
                          }}
                        />
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <span className="text-[11px] text-muted-foreground">
                            {calendarRange?.from && calendarRange?.to
                              ? `${calendarRange.from.toLocaleDateString()} - ${calendarRange.to.toLocaleDateString()}`
                              : 'Select range...'}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setDatePopoverOpen(false)}
                          >
                            Apply
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">From Date</label>
                    <Input
                      type="date"
                      value={toInputDate(dateRange.start)}
                      onChange={(e) => {
                        if (e.target.value) {
                          const newStart = fromInputDate(e.target.value)
                          setDateRange((prev) => ({
                            start: newStart,
                            end: newStart > prev.end ? newStart : prev.end,
                          }))
                          setCalendarRange((prev) => ({
                            from: newStart,
                            to: prev?.to && newStart > prev.to ? newStart : prev?.to,
                          }))
                        }
                      }}
                      className="h-8 text-xs bg-background"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">To Date</label>
                    <Input
                      type="date"
                      value={toInputDate(dateRange.end)}
                      min={toInputDate(dateRange.start)}
                      onChange={(e) => {
                        if (e.target.value) {
                          const newEnd = fromInputDate(e.target.value)
                          setDateRange((prev) => ({
                            start: prev.start,
                            end: newEnd,
                          }))
                          setCalendarRange((prev) => ({
                            from: prev?.from,
                            to: newEnd,
                          }))
                        }
                      }}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Mode 3: Multiple Dates */}
            {selectionMode === 'multiple' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    Selected Dates ({multipleDates.length})
                  </span>
                  <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[11px] gap-1 bg-background text-primary hover:bg-primary/10"
                      >
                        <Plus className="h-3 w-3" />
                        Add Dates
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3 border border-border shadow-md" align="end">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold px-1">
                          Click days on calendar to add or remove:
                        </p>
                        <Calendar
                          mode="multiple"
                          selected={multipleDates}
                          onSelect={(dates) => {
                            setMultipleDates(dates || [])
                          }}
                        />
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <span className="text-[11px] text-muted-foreground">
                            {multipleDates.length} date{multipleDates.length !== 1 ? 's' : ''} selected
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setDatePopoverOpen(false)}
                          >
                            Done
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Multiple date pills / chips */}
                <div className="max-h-36 overflow-y-auto flex flex-wrap gap-1 p-2 rounded-lg bg-background border border-border/60">
                  {multipleDates.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground py-2 text-center w-full">
                      No dates selected. Click "Add Dates" above to pick.
                    </p>
                  ) : (
                    computedDates.map((d) => (
                      <Badge
                        key={toInputDate(d)}
                        variant="secondary"
                        className="text-[10px] gap-1 pl-2 pr-1 py-0.5"
                      >
                        <span>
                          {d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeMultipleDate(d)}
                          className="hover:bg-muted rounded p-0.5 cursor-pointer"
                        >
                          <X className="size-2.5" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>

                {multipleDates.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setMultipleDates([])}
                    className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Clear all dates
                  </Button>
                )}
              </div>
            )}

            {/* Summary Box */}
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/60 text-[11px] text-muted-foreground space-y-1 mt-auto">
              <p className="font-medium text-foreground">Summary:</p>
              <p>
                Employees:{' '}
                <span className="font-semibold text-foreground">
                  {selectedEmployees.length}
                </span>
              </p>
              <p>
                Shifts:{' '}
                <span className="font-semibold text-foreground">
                  {selectedShifts.length}
                </span>
              </p>
              <p className="truncate">
                Dates:{' '}
                <span className="font-semibold text-foreground">
                  {formattedDateSummary}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Footer with clean gap between buttons */}
        <DialogFooter className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 text-xs h-9 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleFormSubmit}
            disabled={
              isSubmitting ||
              selectedEmployees.length === 0 ||
              selectedShifts.length === 0 ||
              computedDates.length === 0
            }
            className="px-4 text-xs h-9 cursor-pointer"
          >
            {isSubmitting
              ? 'Updating Shifts...'
              : `Update Shifts (${computedDates.length} Day${computedDates.length !== 1 ? 's' : ''})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
