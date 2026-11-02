import React, { useState, useMemo } from 'react'
import { Search, Calendar as CalendarIcon, FileDown, Layers, Clock, CalendarDays } from 'lucide-react'
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

interface RosterReportModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    categories: string[]
    shifts: string[]
    selectionMode: 'month' | 'range'
    downloadMonth: string
    dateRange: { start: Date; end: Date }
  }) => Promise<void> | void
  categoryOptions: Array<{ label: string; value: string }>
  shiftOptions: Array<{ label: string; value: string }>
  monthOptions: Array<{ label: string; value: string }>
  currentMonth: string
}

export const RosterReportModal: React.FC<RosterReportModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  categoryOptions,
  shiftOptions,
  monthOptions,
  currentMonth,
}) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedShifts, setSelectedShifts] = useState<string[]>([])
  const [selectionMode, setSelectionMode] = useState<'month' | 'range'>('month')
  const [downloadMonth, setDownloadMonth] = useState<string>(currentMonth)
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(),
    end: new Date(),
  })

  const [catSearch, setCatSearch] = useState('')
  const [shiftSearch, setShiftSearch] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [datePopoverOpen, setDatePopoverOpen] = useState(false)

  // Reset/sync state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedCategories([])
      setSelectedShifts([])
      setSelectionMode('month')
      setDownloadMonth(currentMonth)
      setDateRange({ start: new Date(), end: new Date() })
      setCatSearch('')
      setShiftSearch('')
    }
  }, [isOpen, currentMonth])

  const filteredCategories = useMemo(
    () => categoryOptions.filter((c) => c.label.toLowerCase().includes(catSearch.toLowerCase())),
    [categoryOptions, catSearch]
  )

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

  const handleFormSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onSubmit({
        categories: selectedCategories,
        shifts: selectedShifts,
        selectionMode,
        downloadMonth,
        dateRange,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formattedDate = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
    return `${dateRange.start.toLocaleDateString('en-GB', opts)} - ${dateRange.end.toLocaleDateString('en-GB', opts)}`
  }, [dateRange])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl md:max-w-5xl w-full max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Download Roster Report
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Export monthly shifts as an Excel spreadsheet for reporting or bulk offline updates.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4 flex-1 min-h-0 overflow-y-auto">
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

          {/* 2. Shifts Column */}
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

          {/* 3. Export Period Settings */}
          <div className="flex flex-col border border-border/80 rounded-xl p-3 bg-muted/20 space-y-4">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <CalendarDays className="size-3.5 text-primary" />
                Download Period Mode
              </span>
              <Select
                value={selectionMode}
                onValueChange={(val: 'month' | 'range') => setSelectionMode(val)}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month" className="text-xs">
                    By Month
                  </SelectItem>
                  <SelectItem value="range" className="text-xs">
                    By Date Range
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectionMode === 'month' ? (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-foreground">Select Month</span>
                <Select value={downloadMonth} onValueChange={setDownloadMonth}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-xs">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-foreground">Select Date Range</span>
                <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left text-xs h-9 bg-background font-normal"
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{formattedDate}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border border-border shadow-md" align="start">
                    <Calendar
                      mode="range"
                      selected={{ from: dateRange.start, to: dateRange.end }}
                      onSelect={(range: any) => {
                        if (range?.from && range?.to) {
                          setDateRange({ start: range.from, end: range.to })
                          setDatePopoverOpen(false)
                        } else if (range?.from) {
                          setDateRange({ start: range.from, end: range.from })
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="p-3 rounded-lg bg-background/80 border border-border/60 text-[11px] text-muted-foreground space-y-1 mt-auto">
              <p className="font-medium text-foreground">Filter Summary:</p>
              <p>Categories: {selectedCategories.length === 0 ? 'All' : selectedCategories.length}</p>
              <p>Shifts: {selectedShifts.length === 0 ? 'All' : selectedShifts.length}</p>
              <p>Format: Microsoft Excel (.xlsx)</p>
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
            disabled={isSubmitting}
            className="gap-2 px-4 text-xs h-9 cursor-pointer"
          >
            <FileDown className="h-4 w-4" />
            {isSubmitting ? 'Downloading...' : 'Download Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
