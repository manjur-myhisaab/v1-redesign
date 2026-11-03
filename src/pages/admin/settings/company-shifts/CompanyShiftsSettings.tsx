import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Clock,
  Plus,
  Pencil,
  Trash2,
  Moon,
  Coffee,
  RefreshCw,
  Search,
  X,
  ArrowUpDown,
  Filter,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Timer,
  LogIn,
  LogOut,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useResizableColumns, ColumnResizer } from '@/hooks/useResizableColumns'
import rdk, { readItems, deleteItems } from '@/services/server'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { ShiftModal } from './ShiftModal'

export const CompanyShiftsSettings: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedShift, setSelectedShift] = useState<any | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [shiftToDelete, setShiftToDelete] = useState<any | null>(null)

  // Resizable columns
  const { colWidths, startResizing, isResizing } = useResizableColumns(
    {
      name: 240,
      timings: 200,
      punchWindow: 190,
      grace: 170,
      minHours: 190,
      penalties: 180,
      status: 110,
      actions: 90,
    },
    { storageKey: 'company_shifts_widths_v2', minWidth: 80 }
  )

  // Search, Filter, Sort & Pagination state
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [sortSelected, setSortSelected] = useState<string>('name asc')
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // 12-hour formatter for time strings like "09:00:00" or "09:00"
  function to12Hour(time24?: string | null) {
    if (!time24) return '—'
    const parts = String(time24).split(':')
    if (parts.length < 2) return time24
    const date = new Date(1970, 0, 1, parseInt(parts[0], 10), parseInt(parts[1], 10))
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  // Format hours & minutes nicely
  function formatHoursMinutes(h?: number | string | null, m?: number | string | null) {
    const hours = Number(h || 0)
    const minutes = Number(m || 0)
    if (!hours && !minutes) return '0m'
    const parts: string[] = []
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    return parts.join(' ')
  }

  // Directus RDK fetch (handling array or { data: [...] })
  const {
    data: shifts = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['shiftings'],
    queryFn: async () => {
      const res = await rdk.request(readItems('shift', { sort: ['shift_name'] }))
      if (Array.isArray(res)) return res
      if (Array.isArray((res as any)?.data)) return (res as any).data
      return []
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Filter & Sort
  const filteredAndSortedShifts = useMemo(() => {
    let result = [...shifts]

    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter(
        (shift: any) => (shift.status || 'active').toLowerCase() === filterStatus.toLowerCase()
      )
    }

    // Search query
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((shift: any) => {
        const name = (shift.shift_name || '').toLowerCase()
        const from = (shift.shift_from || '').toLowerCase()
        const to = (shift.shift_to || '').toLowerCase()
        const status = (shift.status || '').toLowerCase()
        return name.includes(q) || from.includes(q) || to.includes(q) || status.includes(q)
      })
    }

    // Sort
    result.sort((a: any, b: any) => {
      const nameA = (a.shift_name || '').toLowerCase()
      const nameB = (b.shift_name || '').toLowerCase()
      if (sortSelected === 'name asc') return nameA.localeCompare(nameB)
      if (sortSelected === 'name desc') return nameB.localeCompare(nameA)
      if (sortSelected === 'timings asc') return (a.shift_from || '').localeCompare(b.shift_from || '')
      if (sortSelected === 'timings desc') return (b.shift_from || '').localeCompare(a.shift_from || '')
      return 0
    })

    return result
  }, [shifts, search, filterStatus, sortSelected])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedShifts.length / itemsPerPage))
  const paginatedShifts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredAndSortedShifts.slice(start, start + itemsPerPage)
  }, [filteredAndSortedShifts, currentPage, itemsPerPage])

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      return await rdk.request(deleteItems('shift', [id]))
    },
    onSuccess: async () => {
      sound.success()
      toast.success('Shift deleted successfully')
      await queryClient.invalidateQueries({ queryKey: ['shiftings'] })
      await queryClient.invalidateQueries({ queryKey: ['shifts'] })
      await queryClient.refetchQueries({ queryKey: ['shiftings'] })
      await queryClient.refetchQueries({ queryKey: ['shifts'] })
      refetch()
      setDeleteConfirmOpen(false)
      setShiftToDelete(null)
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete shift')
    },
  })

  const handleAdd = () => {
    setSelectedShift(null)
    setModalOpen(true)
  }

  const handleEdit = (shift: any) => {
    setSelectedShift(shift)
    setModalOpen(true)
  }

  const handleDeletePrompt = (shift: any) => {
    setShiftToDelete(shift)
    setDeleteConfirmOpen(true)
  }

  const activeFilterCount = filterStatus !== 'all' ? 1 : 0

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden h-full">
      {/* 1. Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-card/60 backdrop-blur-sm shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Clock className="size-4" />
            </div>
            <h1 className="font-display text-base font-semibold tracking-tight text-foreground">
              Company Shifts
            </h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {shifts.length} Total
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage work schedules, punch restrictions, cut-offs, minimum working hours, and penalty policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-2xs"
            title="Refresh shifts"
          >
            <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin text-primary')} />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={handleAdd}
            className="h-8 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>Add New Shift</span>
          </Button>
        </div>
      </div>

      {/* 2. Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 bg-card shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {filteredAndSortedShifts.length}{' '}
            {filteredAndSortedShifts.length === 1 ? 'shift' : 'shifts'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative min-w-[200px] sm:w-64">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search shift name, timings..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              className="h-7.5 pl-8 pr-7 text-xs bg-muted/30 focus-visible:bg-background rounded-lg"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Filter Popover */}
          <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md transition-colors cursor-pointer border border-transparent h-7.5',
                  activeFilterCount > 0 &&
                    'text-primary font-semibold border-primary/20 bg-primary/5'
                )}
              >
                <Filter className="size-3.5" />
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span className="grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-3 space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <p className="text-xs font-bold text-foreground">Filter Shifts</p>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterStatus('all')}
                    className="text-[11px] text-primary hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground">Status</label>
                <Select
                  value={filterStatus}
                  onValueChange={(val) => {
                    setFilterStatus(val)
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      All Statuses
                    </SelectItem>
                    <SelectItem value="active" className="text-xs">
                      Active
                    </SelectItem>
                    <SelectItem value="draft" className="text-xs">
                      Draft
                    </SelectItem>
                    <SelectItem value="deleted" className="text-xs">
                      Deleted
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>

          {/* Sort Popover */}
          <Popover open={sortPopoverOpen} onOpenChange={setSortPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md transition-colors cursor-pointer border border-transparent h-7.5"
              >
                <ArrowUpDown className="size-3.5 text-muted-foreground" />
                <span>Sort</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-1.5 shadow-lg">
              <div className="p-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Sort Shifts By
              </div>
              {[
                { key: 'name asc', label: 'Shift Name: A to Z' },
                { key: 'name desc', label: 'Shift Name: Z to A' },
                { key: 'timings asc', label: 'Start Time: Earliest' },
                { key: 'timings desc', label: 'Start Time: Latest' },
              ].map((opt) => {
                const isSelected = sortSelected === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setSortSelected(opt.key)
                      setSortPopoverOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between px-2.5 py-1.5 text-xs rounded-md cursor-pointer transition-colors text-left',
                      isSelected
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="size-3.5 text-primary" />}
                  </button>
                )
              })}
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="size-7 cursor-pointer text-muted-foreground hover:text-foreground rounded-md"
            title="Refresh"
          >
            <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin text-primary')} />
          </Button>
        </div>
      </div>

      {/* 3. Main Spreadsheet Grid Table */}
      <div className="flex-1 min-h-0 overflow-auto bg-card">
        <table className="w-full border-separate border-spacing-0 text-left text-xs">
          <thead className="sticky top-0 z-20 bg-card shadow-2xs">
            <tr className="text-muted-foreground font-semibold">
              {/* Frozen Column 1: Shift Name */}
              <th
                style={{ width: colWidths.name, minWidth: colWidths.name }}
                className="sticky left-0 top-0 z-30 bg-card py-2.5 px-4 border-t border-b border-l border-r border-gray-200 dark:border-border select-none shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.4)]"
              >
                <span className="pr-2">SHIFT NAME</span>
                <ColumnResizer
                  isResizing={isResizing === 'name'}
                  onMouseDown={(e) => startResizing('name', e)}
                />
              </th>

              {/* Column 2: Shift Timings */}
              <th
                style={{ width: colWidths.timings, minWidth: colWidths.timings }}
                className="relative py-2.5 px-4 border-t border-b border-r border-gray-200 dark:border-border select-none"
              >
                <span className="pr-2">TIMINGS</span>
                <ColumnResizer
                  isResizing={isResizing === 'timings'}
                  onMouseDown={(e) => startResizing('timings', e)}
                />
              </th>

              {/* Column 3: Punch Restrictions */}
              <th
                style={{ width: colWidths.punchWindow, minWidth: colWidths.punchWindow }}
                className="relative py-2.5 px-4 border-t border-b border-r border-gray-200 dark:border-border select-none"
              >
                <span className="pr-2">PUNCH WINDOW</span>
                <ColumnResizer
                  isResizing={isResizing === 'punchWindow'}
                  onMouseDown={(e) => startResizing('punchWindow', e)}
                />
              </th>

              {/* Column 4: Grace Cutoffs */}
              <th
                style={{ width: colWidths.grace, minWidth: colWidths.grace }}
                className="relative py-2.5 px-4 border-t border-b border-r border-gray-200 dark:border-border select-none"
              >
                <span className="pr-2">GRACE CUTOFFS</span>
                <ColumnResizer
                  isResizing={isResizing === 'grace'}
                  onMouseDown={(e) => startResizing('grace', e)}
                />
              </th>

              {/* Column 5: Min Working Hours */}
              <th
                style={{ width: colWidths.minHours, minWidth: colWidths.minHours }}
                className="relative py-2.5 px-4 border-t border-b border-r border-gray-200 dark:border-border select-none"
              >
                <span className="pr-2">MIN WORKING HOURS</span>
                <ColumnResizer
                  isResizing={isResizing === 'minHours'}
                  onMouseDown={(e) => startResizing('minHours', e)}
                />
              </th>

              {/* Column 6: Penalty Policy */}
              <th
                style={{ width: colWidths.penalties, minWidth: colWidths.penalties }}
                className="relative py-2.5 px-4 border-t border-b border-r border-gray-200 dark:border-border select-none"
              >
                <span className="pr-2">PENALTY POLICY</span>
                <ColumnResizer
                  isResizing={isResizing === 'penalties'}
                  onMouseDown={(e) => startResizing('penalties', e)}
                />
              </th>

              {/* Column 7: Status */}
              <th
                style={{ width: colWidths.status, minWidth: colWidths.status }}
                className="relative py-2.5 px-4 border-t border-b border-r border-gray-200 dark:border-border select-none"
              >
                <span className="pr-2">STATUS</span>
                <ColumnResizer
                  isResizing={isResizing === 'status'}
                  onMouseDown={(e) => startResizing('status', e)}
                />
              </th>

              {/* Column 8: Actions */}
              <th
                style={{ width: colWidths.actions, minWidth: colWidths.actions }}
                className="relative py-2.5 px-4 text-right border-t border-b border-r border-gray-200 dark:border-border select-none"
              >
                <span className="pr-2">ACTIONS</span>
                <ColumnResizer
                  isResizing={isResizing === 'actions'}
                  onMouseDown={(e) => startResizing('actions', e)}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="sticky left-0 z-10 bg-card py-3 px-4 border-b border-l border-r border-gray-200 dark:border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.4)]">
                    <div className="h-4 w-32 bg-muted rounded" />
                  </td>
                  <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border">
                    <div className="h-4 w-28 bg-muted rounded" />
                  </td>
                  <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border">
                    <div className="h-4 w-28 bg-muted rounded" />
                  </td>
                  <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border">
                    <div className="h-4 w-24 bg-muted rounded" />
                  </td>
                  <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border">
                    <div className="h-4 w-24 bg-muted rounded" />
                  </td>
                  <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border">
                    <div className="h-4 w-24 bg-muted rounded" />
                  </td>
                  <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border">
                    <div className="h-5 w-16 bg-muted rounded-full" />
                  </td>
                  <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border text-right">
                    <div className="h-4 w-12 bg-muted rounded ml-auto" />
                  </td>
                </tr>
              ))
            ) : paginatedShifts.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-12 text-center text-muted-foreground border-b border-l border-r border-gray-200 dark:border-border"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Clock className="size-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No shifts found</p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      {search || filterStatus !== 'all'
                        ? 'Try adjusting your search or filters.'
                        : 'Create your first work shift to assign schedules to staff.'}
                    </p>
                    {!search && filterStatus === 'all' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAdd}
                        className="mt-2 h-7 text-xs"
                      >
                        <Plus className="size-3.5 mr-1" />
                        Add First Shift
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedShifts.map((shift: any) => {
                const shiftId = shift.shift_id || shift.id
                const status = shift.status || 'active'
                const isActive = status === 'active'
                const isDraft = status === 'draft'

                return (
                  <tr
                    key={shiftId}
                    onClick={() => handleEdit(shift)}
                    className="group hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    {/* Shift Name (Sticky Frozen Column) */}
                    <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/50 py-2.5 px-4 border-b border-l border-r border-gray-200 dark:border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.4)] transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-xs">
                            {shift.shift_name}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {shift.applicable_for_overnight && (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1 py-0 px-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                            >
                              <Moon className="size-2.5" />
                              Overnight
                            </Badge>
                          )}
                          {shift.applicable_for_break && (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1 py-0 px-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                            >
                              <Coffee className="size-2.5" />
                              Break
                            </Badge>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Shift Timings */}
                    <td className="py-2.5 px-4 border-b border-r border-gray-200 dark:border-border">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Clock className="size-3.5 text-primary shrink-0" />
                          <span>{to12Hour(shift.shift_from)}</span>
                          <span className="text-muted-foreground font-normal">to</span>
                          <span>{to12Hour(shift.shift_to)}</span>
                        </div>
                        {shift.auto_punch_out && shift.auto_punch_out_time && (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <span className="text-primary font-medium">Auto-out:</span>
                            <span>{to12Hour(shift.auto_punch_out_time)}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Punch Window */}
                    <td className="py-2.5 px-4 text-muted-foreground border-b border-r border-gray-200 dark:border-border">
                      <div className="space-y-0.5 text-[11px]">
                        <div className="flex items-center gap-1">
                          <LogIn className="size-3 text-emerald-600 shrink-0" />
                          <span>In:</span>
                          <span className="font-medium text-foreground">
                            {shift.punch_in_type === 'limit'
                              ? `-${formatHoursMinutes(
                                  shift.punch_in_hours_before,
                                  shift.punch_in_minutes_before
                                )} before`
                              : 'Anytime'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <LogOut className="size-3 text-amber-600 shrink-0" />
                          <span>Out:</span>
                          <span className="font-medium text-foreground">
                            {shift.punch_out_type === 'limit'
                              ? `+${formatHoursMinutes(
                                  shift.punch_out_hours_after,
                                  shift.punch_out_minutes_after
                                )} after`
                              : 'Anytime'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Grace Cutoffs */}
                    <td className="py-2.5 px-4 text-muted-foreground border-b border-r border-gray-200 dark:border-border">
                      <div className="space-y-0.5 text-[11px]">
                        <div>
                          Late Cutoff:{' '}
                          <span className="font-medium text-foreground">
                            {formatHoursMinutes(
                              shift.late_cutoff_hours,
                              shift.late_cutoff_minutes
                            )}
                          </span>
                        </div>
                        <div>
                          Early Cutoff:{' '}
                          <span className="font-medium text-foreground">
                            {formatHoursMinutes(
                              shift.early_cutoff_hours,
                              shift.early_cutoff_minutes
                            )}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Min Working Hours */}
                    <td className="py-2.5 px-4 border-b border-r border-gray-200 dark:border-border">
                      {shift.applicable_for_minimum_working_hours ? (
                        <div className="space-y-0.5 text-[11px]">
                          <div>
                            Full Day:{' '}
                            <span className="font-semibold text-foreground">
                              {formatHoursMinutes(
                                shift.shift_minimum_working_hours,
                                shift.shift_minimum_working_minutes
                              )}
                            </span>
                          </div>
                          <div>
                            Half Day:{' '}
                            <span className="font-medium text-muted-foreground">
                              {formatHoursMinutes(
                                shift.shift_minimum_present_hours,
                                shift.shift_minimum_present_minutes
                              )}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60 italic text-xs">Disabled</span>
                      )}
                    </td>

                    {/* Penalty Policy */}
                    <td className="py-2.5 px-4 border-b border-r border-gray-200 dark:border-border">
                      <div className="space-y-0.5 text-[11px] text-muted-foreground">
                        <div>
                          Lates:{' '}
                          <span className="font-medium text-foreground">
                            {shift.lates_counted_as_half_day > 0
                              ? `${shift.lates_counted_as_half_day}=Half`
                              : '—'}
                            {shift.lates_counted_as_absent > 0
                              ? `, ${shift.lates_counted_as_absent}=Absent`
                              : ''}
                          </span>
                        </div>
                        <div>
                          Earlies:{' '}
                          <span className="font-medium text-foreground">
                            {shift.earlies_counted_as_half_day > 0
                              ? `${shift.earlies_counted_as_half_day}=Half`
                              : '—'}
                            {shift.early_counted_as_absent > 0
                              ? `, ${shift.early_counted_as_absent}=Absent`
                              : ''}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-4 border-b border-r border-gray-200 dark:border-border">
                      <Badge
                        variant={isActive ? 'secondary' : isDraft ? 'outline' : 'destructive'}
                        className={`text-[10px] font-medium py-0 px-2 capitalize ${
                          isActive
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : isDraft
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                            : 'bg-destructive/10 text-destructive border-destructive/20'
                        }`}
                      >
                        {status}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td
                      onClick={(e) => e.stopPropagation()}
                      className="py-2.5 px-4 text-right border-b border-r border-gray-200 dark:border-border"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(shift)}
                          className="size-7 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="Edit Shift"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePrompt(shift)}
                          className="size-7 cursor-pointer text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Delete Shift"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Sticky Pagination Bar */}
      <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-2.5 bg-background">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Show</span>
          <Select
            value={String(itemsPerPage)}
            onValueChange={(val) => {
              setItemsPerPage(Number(val))
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="h-7 w-16 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            per page • {filteredAndSortedShifts.length} items
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="size-7 cursor-pointer"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="size-7 cursor-pointer"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Shift Form Slide-out Sheet */}
      {modalOpen && (
        <ShiftModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          shiftToEdit={selectedShift}
          onSuccess={() => refetch()}
        />
      )}

      {/* Delete Confirmation Modal */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold flex items-center gap-1.5 text-rose-600">
              <Trash2 className="size-4" />
              Delete Work Shift
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete <strong className="text-foreground">{shiftToDelete?.shift_name}</strong>?
              Employees currently assigned to this shift may need to be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row items-center justify-end gap-3">
            <AlertDialogCancel disabled={deleteMutation.isPending} className="text-xs h-8">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                shiftToDelete &&
                deleteMutation.mutate(shiftToDelete.shift_id || shiftToDelete.id)
              }
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs h-8"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Shift'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default CompanyShiftsSettings
