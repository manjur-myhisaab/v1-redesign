import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Calendar,
  RefreshCw,
  Search,
  X,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ShieldAlert,
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
import { PayrollHeadModal } from './PayrollHeadModal'

const FIELDS_TO_FETCH = [
  '*',
  'value_based_on.*',
  'value_based_on_2.*',
  'applicable_months.*',
  'value_based_on.related_payroll_heads_payroll_head_id.*',
]

const MONTH_NAMES = [
  '',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export const PayrollConfigurationSettings: React.FC = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'benefit' | 'deduction'>('benefit')

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedHead, setSelectedHead] = useState<any | null>(null)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [headToDelete, setHeadToDelete] = useState<any | null>(null)

  // Resizable columns
  const { colWidths, startResizing, isResizing } = useResizableColumns(
    {
      name: 240,
      calcType: 140,
      rateFormula: 320,
      maxLimit: 130,
      attnType: 150,
      months: 180,
      actions: 90,
    },
    { storageKey: 'payroll_heads_table_widths_v2', minWidth: 80 }
  )

  // Search, Sort & Pagination state
  const [search, setSearch] = useState('')
  const [sortSelected, setSortSelected] = useState<string>('name asc')
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Fetch Benefits from Directus RDK
  const {
    data: benefits = [],
    isLoading: loadingBenefits,
    isFetching: fetchingBenefits,
    refetch: refetchBenefits,
  } = useQuery({
    queryKey: ['payroll-benifits'],
    queryFn: async () => {
      const res = await rdk.request(
        readItems('payroll_heads', {
          filter: { payroll_type: { _eq: 'benefit' } },
          sort: ['-date_created'],
          fields: FIELDS_TO_FETCH,
          limit: -1,
        })
      )
      if (Array.isArray(res)) return res
      if (Array.isArray((res as any)?.data)) return (res as any).data
      return []
    },
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  })

  // Fetch Deductions from Directus RDK
  const {
    data: deductions = [],
    isLoading: loadingDeductions,
    isFetching: fetchingDeductions,
    refetch: refetchDeductions,
  } = useQuery({
    queryKey: ['payroll-deductions'],
    queryFn: async () => {
      const res = await rdk.request(
        readItems('payroll_heads', {
          filter: { payroll_type: { _eq: 'deduction' } },
          sort: ['-date_created'],
          fields: FIELDS_TO_FETCH,
          limit: -1,
        })
      )
      if (Array.isArray(res)) return res
      if (Array.isArray((res as any)?.data)) return (res as any).data
      return []
    },
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  })

  const isLoading = loadingBenefits || loadingDeductions
  const isFetching = fetchingBenefits || fetchingDeductions

  const allAvailableHeads = useMemo(() => [...benefits, ...deductions], [benefits, deductions])

  const refetchAll = () => {
    refetchBenefits()
    refetchDeductions()
  }

  // Active items based on current tab
  const currentItems = activeTab === 'benefit' ? benefits : deductions

  // Filter & Sort
  const filteredAndSortedItems = useMemo(() => {
    let result = [...currentItems]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((item: any) => {
        const name = (item.payroll_head_name || '').toLowerCase()
        const valType = (item.payroll_value_type || '').toLowerCase()
        const id = String(item.payroll_head_id || item.id || '').toLowerCase()
        const val = String(item.payroll_value || '').toLowerCase()
        return name.includes(q) || valType.includes(q) || id.includes(q) || val.includes(q)
      })
    }

    result.sort((a: any, b: any) => {
      const nameA = (a.payroll_head_name || '').toLowerCase()
      const nameB = (b.payroll_head_name || '').toLowerCase()
      if (sortSelected === 'name asc') return nameA.localeCompare(nameB)
      if (sortSelected === 'name desc') return nameB.localeCompare(nameA)
      return 0
    })

    return result
  }, [currentItems, search, sortSelected])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedItems.length / itemsPerPage))
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredAndSortedItems.slice(start, start + itemsPerPage)
  }, [filteredAndSortedItems, currentPage, itemsPerPage])

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      return await rdk.request(deleteItems('payroll_heads', [id]))
    },
    onSuccess: async () => {
      sound.success()
      toast.success('Payroll component deleted successfully')
      await queryClient.invalidateQueries({ queryKey: ['payroll-benifits'] })
      await queryClient.invalidateQueries({ queryKey: ['payroll-deductions'] })
      await queryClient.invalidateQueries({ queryKey: ['payroll-heads'] })
      await queryClient.invalidateQueries({ queryKey: ['all-payroll-heads'] })
      refetchAll()
      setDeleteConfirmOpen(false)
      setHeadToDelete(null)
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete component')
    },
  })

  const handleAdd = () => {
    setSelectedHead(null)
    setModalOpen(true)
  }

  const handleEdit = (head: any) => {
    setSelectedHead(head)
    setModalOpen(true)
  }

  const handleDeletePrompt = (head: any) => {
    setHeadToDelete(head)
    setDeleteConfirmOpen(true)
  }

  // Format applicable months display
  const formatApplicableMonths = (head: any) => {
    const months = Array.isArray(head.applicable_months) ? head.applicable_months : []
    if (months.length === 0 || months.length >= 12) {
      return 'All 12 Months'
    }
    const monthLabels = months
      .map((m: any) => MONTH_NAMES[Number(m.month || m)] || '')
      .filter(Boolean)
    const year = months[0]?.year ? ` (${months[0].year})` : ''
    if (monthLabels.length <= 4) {
      return `${monthLabels.join(', ')}${year}`
    }
    return `${monthLabels.slice(0, 3).join(', ')} +${monthLabels.length - 3} more${year}`
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden h-full">
      {/* 1. Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-card/60 backdrop-blur-sm shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="size-4" />
            </div>
            <h1 className="font-display text-base font-semibold tracking-tight text-foreground">
              Payroll Configuration
            </h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {benefits.length + deductions.length} Total Heads
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage recurring allowances, salary heads, statutory deductions, calculation formulas, and attendance policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refetchAll}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-2xs"
            title="Refresh payroll configuration"
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
            <span>Add New {activeTab === 'benefit' ? 'Benefit' : 'Deduction'}</span>
          </Button>
        </div>
      </div>

      {/* 2. Toolbar with Status Tabs & Search/Sort */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2 bg-card shrink-0">
        {/* Type Switcher Pills */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('benefit')
              setCurrentPage(1)
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer',
              activeTab === 'benefit'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <TrendingUp className="size-3.5" />
            <span>Earnings &amp; Benefits ({benefits.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('deduction')
              setCurrentPage(1)
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer',
              activeTab === 'deduction'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <TrendingDown className="size-3.5" />
            <span>Deductions ({deductions.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative min-w-[200px] sm:w-64">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Search ${activeTab === 'benefit' ? 'benefits' : 'deductions'}...`}
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
                Sort Components By
              </div>
              {[
                { key: 'name asc', label: 'Component Name: A to Z' },
                { key: 'name desc', label: 'Component Name: Z to A' },
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
            onClick={refetchAll}
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
                <span className="pr-2">COMPONENT NAME</span>
                <ColumnResizer
                  isResizing={isResizing === 'name'}
                  onMouseDown={(e) => startResizing('name', e)}
                />
              </th>
              <th
                style={{ width: colWidths.calcType, minWidth: colWidths.calcType }}
                className="relative py-2.5 px-4 border-t border-b border-r border-gray-200 dark:border-border select-none"
              >
                <span className="pr-2">CALCULATION TYPE</span>
                <ColumnResizer
                  isResizing={isResizing === 'calcType'}
                  onMouseDown={(e) => startResizing('calcType', e)}
                />
              </th>
              <th
                style={{ width: colWidths.rateFormula, minWidth: colWidths.rateFormula }}
                className="relative py-2.5 px-4 border-t border-b border-r border-gray-200 dark:border-border select-none"
              >
                <span className="pr-2">RATE / FORMULA</span>
                <ColumnResizer
                  isResizing={isResizing === 'rateFormula'}
                  onMouseDown={(e) => startResizing('rateFormula', e)}
                />
              </th>
              {activeTab === 'deduction' && (
                <th
                  style={{ width: colWidths.maxLimit, minWidth: colWidths.maxLimit }}
                  className="relative py-2.5 px-4 border-t border-b border-r border-gray-200 dark:border-border select-none"
                >
                  <span className="pr-2">MAX LIMIT</span>
                  <ColumnResizer
                    isResizing={isResizing === 'maxLimit'}
                    onMouseDown={(e) => startResizing('maxLimit', e)}
                  />
                </th>
              )}
              <th
                style={{ width: colWidths.attnType, minWidth: colWidths.attnType }}
                className="relative py-2.5 px-4 border-t border-b border-r border-gray-200 dark:border-border select-none"
              >
                <span className="pr-2">ATTENDANCE RULE</span>
                <ColumnResizer
                  isResizing={isResizing === 'attnType'}
                  onMouseDown={(e) => startResizing('attnType', e)}
                />
              </th>
              <th
                style={{ width: colWidths.months, minWidth: colWidths.months }}
                className="relative py-2.5 px-4 border-t border-b border-r border-gray-200 dark:border-border select-none"
              >
                <span className="pr-2">APPLICABLE MONTHS</span>
                <ColumnResizer
                  isResizing={isResizing === 'months'}
                  onMouseDown={(e) => startResizing('months', e)}
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
                    <div className="h-4 w-36 bg-muted rounded" />
                  </td>
                  <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border">
                    <div className="h-4 w-24 bg-muted rounded" />
                  </td>
                  <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border">
                    <div className="h-4 w-32 bg-muted rounded" />
                  </td>
                  {activeTab === 'deduction' && (
                    <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border">
                      <div className="h-4 w-20 bg-muted rounded" />
                    </td>
                  )}
                  <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border">
                    <div className="h-4 w-24 bg-muted rounded" />
                  </td>
                  <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border">
                    <div className="h-4 w-24 bg-muted rounded" />
                  </td>
                  <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border text-right">
                    <div className="h-4 w-12 bg-muted rounded ml-auto" />
                  </td>
                </tr>
              ))
            ) : paginatedItems.length === 0 ? (
              <tr>
                <td
                  colSpan={activeTab === 'deduction' ? 7 : 6}
                  className="py-12 text-center text-muted-foreground border-b border-l border-r border-gray-200 dark:border-border"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <CreditCard className="size-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium">
                      No {activeTab === 'benefit' ? 'earnings or benefits' : 'deductions'} found
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      {search
                        ? 'Try adjusting your search query.'
                        : `Configure default payroll heads to auto-calculate components for your employee salary slips.`}
                    </p>
                    {!search && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAdd}
                        className="mt-2 h-7 text-xs"
                      >
                        <Plus className="size-3.5 mr-1" />
                        Add First {activeTab === 'benefit' ? 'Benefit' : 'Deduction'}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedItems.map((head: any) => {
                const headId = head.payroll_head_id || head.id
                const isFixed = head.payroll_value_type === 'fixed'

                // Compute basis string matching v1 logic exactly
                const basedOnCustom =
                  head.value_based_on?.map(
                    (item: any) => item.related_payroll_heads_payroll_head_id?.payroll_head_name
                  ) || []
                const basedOnSystem = head.value_based_on_2?.map((item: any) => item.head_name) || []
                const combinedBases = [...basedOnCustom, ...basedOnSystem].filter(Boolean).join(', ')

                return (
                  <tr
                    key={headId}
                    onClick={() => handleEdit(head)}
                    className="group hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    {/* Component Name (Sticky Frozen Column) */}
                    <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/50 py-2.5 px-4 border-b border-l border-r border-gray-200 dark:border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.4)] transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-xs">
                          {head.payroll_head_name}
                        </span>
                        
                      </div>
                    </td>

                    {/* Calculation Type */}
                    <td className="py-2.5 px-4 border-b border-r border-gray-200 dark:border-border">
                      <Badge variant="outline" className="capitalize text-[10px] py-0 px-2 font-medium">
                        {isFixed ? 'Fixed Amount' : 'Percentage'}
                      </Badge>
                    </td>

                    {/* Rate / Formula */}
                    <td className="py-2.5 px-4 border-b border-r border-gray-200 dark:border-border">
                      <Badge
                        variant="secondary"
                        className={`text-[11px] font-medium py-0.5 px-2.5 ${
                          activeTab === 'benefit'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {isFixed
                          ? `₹${head.payroll_value} Fixed`
                          : `${head.payroll_value}% of ${combinedBases || 'Basic Salary'}`}
                      </Badge>
                    </td>

                    {/* Max Deduction Limit */}
                    {activeTab === 'deduction' && (
                      <td className="py-2.5 px-4 border-b border-r border-gray-200 dark:border-border">
                        {head.payroll_head_max_limit !== null && head.payroll_head_max_limit !== undefined ? (
                          <span className="text-xs font-semibold text-foreground">
                            ₹{head.payroll_head_max_limit}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 italic text-xs">No Cap</span>
                        )}
                      </td>
                    )}

                    {/* Attendance Rule */}
                    <td className="py-2.5 px-4 border-b border-r border-gray-200 dark:border-border">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3 text-muted-foreground shrink-0" />
                        <span>
                          {head.payroll_head_attn === 'flat_rate' ? 'Flat Rate' : 'On Attendance'}
                        </span>
                      </div>
                    </td>

                    {/* Applicable Months */}
                    <td className="py-2.5 px-4 text-muted-foreground border-b border-r border-gray-200 dark:border-border">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="size-3 text-muted-foreground shrink-0" />
                        <span>{formatApplicableMonths(head)}</span>
                      </div>
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
                          onClick={() => handleEdit(head)}
                          className="size-7 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="Edit Component"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePrompt(head)}
                          className="size-7 cursor-pointer text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Delete Component"
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
            per page • {filteredAndSortedItems.length} items
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

      {/* Head Slide-out Sheet (key ensures fresh form reset per item matching v1) */}
      {modalOpen && (
        <PayrollHeadModal
          key={selectedHead?.payroll_head_id || selectedHead?.id || `new-${activeTab}`}
          open={modalOpen}
          onClose={() => {
            setModalOpen(false)
            setSelectedHead(null)
          }}
          type={activeTab}
          headToEdit={selectedHead}
          allHeads={allAvailableHeads}
          onSuccess={refetchAll}
        />
      )}

      {/* Delete Confirmation Modal */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold flex items-center gap-1.5 text-rose-600">
              <Trash2 className="size-4" />
              Delete Payroll Component
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete{' '}
              <strong className="text-foreground">{headToDelete?.payroll_head_name}</strong>?
              Payslip templates relying on this component may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row items-center justify-end gap-3">
            <AlertDialogCancel disabled={deleteMutation.isPending} className="text-xs h-8">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                headToDelete &&
                deleteMutation.mutate(headToDelete.payroll_head_id || headToDelete.id)
              }
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs h-8"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default PayrollConfigurationSettings
