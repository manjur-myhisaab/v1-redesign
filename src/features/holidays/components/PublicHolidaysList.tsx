import * as React from 'react'
import {
  Search,
  CalendarDays,
  Globe2,
  CheckCircle2,
  PlusCircle,
  Loader2,
  CheckCheck,
  X,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  getHolidayId,
  getHolidayName,
  getHolidayRawDate,
  parseHolidayDate,
  getHolidayTypeConfig,
} from '../lib/holidayUtils'
import type { PublicHoliday, PublicHolidayData } from '../api/holidaysApi.types'

interface PublicHolidaysListProps {
  data: PublicHolidayData | null
  isLoading: boolean
  onAddHolidayToFirm?: (holiday: PublicHoliday) => void
  onBulkAddHolidays?: (holidays: PublicHoliday[]) => Promise<any>
  isBulkAdding?: boolean
  isAlreadyAdded?: (holidayName: string, date: string) => boolean
}

export function PublicHolidaysList({
  data,
  isLoading,
  onAddHolidayToFirm,
  onBulkAddHolidays,
  isBulkAdding = false,
  isAlreadyAdded,
}: PublicHolidaysListProps) {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedMonth, setSelectedMonth] = React.useState<string>('all')
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set())

  const holidays = data?.holidays || []

  // Month options derived from dates
  const months = [
    { value: 'all', label: 'All Months' },
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ]

  const getHolidayKey = React.useCallback((h: PublicHoliday, index: number) => {
    return h.id || `${getHolidayName(h)}_${getHolidayRawDate(h)}` || `pub_${index}`
  }, [])

  const filteredHolidays = React.useMemo(() => {
    return holidays.filter((h) => {
      const name = getHolidayName(h)
      const rawDate = getHolidayRawDate(h)
      const dt = parseHolidayDate(rawDate)

      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rawDate.includes(searchQuery) ||
        dt.full.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false

      if (selectedMonth !== 'all') {
        return dt.monthNum === selectedMonth
      }
      return true
    })
  }, [holidays, searchQuery, selectedMonth])

  // Filter available holidays that aren't already in firm
  const availableHolidays = React.useMemo(() => {
    return filteredHolidays.filter((h) => {
      const holidayName = getHolidayName(h)
      const rawDate = getHolidayRawDate(h)
      return !isAlreadyAdded || !isAlreadyAdded(holidayName, rawDate)
    })
  }, [filteredHolidays, isAlreadyAdded])

  const isAllAvailableSelected =
    availableHolidays.length > 0 &&
    availableHolidays.every((h, idx) => selectedKeys.has(getHolidayKey(h, idx)))

  const handleToggleSelectAll = () => {
    if (isAllAvailableSelected) {
      // Deselect all
      setSelectedKeys(new Set())
    } else {
      // Select all available visible
      const next = new Set(selectedKeys)
      availableHolidays.forEach((h, idx) => next.add(getHolidayKey(h, idx)))
      setSelectedKeys(next)
    }
  }

  const handleToggleHoliday = (key: string) => {
    const next = new Set(selectedKeys)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    setSelectedKeys(next)
  }

  const handleBulkSubmit = async () => {
    if (!onBulkAddHolidays || selectedKeys.size === 0) return
    const selectedList = holidays.filter((h, idx) => selectedKeys.has(getHolidayKey(h, idx)))
    try {
      await onBulkAddHolidays(selectedList)
      setSelectedKeys(new Set())
    } catch (err) {
      console.error('Bulk add error:', err)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* Header Banner */}
      <div className="border-b border-border bg-muted/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe2 className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  Public Holidays
                </h3>
                {data?.country_code && (
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wider">
                    {data.country_code}
                  </Badge>
                )}
              </div>
              <p className="text-[12px] text-muted-foreground">
                {data?.calendar || 'Official Calendar'} • {data?.year || new Date().getFullYear()} ({holidays.length} Total)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
              {filteredHolidays.length} visible
            </span>
          </div>
        </div>

        {/* Search & Month Filter */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search public holidays (e.g. Diwali, Eid)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8.5 bg-background pl-8 text-[13px]"
            />
          </div>
          <div className="w-36">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-8.5 bg-background text-[12px]">
                <SelectValue placeholder="All Months" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-[12px]">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Selection / Quick Action Bar */}
        {onBulkAddHolidays && availableHolidays.length > 0 && (
          <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-border/60 text-[12px]">
            <label className="flex items-center gap-2 cursor-pointer select-none text-muted-foreground hover:text-foreground">
              <Checkbox
                checked={isAllAvailableSelected}
                onCheckedChange={handleToggleSelectAll}
              />
              <span className="font-medium">
                Select All ({availableHolidays.length} available)
              </span>
            </label>

            {selectedKeys.size > 0 && (
              <span className="text-primary font-semibold text-[11.5px]">
                {selectedKeys.size} selected
              </span>
            )}
          </div>
        )}
      </div>

      {/* Floating / Sticky Bulk Action Banner when items are selected */}
      {onBulkAddHolidays && selectedKeys.size > 0 && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5 flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs">
              {selectedKeys.size}
            </div>
            <span className="text-[12.5px] font-medium text-foreground truncate">
              {selectedKeys.size} public {selectedKeys.size === 1 ? 'holiday' : 'holidays'} selected
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedKeys(new Set())}
              disabled={isBulkAdding}
              className="h-7.5 px-2 text-[12px] text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5 mr-1" />
              Clear
            </Button>

            <Button
              size="sm"
              onClick={handleBulkSubmit}
              disabled={isBulkAdding}
              className="h-7.5 gap-1.5 btn-3d bg-primary text-primary-foreground hover:bg-primary/90 text-[12px] font-medium rounded-lg"
            >
              {isBulkAdding ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <CheckCheck className="size-3.5" />
                  Add to Firm Calendar ({selectedKeys.size})
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Holidays List */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-[13px]">Fetching public holidays...</span>
          </div>
        ) : filteredHolidays.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <CalendarDays className="size-8 opacity-40" />
            <p className="text-[13px] font-medium">No public holidays found</p>
            <p className="text-[12px] text-muted-foreground/80">Try adjusting your search query or month filter.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredHolidays.map((holiday, idx) => {
              const holidayId = getHolidayId(holiday) || `pub-hol-${idx}`
              const holidayKey = getHolidayKey(holiday, idx)
              const holidayName = getHolidayName(holiday)
              const rawDate = getHolidayRawDate(holiday)
              const dt = parseHolidayDate(rawDate)
              const rawType = holiday.holiday_type || (holiday as any).type || 'PUBLIC_HOLIDAY'
              const typeConfig = getHolidayTypeConfig(rawType)

              const isAdded = isAlreadyAdded ? isAlreadyAdded(holidayName, rawDate) : false
              const isSelected = selectedKeys.has(holidayKey)

              return (
                <div
                  key={holidayId}
                  className={cn(
                    'group relative flex items-center justify-between gap-3 rounded-lg border p-3 transition-all',
                    isSelected
                      ? 'border-primary/50 bg-primary/5 shadow-xs'
                      : 'border-border/80 bg-background/60 hover:border-primary/40 hover:bg-muted/30'
                  )}
                >
                  {/* Left: Checkbox & Date Block & Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Bulk Selection Checkbox */}
                    {onBulkAddHolidays && (
                      <div className="flex items-center shrink-0">
                        {isAdded ? (
                          <div className="size-4 rounded border border-muted-foreground/30 bg-muted/40 flex items-center justify-center opacity-40 cursor-not-allowed">
                            <CheckCircle2 className="size-3 text-muted-foreground" />
                          </div>
                        ) : (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleHoliday(holidayKey)}
                            aria-label={`Select ${holidayName}`}
                          />
                        )}
                      </div>
                    )}

                    {/* Calendar Badge */}
                    <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-muted/60 font-semibold shadow-xs">
                      <span className="text-[9px] uppercase tracking-wider text-primary font-bold">
                        {dt.month}
                      </span>
                      <span className="text-sm leading-none font-bold text-foreground">
                        {dt.day}
                      </span>
                    </div>

                    {/* Holiday Title & Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate text-[13px] font-medium text-foreground">
                          {holidayName}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 pt-0.5 text-[11.5px] text-muted-foreground">
                        <span>{dt.weekday ? `${dt.weekday}, ` : ''}{dt.full}</span>
                        <span>•</span>
                        <span className={cn('rounded px-1.5 py-0.2 text-[10px] font-medium border', typeConfig.tone)}>
                          {typeConfig.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions / Added Status */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {isAdded ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="size-3.5" />
                        In Firm
                      </span>
                    ) : onAddHolidayToFirm ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAddHolidayToFirm(holiday)}
                        className="h-8 gap-1 text-[12px] text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                        title="Add / Configure for firm"
                      >
                        <PlusCircle className="size-3.5" />
                        <span className="hidden sm:inline">Add</span>
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

