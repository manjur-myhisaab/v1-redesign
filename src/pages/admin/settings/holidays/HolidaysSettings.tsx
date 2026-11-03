import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  RefreshCw,
  Search,
  X,
  ArrowUpDown,
  Filter,
  Check,
  ChevronLeft,
  ChevronRight,
  Tag,
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
import rdk, { readItems, deleteItem } from '@/services/server'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { HolidayModal } from './HolidayModal'

function formatHolidayDate(dateString?: string) {
  if (!dateString) return ''
  const [y, m, d] = dateString.split('-')
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10))
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getHolidayDay(dateString?: string) {
  if (!dateString) return ''
  const [y, m, d] = dateString.split('-')
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10))
  return date.toLocaleDateString('en-GB', { weekday: 'long' })
}

export const HolidaysSettings: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedHoliday, setSelectedHoliday] = useState<any | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [holidayToDelete, setHolidayToDelete] = useState<any | null>(null)

  // Resizable columns
  const { colWidths, startResizing, isResizing } = useResizableColumns(
    {
      name: 240,
      date: 140,
      day: 130,
      categories: 360,
      actions: 90,
    },
    { storageKey: 'holidays_table_widths_v2', minWidth: 80 }
  )

  // Search, Filter, Sort & Pagination state
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [sortSelected, setSortSelected] = useState<string>('date desc')
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // 1. Fetch current firm categories
  const { data: categories = [] } = useQuery({
    queryKey: ['employeeCategories'],
    queryFn: async () => {
      const res = await rdk.request(
        readItems('employee_category', {
          fields: ['*'],
          limit: -1,
        })
      )
      if (Array.isArray(res)) return res
      if (Array.isArray((res as any)?.data)) return (res as any).data
      return []
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Fast lookup Map for current firm categories by ID
  const categoryMap = useMemo(() => {
    const map = new Map<string, any>()
    categories.forEach((cat: any) => {
      const id = String(cat.employee_category_id ?? cat.id ?? '')
      if (id) {
        map.set(id, cat)
      }
    })
    return map
  }, [categories])

  // Helper to extract ONLY assigned categories that actually exist in the current firm
  const getMatchedCategories = (item: any) => {
    const catList = Array.isArray(item.category_ids) ? item.category_ids : []
    if (catList.length === 0) return []

    const matchedList: any[] = []
    const seenIds = new Set<string>()

    catList.forEach((c: any) => {
      let targetId = ''
      if (typeof c === 'object' && c !== null) {
        if (typeof c.category_id === 'object' && c.category_id !== null) {
          targetId = String(c.category_id.employee_category_id ?? c.category_id.id ?? '')
        } else if (c.category_id !== undefined && c.category_id !== null) {
          targetId = String(c.category_id)
        } else {
          targetId = String(c.employee_category_id ?? c.id ?? '')
        }
      } else if (c !== undefined && c !== null) {
        targetId = String(c)
      }

      if (!targetId || seenIds.has(targetId)) return

      // Must exist in current firm's categories
      const found = categoryMap.get(targetId)
      if (found) {
        seenIds.add(targetId)
        matchedList.push(found)
      }
    })

    return matchedList
  }

  // 2. Fetch holidays from Directus RDK
  const {
    data: holidays = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['holidays'],
    queryFn: async () => {
      const res = await rdk.request(
        readItems('holiday', {
          fields: ['*', 'category_ids.*', 'category_ids.category_id.*'],
          sort: ['-holiday_date'],
          limit: -1,
        })
      )
      if (Array.isArray(res)) return res
      if (Array.isArray((res as any)?.data)) return (res as any).data
      return []
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // 3. Filter & Sort
  const filteredAndSortedHolidays = useMemo(() => {
    let result = [...holidays]

    // Category filter
    if (filterCategory !== 'all') {
      if (filterCategory === 'all_staff') {
        result = result.filter((item: any) => getMatchedCategories(item).length === 0)
      } else {
        result = result.filter((item: any) => {
          const matched = getMatchedCategories(item)
          return matched.some((c: any) => String(c.employee_category_id ?? c.id) === filterCategory)
        })
      }
    }

    // Search query
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((item: any) => {
        const name = (item.holiday_name || '').toLowerCase()
        const date = (item.holiday_date || '').toLowerCase()
        const matched = getMatchedCategories(item)
        const catMatch = matched.some((c: any) =>
          (c.employee_category_name || c.category_name || '').toLowerCase().includes(q)
        )
        return name.includes(q) || date.includes(q) || catMatch
      })
    }

    // Sort
    result.sort((a: any, b: any) => {
      const nameA = (a.holiday_name || '').toLowerCase()
      const nameB = (b.holiday_name || '').toLowerCase()
      const dateA = a.holiday_date || ''
      const dateB = b.holiday_date || ''

      if (sortSelected === 'date desc') return dateB.localeCompare(dateA)
      if (sortSelected === 'date asc') return dateA.localeCompare(dateB)
      if (sortSelected === 'name asc') return nameA.localeCompare(nameB)
      if (sortSelected === 'name desc') return nameB.localeCompare(nameA)
      return 0
    })

    return result
  }, [holidays, search, filterCategory, sortSelected, categoryMap])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedHolidays.length / itemsPerPage))
  const paginatedHolidays = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredAndSortedHolidays.slice(start, start + itemsPerPage)
  }, [filteredAndSortedHolidays, currentPage, itemsPerPage])

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      return await rdk.request(deleteItem('holiday', id))
    },
    onSuccess: async () => {
      sound.success()
      toast.success('Holiday deleted successfully')
      await queryClient.invalidateQueries({ queryKey: ['holidays'] })
      await queryClient.refetchQueries({ queryKey: ['holidays'] })
      refetch()
      setDeleteConfirmOpen(false)
      setHolidayToDelete(null)
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete holiday')
    },
  })

  const handleAdd = () => {
    setSelectedHoliday(null)
    setModalOpen(true)
  }

  const handleEdit = (item: any) => {
    setSelectedHoliday(item)
    setModalOpen(true)
  }

  const handleDeletePrompt = (item: any) => {
    setHolidayToDelete(item)
    setDeleteConfirmOpen(true)
  }

  const activeFilterCount = filterCategory !== 'all' ? 1 : 0

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden h-full">
      {/* 1. Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-card/60 backdrop-blur-sm shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-4" />
            </div>
            <h1 className="font-display text-base font-semibold tracking-tight text-foreground">
              Holiday Listing
            </h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {holidays.length} Total
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Declare and manage public, national, and custom holiday schedules for your workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-2xs"
            title="Refresh holidays"
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
            <span>New Holiday</span>
          </Button>
        </div>
      </div>

      {/* 2. Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 bg-card shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {filteredAndSortedHolidays.length}{' '}
            {filteredAndSortedHolidays.length === 1 ? 'holiday' : 'holidays'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative min-w-[200px] sm:w-64">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search holiday name, date, category..."
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
            <PopoverContent align="end" className="w-64 p-3 space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <p className="text-xs font-bold text-foreground">Filter Holidays</p>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterCategory('all')}
                    className="text-[11px] text-primary hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground">Category</label>
                <Select
                  value={filterCategory}
                  onValueChange={(val) => {
                    setFilterCategory(val)
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      All Categories
                    </SelectItem>
                    <SelectItem value="all_staff" className="text-xs">
                      All Staff (Unrestricted)
                    </SelectItem>
                    {categories.map((cat: any) => {
                      const cId = String(cat.employee_category_id ?? cat.id)
                      const name = cat.employee_category_name || cat.category_name || `Category ${cId}`
                      return (
                        <SelectItem key={cId} value={cId} className="text-xs">
                          {name}
                        </SelectItem>
                      )
                    })}
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
            <PopoverContent align="end" className="w-56 p-1.5 shadow-lg">
              <div className="p-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Sort Holidays By
              </div>
              {[
                { key: 'date desc', label: 'Date: Newest First' },
                { key: 'date asc', label: 'Date: Oldest First' },
                { key: 'name asc', label: 'Name: A to Z' },
                { key: 'name desc', label: 'Name: Z to A' },
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
              <th
                style={{ width: colWidths.name, minWidth: colWidths.name }}
                className="sticky left-0 top-0 z-30 bg-card py-2.5 px-4 border-t border-b border-l border-r border-gray-200 dark:border-border select-none shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.4)]"
              >
                <span className="pr-2">HOLIDAY NAME</span>
                <ColumnResizer
                  isResizing={isResizing === 'name'}
                  onMouseDown={(e) => startResizing('name', e)}
                />
              </th>
              <th
                style={{ width: colWidths.date, minWidth: colWidths.date }}
                className="relative py-2.5 px-4 border-t border-b border-r border-gray-200 dark:border-border select-none"
              >
                <span className="pr-2">DATE</span>
                <ColumnResizer
                  isResizing={isResizing === 'date'}
                  onMouseDown={(e) => startResizing('date', e)}
                />
              </th>
              <th
                style={{ width: colWidths.day, minWidth: colWidths.day }}
                className="relative py-2.5 px-4 border-t border-b border-r border-gray-200 dark:border-border select-none"
              >
                <span className="pr-2">DAY</span>
                <ColumnResizer
                  isResizing={isResizing === 'day'}
                  onMouseDown={(e) => startResizing('day', e)}
                />
              </th>
              <th
                style={{ width: colWidths.categories, minWidth: colWidths.categories }}
                className="relative py-2.5 px-4 border-t border-b border-r border-gray-200 dark:border-border select-none"
              >
                <span className="pr-2">APPLICABLE CATEGORIES</span>
                <ColumnResizer
                  isResizing={isResizing === 'categories'}
                  onMouseDown={(e) => startResizing('categories', e)}
                />
              </th>
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
                    <div className="h-4 w-24 bg-muted rounded" />
                  </td>
                  <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border">
                    <div className="h-4 w-20 bg-muted rounded" />
                  </td>
                  <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border">
                    <div className="h-4 w-40 bg-muted rounded" />
                  </td>
                  <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border text-right">
                    <div className="h-4 w-12 bg-muted rounded ml-auto" />
                  </td>
                </tr>
              ))
            ) : paginatedHolidays.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-12 text-center text-muted-foreground border-b border-l border-r border-gray-200 dark:border-border"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <CalendarDays className="size-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No holidays found</p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      {search || filterCategory !== 'all'
                        ? 'Try adjusting your search or filters.'
                        : 'Schedule declared company holidays to automatically account for off-days.'}
                    </p>
                    {!search && filterCategory === 'all' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAdd}
                        className="mt-2 h-7 text-xs"
                      >
                        <Plus className="size-3.5 mr-1" />
                        Add First Holiday
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedHolidays.map((item: any) => {
                const holidayId = item.holiday_id || item.id
                const matchedCategories = getMatchedCategories(item)

                return (
                  <tr
                    key={holidayId}
                    onClick={() => handleEdit(item)}
                    className="group hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    {/* Name (Sticky Frozen Column) */}
                    <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/50 py-2.5 px-4 border-b border-l border-r border-gray-200 dark:border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.4)] transition-colors">
                      <div className="flex items-center gap-2">
                        <Calendar className="size-3.5 text-primary shrink-0" />
                        <span className="font-semibold text-foreground text-xs">{item.holiday_name}</span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-2.5 px-4 border-b border-r border-gray-200 dark:border-border">
                      <span className="font-medium text-foreground">{formatHolidayDate(item.holiday_date)}</span>
                    </td>

                    {/* Day */}
                    <td className="py-2.5 px-4 text-muted-foreground border-b border-r border-gray-200 dark:border-border">
                      <span>{getHolidayDay(item.holiday_date)}</span>
                    </td>

                    {/* Applicable Categories (Only displaying categories that exist in firm categories) */}
                    <td className="py-2.5 px-4 border-b border-r border-gray-200 dark:border-border">
                      {matchedCategories.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-w-md">
                          {matchedCategories.map((cat: any, idx: number) => {
                            const name =
                              cat.employee_category_name ||
                              cat.category_name ||
                              cat.name ||
                              `Category ${cat.employee_category_id ?? cat.id ?? ''}`
                            return (
                              <Badge
                                key={cat.employee_category_id ?? cat.id ?? idx}
                                variant="outline"
                                className="text-[10px] py-0 px-2 bg-muted/40 font-medium text-foreground border-border"
                              >
                                {name}
                              </Badge>
                            )
                          })}
                        </div>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-[10px] py-0 px-2 bg-primary/10 text-primary border border-primary/20 font-medium"
                        >
                          All Staff
                        </Badge>
                      )}
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
                          onClick={() => handleEdit(item)}
                          className="size-7 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="Edit Holiday"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePrompt(item)}
                          className="size-7 cursor-pointer text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Delete Holiday"
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
            per page • {filteredAndSortedHolidays.length} items
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

      {/* Holiday Slide-out Sheet */}
      {modalOpen && (
        <HolidayModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          holidayToEdit={selectedHoliday}
          categories={categories}
          onSuccess={() => refetch()}
        />
      )}

      {/* Delete Confirmation Modal */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold flex items-center gap-1.5 text-rose-600">
              <Trash2 className="size-4" />
              Delete Holiday
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete <strong className="text-foreground">{holidayToDelete?.holiday_name}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row items-center justify-end gap-3">
            <AlertDialogCancel disabled={deleteMutation.isPending} className="text-xs h-8">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                holidayToDelete &&
                deleteMutation.mutate(holidayToDelete.holiday_id || holidayToDelete.id)
              }
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs h-8"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Holiday'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default HolidaysSettings
