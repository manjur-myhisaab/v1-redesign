import React, { useState, useMemo, useCallback } from 'react'
import {
  Award,
  Plus,
  Search,
  Calendar,
  IndianRupee,
  Trash2,
  Pencil,
  RefreshCw,
  Loader2,
  Users,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Filter,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Panel from '@/components/admin/Panel'
import { useShell } from '@/components/admin/shell-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { DatePicker } from '@/components/ui/date-picker'
import { cn } from '@/lib/utils'
import rdk, {
  readItems,
  createItem,
  updateItem,
  deleteItem,
  customEndpoint,
  ATTENDANCE_SERVER_URL,
} from '@/services/server'
import { useAuth } from '@/context/auth/AuthContext'
import { downloadMultiIncentiveExcel } from './payroll/utils/downloadMultiIncentiveExcel'

interface IncentiveItem {
  incentive_id: number | string
  incentive_date: string
  incentive_amount: number
  remarks?: string
  status?: string
  employee_id?: {
    id: string
    first_name: string
    last_name?: string
    avatar?: string
    employee_code?: string
    title?: string
    employee_category_id?: {
      employee_category_id: number | string
      employee_category_name: string
    }
  }
}

interface EmployeeRecord {
  id: string
  first_name: string
  last_name?: string
  avatar?: string
  employee_code?: string
  title?: string
  status?: string
  employee_category_id?: any
}

const formatCurrency = (amount: number | string | null | undefined): string => {
  const num = Number(amount) || 0
  return `₹ ${num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const formatDateDisplay = (dateStr?: string) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function Incentives() {
  const { user } = useAuth()
  const shell = useShell()
  const firstTabActive = shell?.firstTabActive ?? false
  const queryClient = useQueryClient()

  // Date Presets & Range
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const [activePreset, setActivePreset] = useState<'this_month' | 'last_month' | 'today' | 'custom'>('this_month')
  const [startDate, setStartDate] = useState<Date>(firstDayOfMonth)
  const [endDate, setEndDate] = useState<Date>(now)

  // Filters & Tabs
  const [selectedTab, setSelectedTab] = useState<'all' | 'grouped'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedIncentive, setSelectedIncentive] = useState<IncentiveItem | null>(null)
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // Form State for Add Modal
  const [addDate, setAddDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [addAmount, setAddAmount] = useState<string>('')
  const [addRemarks, setAddRemarks] = useState<string>('')
  const [addEmpSearch, setAddEmpSearch] = useState<string>('')
  const [addEmpCat, setAddEmpCat] = useState<string>('all')
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([])
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false)

  // Form State for Edit Modal
  const [editDate, setEditDate] = useState<string>('')
  const [editAmount, setEditAmount] = useState<string>('')
  const [editRemarks, setEditRemarks] = useState<string>('')
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)

  const formattedStart = useMemo(() => {
    const offsetDate = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000)
    return offsetDate.toISOString().split('T')[0]
  }, [startDate])

  const formattedEnd = useMemo(() => {
    const offsetDate = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000)
    return offsetDate.toISOString().split('T')[0]
  }, [endDate])

  // Handle Preset change
  const handleApplyPreset = (preset: 'this_month' | 'last_month' | 'today') => {
    setActivePreset(preset)
    const cur = new Date()
    if (preset === 'this_month') {
      setStartDate(new Date(cur.getFullYear(), cur.getMonth(), 1))
      setEndDate(cur)
    } else if (preset === 'last_month') {
      setStartDate(new Date(cur.getFullYear(), cur.getMonth() - 1, 1))
      setEndDate(new Date(cur.getFullYear(), cur.getMonth(), 0))
    } else if (preset === 'today') {
      setStartDate(cur)
      setEndDate(cur)
    }
    setCurrentPage(1)
  }

  // 1. Fetch Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['employee_categories_for_incentives'],
    queryFn: async () => {
      const res: any = await rdk.request(readItems('employee_category', { limit: -1 }))
      return Array.isArray(res) ? res : res?.data || []
    },
  })

  // 2. Fetch Incentives Data
  const {
    data: rawIncentives = [],
    isLoading: isLoadingIncentives,
    isFetching: isFetchingIncentives,
    refetch: refetchIncentives,
  } = useQuery<IncentiveItem[]>({
    queryKey: ['incentives', formattedStart, formattedEnd],
    queryFn: async () => {
      const res: any = await rdk.request(
        readItems('incentives', {
          fields: ['*', 'employee_id.*', 'employee_id.employee_category_id.*'],
          filter: {
            incentive_date: {
              _between: [formattedStart, formattedEnd],
            },
          },
          sort: ['-incentive_date'],
          limit: -1,
        }),
      )
      return Array.isArray(res) ? res : res?.data || []
    },
  })

  // 3. Fetch All Employees (for Add modal & Excel Export)
  const firmId = (user as any)?.firm_id?.firm_id || (user as any)?.firm_id
  const { data: allUsers = [], isLoading: isLoadingEmployees } = useQuery<EmployeeRecord[]>({
    queryKey: ['all_users_for_incentives', firmId],
    queryFn: async () => {
      const res: any = await rdk.request(
        customEndpoint({
          path: 'users',
          method: 'GET',
          params: {
            limit: -1,
            fields: ['*', 'employee_category_id.*'],
          },
        }),
      )
      return Array.isArray(res) ? res : res?.data || []
    },
    enabled: !!firmId,
  })

  // Filter Active Employees for the Add Modal
  const activeEmployeesForModal = useMemo(() => {
    return allUsers.filter((emp) => {
      const status = String(emp.status || '').toLowerCase().trim()
      if (['archived', 'deleted', 'suspended', 'inactive'].includes(status)) return false

      if (addEmpCat !== 'all') {
        const empCatId =
          emp.employee_category_id?.employee_category_id || emp.employee_category_id
        if (String(empCatId) !== String(addEmpCat)) return false
      }

      if (addEmpSearch.trim()) {
        const q = addEmpSearch.toLowerCase().trim()
        const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase()
        const code = String(emp.employee_code || '').toLowerCase()
        return fullName.includes(q) || code.includes(q)
      }

      return true
    })
  }, [allUsers, addEmpCat, addEmpSearch])

  const isAllModalEmployeesSelected = useMemo(() => {
    if (activeEmployeesForModal.length === 0) return false
    return activeEmployeesForModal.every((emp) => selectedEmpIds.includes(String(emp.id)))
  }, [activeEmployeesForModal, selectedEmpIds])

  const handleToggleSelectAllModal = (checked: boolean) => {
    if (checked) {
      const visibleIds = activeEmployeesForModal.map((e) => String(e.id))
      setSelectedEmpIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    } else {
      const visibleIds = new Set(activeEmployeesForModal.map((e) => String(e.id)))
      setSelectedEmpIds((prev) => prev.filter((id) => !visibleIds.has(id)))
    }
  }

  // Filtering for Main List
  const filteredIncentives = useMemo(() => {
    return rawIncentives.filter((item) => {
      const emp = item.employee_id || {}
      const empCatId =
        emp.employee_category_id?.employee_category_id || emp.employee_category_id

      if (selectedCategory !== 'all' && String(empCatId) !== String(selectedCategory)) {
        return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase()
        const code = String(emp.employee_code || '').toLowerCase()
        const rem = String(item.remarks || '').toLowerCase()
        const amt = String(item.incentive_amount || '')

        return (
          fullName.includes(q) ||
          code.includes(q) ||
          rem.includes(q) ||
          amt.includes(q)
        )
      }

      return true
    })
  }, [rawIncentives, selectedCategory, searchQuery])

  // Metrics
  const totalAmount = useMemo(() => {
    return filteredIncentives.reduce(
      (sum, item) => sum + (Number(item.incentive_amount) || 0),
      0,
    )
  }, [filteredIncentives])

  const uniqueEmployeesCount = useMemo(() => {
    const ids = new Set(
      filteredIncentives
        .map((item) =>
          typeof item.employee_id === 'object'
            ? item.employee_id?.id
            : item.employee_id,
        )
        .filter(Boolean),
    )
    return ids.size
  }, [filteredIncentives])

  // Grouped by Employee Data
  const groupedByEmployee = useMemo(() => {
    const map = new Map<
      string,
      {
        employee: IncentiveItem['employee_id']
        empId: string
        totalAmount: number
        entriesCount: number
        items: IncentiveItem[]
        latestDate: string
      }
    >()

    filteredIncentives.forEach((item) => {
      const emp = item.employee_id || ({} as any)
      const empId = emp.id || 'unknown'

      if (!map.has(empId)) {
        map.set(empId, {
          employee: emp,
          empId: empId,
          totalAmount: 0,
          entriesCount: 0,
          items: [],
          latestDate: item.incentive_date,
        })
      }

      const entry = map.get(empId)!
      entry.totalAmount += Number(item.incentive_amount) || 0
      entry.entriesCount += 1
      entry.items.push(item)
      if (new Date(item.incentive_date) > new Date(entry.latestDate)) {
        entry.latestDate = item.incentive_date
      }
    })

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount)
  }, [filteredIncentives])

  // Pagination Logic
  const currentList = selectedTab === 'all' ? filteredIncentives : groupedByEmployee
  const totalPages = Math.ceil(currentList.length / itemsPerPage) || 1
  const paginatedList = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage
    return currentList.slice(startIdx, startIdx + itemsPerPage)
  }, [currentList, currentPage, itemsPerPage])

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      return await rdk.request(deleteItem('incentives', id))
    },
    onSuccess: () => {
      toast.success('Incentive record deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['incentives'] })
      queryClient.invalidateQueries({ queryKey: ['all-employee-salary'] })
      queryClient.invalidateQueries({ queryKey: ['user-salary'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete incentive')
    },
  })

  const handleDelete = (e: React.MouseEvent, item: IncentiveItem) => {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this incentive record?')) {
      deleteMutation.mutate(item.incentive_id)
    }
  }

  const handleOpenEdit = (e: React.MouseEvent, item: IncentiveItem) => {
    e.stopPropagation()
    setSelectedIncentive(item)
    setEditDate(item.incentive_date ? item.incentive_date.slice(0, 10) : '')
    setEditAmount(String(item.incentive_amount || ''))
    setEditRemarks(item.remarks || '')
    setEditModalOpen(true)
  }

  // Update Mutation
  const handleUpdateIncentive = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedIncentive) return

    const amountNum = parseFloat(editAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid positive incentive amount')
      return
    }
    if (!editDate) {
      toast.error('Please select a date')
      return
    }

    setIsSubmittingEdit(true)
    try {
      await rdk.request(
        updateItem('incentives', selectedIncentive.incentive_id, {
          incentive_date: editDate,
          incentive_amount: amountNum,
          remarks: editRemarks.trim(),
        }),
      )
      toast.success('Incentive updated successfully')
      queryClient.invalidateQueries({ queryKey: ['incentives'] })
      queryClient.invalidateQueries({ queryKey: ['all-employee-salary'] })
      queryClient.invalidateQueries({ queryKey: ['user-salary'] })
      setEditModalOpen(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to update incentive')
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  // Bulk Create Submission
  const handleCreateBulkIncentive = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountNum = parseFloat(addAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid positive incentive amount')
      return
    }
    if (selectedEmpIds.length === 0) {
      toast.error('Please select at least one employee')
      return
    }
    if (!addDate) {
      toast.error('Please select an incentive date')
      return
    }

    setIsSubmittingAdd(true)
    const toastId = toast.loading(`Adding incentives for ${selectedEmpIds.length} employee(s)...`)

    try {
      const promises = selectedEmpIds.map((empId) =>
        rdk.request(
          createItem('incentives', {
            employee_id: empId,
            incentive_date: addDate,
            incentive_amount: amountNum,
            remarks: addRemarks.trim() || 'Performance Incentive',
          }),
        ),
      )

      await Promise.all(promises)
      toast.success(`Incentives added for ${selectedEmpIds.length} employee(s)`, { id: toastId })
      queryClient.invalidateQueries({ queryKey: ['incentives'] })
      queryClient.invalidateQueries({ queryKey: ['all-employee-salary'] })
      queryClient.invalidateQueries({ queryKey: ['user-salary'] })

      setAddModalOpen(false)
      setAddAmount('')
      setAddRemarks('')
      setSelectedEmpIds([])
    } catch (err: any) {
      console.error('Error creating incentives:', err)
      toast.error(err.message || 'Failed to create incentives', { id: toastId })
    } finally {
      setIsSubmittingAdd(false)
    }
  }

  // Export to Excel
  const handleExportExcel = async () => {
    setIsExporting(true)
    const toastId = toast.loading('Exporting incentive report...')
    try {
      const firmName =
        (user as any)?.firm_id?.firm_name || (user as any)?.firm_name || 'My Firm'
      const month = String(startDate.getMonth() + 1)
      const year = String(startDate.getFullYear())
      const selectedEmpIdsToExport = filteredIncentives
        .map((i) => (typeof i.employee_id === 'object' ? i.employee_id?.id : i.employee_id))
        .filter(Boolean) as string[]

      await downloadMultiIncentiveExcel(
        allUsers,
        month,
        year,
        firmName,
        selectedEmpIdsToExport,
      )
      toast.success('Incentive report exported successfully', { id: toastId })
    } catch (err) {
      console.error('Export error:', err)
      toast.error('Failed to export incentive report', { id: toastId })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Panel
      className={cn(
        'flex min-w-0 flex-1 flex-col h-full overflow-hidden',
        firstTabActive && 'rounded-tl-none',
      )}
    >
      {/* 1. Header Toolbar (Clients Design System) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-card/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Award className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">Incentives</h1>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {rawIncentives.length} Total
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage bonus pay, spot awards, commission incentives, and performance rewards.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchIncentives()}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-2xs"
            title="Refresh incentives"
          >
            <RefreshCw
              className={cn('size-3.5', isFetchingIncentives && 'animate-spin text-primary')}
            />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={isExporting || filteredIncentives.length === 0}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-2xs"
          >
            {isExporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
            )}
            <span>Export Excel</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setAddDate(new Date().toISOString().slice(0, 10))
              setAddAmount('')
              setAddRemarks('')
              setSelectedEmpIds([])
              setAddModalOpen(true)
            }}
            className="h-8 gap-1.5 cursor-pointer text-xs font-semibold shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>Add Incentive</span>
          </Button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-6 pb-2 shrink-0">
        <div className="rounded-xl border border-gray-200 dark:border-border bg-card p-4 shadow-xs flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <IndianRupee className="size-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-muted-foreground block uppercase tracking-wider">
              Total Disbursed
            </span>
            <span className="text-lg font-bold text-foreground">
              {formatCurrency(totalAmount)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-border bg-card p-4 shadow-xs flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 border border-blue-500/20">
            <Users className="size-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-muted-foreground block uppercase tracking-wider">
              Rewarded Employees
            </span>
            <span className="text-lg font-bold text-foreground">
              {uniqueEmployeesCount} Staff
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-border bg-card p-4 shadow-xs flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/20">
            <Award className="size-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-muted-foreground block uppercase tracking-wider">
              Incentive Entries
            </span>
            <span className="text-lg font-bold text-foreground">
              {filteredIncentives.length} Entries
            </span>
          </div>
        </div>
      </div>

      {/* 3. Filters & Tabs Bar */}
      <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Tabs: All Entries vs Grouped */}
        <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-gray-200 dark:border-border">
          <button
            type="button"
            onClick={() => {
              setSelectedTab('all')
              setCurrentPage(1)
            }}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-all',
              selectedTab === 'all'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            All Entries ({filteredIncentives.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedTab('grouped')
              setCurrentPage(1)
            }}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-all',
              selectedTab === 'grouped'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Grouped By Employee ({groupedByEmployee.length})
          </button>
        </div>

        {/* Date presets & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-gray-200 dark:border-border overflow-hidden bg-card text-xs">
            <button
              type="button"
              onClick={() => handleApplyPreset('this_month')}
              className={cn(
                'px-2.5 py-1.5 font-medium transition-colors cursor-pointer border-r border-gray-200 dark:border-border',
                activePreset === 'this_month' ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted text-muted-foreground',
              )}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('last_month')}
              className={cn(
                'px-2.5 py-1.5 font-medium transition-colors cursor-pointer border-r border-gray-200 dark:border-border',
                activePreset === 'last_month' ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted text-muted-foreground',
              )}
            >
              Last Month
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('today')}
              className={cn(
                'px-2.5 py-1.5 font-medium transition-colors cursor-pointer',
                activePreset === 'today' ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted text-muted-foreground',
              )}
            >
              Today
            </button>
          </div>

          {/* Custom Date Pickers */}
          <div className="flex items-center gap-1.5 shrink-0">
            <DatePicker
              value={startDate}
              onChange={(d) => {
                if (d) {
                  setStartDate(d)
                  setActivePreset('custom')
                }
              }}
              format="medium"
              className="h-8 text-xs w-[120px]"
            />
            <span className="text-xs text-muted-foreground shrink-0 px-0.5">to</span>
            <DatePicker
              value={endDate}
              onChange={(d) => {
                if (d) {
                  setEndDate(d)
                  setActivePreset('custom')
                }
              }}
              format="medium"
              className="h-8 text-xs w-[120px]"
            />
          </div>

          {/* Category Dropdown */}
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-8 text-xs w-[160px] bg-card border-gray-200 dark:border-border">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c: any) => (
                <SelectItem
                  key={c.employee_category_id}
                  value={String(c.employee_category_id)}
                >
                  {c.employee_category_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search Input */}
          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search employee, remarks..."
              className="h-8 pl-8 text-xs w-[200px] bg-card border-gray-200 dark:border-border"
            />
          </div>
        </div>
      </div>

      {/* 4. Main Table Area (Edge-to-Edge Spreadsheet Grid matching Clients) */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isLoadingIncentives ? (
          <div className="flex flex-col items-center justify-center p-16 gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-xs">Loading incentive records...</span>
          </div>
        ) : selectedTab === 'all' ? (
          /* ALL ENTRIES TABLE */
          <table className="w-full border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-xs text-[11px] font-bold uppercase tracking-wider text-muted-foreground select-none">
              <tr className="border-b border-border divide-x divide-border/60">
                <th className="py-2.5 px-3 border-b border-r border-border w-12 text-center">
                  #
                </th>
                <th className="py-2.5 px-3 border-b border-r border-border min-w-[200px]">
                  Employee
                </th>
                <th className="py-2.5 px-3 border-b border-r border-border min-w-[120px]">
                  Category
                </th>
                <th className="py-2.5 px-3 border-b border-r border-border min-w-[110px]">
                  Date
                </th>
                <th className="py-2.5 px-3 border-b border-r border-border min-w-[120px] text-right">
                  Amount
                </th>
                <th className="py-2.5 px-3 border-b border-r border-border min-w-[200px]">
                  Remarks
                </th>
                <th className="py-2.5 px-3 border-b border-r border-border w-24 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-16 text-center text-muted-foreground border-b border-border">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Award className="size-8 text-muted-foreground/40 mb-1" />
                      <p className="font-semibold text-foreground">No incentives found</p>
                      <p className="text-xs text-muted-foreground">
                        Try adjusting your date range or filters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedList.map((item: any, idx) => {
                  const emp = item.employee_id || {}
                  const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Employee'
                  const categoryName =
                    emp.employee_category_id?.employee_category_name || '-'

                  return (
                    <tr
                      key={item.incentive_id || idx}
                      className="group transition-colors hover:bg-muted/40"
                    >
                      <td className="py-2.5 px-3 text-center text-muted-foreground border-b border-r border-gray-200 dark:border-border font-medium">
                        {(currentPage - 1) * itemsPerPage + idx + 1}
                      </td>
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-full bg-muted border border-gray-200 dark:border-border flex items-center justify-center overflow-hidden shrink-0">
                            {emp.avatar ? (
                              <img
                                src={`${ATTENDANCE_SERVER_URL}/assets/${emp.avatar}`}
                                alt=""
                                className="size-full object-cover"
                              />
                            ) : (
                              <span className="font-bold text-[11px] text-muted-foreground uppercase">
                                {(emp.first_name || 'U')[0]}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground block truncate">
                              {fullName}
                            </span>
                            <span className="text-[10px] text-muted-foreground block truncate">
                              {emp.employee_code ? `Code: ${emp.employee_code}` : emp.title || '-'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <Badge variant="outline" className="text-[10px] font-medium">
                          {categoryName}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border font-medium">
                        {formatDateDisplay(item.incentive_date)}
                      </td>
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(item.incentive_amount)}
                      </td>
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border text-muted-foreground">
                        {item.remarks || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right border-b border-r border-gray-200 dark:border-border">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleOpenEdit(e, item)}
                            className="size-7 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Edit Incentive"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDelete(e, item)}
                            className="size-7 cursor-pointer text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                            title="Delete Incentive"
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
          ) : (
            /* GROUPED BY EMPLOYEE TABLE */
            <table className="w-full border-separate border-spacing-0 text-left text-xs">
              <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-xs text-[11px] font-bold uppercase tracking-wider text-muted-foreground select-none">
                <tr className="border-b border-border divide-x divide-border/60">
                  <th className="py-2.5 px-3 border-b border-r border-border w-10 text-center"></th>
                  <th className="py-2.5 px-3 border-b border-r border-border min-w-[200px]">
                    Employee
                  </th>
                  <th className="py-2.5 px-3 border-b border-r border-border min-w-[120px]">
                    Category
                  </th>
                  <th className="py-2.5 px-3 border-b border-r border-border min-w-[100px] text-center">
                    Entries
                  </th>
                  <th className="py-2.5 px-3 border-b border-r border-border min-w-[120px]">
                    Latest Date
                  </th>
                  <th className="py-2.5 px-3 border-b border-r border-border min-w-[140px] text-right">
                    Total Incentive
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-border">
                {paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-muted-foreground">
                      No employees found with incentives in this period.
                    </td>
                  </tr>
                ) : (
                  paginatedList.map((group: any) => {
                    const isExpanded = expandedEmployeeId === group.empId
                    const emp = group.employee || {}
                    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Employee'
                    const categoryName =
                      emp.employee_category_id?.employee_category_name || '-'

                    return (
                      <React.Fragment key={group.empId}>
                        <tr
                          onClick={() =>
                            setExpandedEmployeeId((prev) =>
                              prev === group.empId ? null : group.empId,
                            )
                          }
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                        >
                          <td className="p-3 text-center border-r border-gray-200 dark:border-border text-muted-foreground">
                            {isExpanded ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                          </td>
                          <td className="p-3 border-r border-gray-200 dark:border-border">
                            <div className="flex items-center gap-2.5">
                              <div className="size-8 rounded-full bg-muted border border-gray-200 dark:border-border flex items-center justify-center overflow-hidden shrink-0">
                                {emp.avatar ? (
                                  <img
                                    src={`${ATTENDANCE_SERVER_URL}/assets/${emp.avatar}`}
                                    alt=""
                                    className="size-full object-cover"
                                  />
                                ) : (
                                  <span className="font-bold text-[11px] text-muted-foreground uppercase">
                                    {(emp.first_name || 'U')[0]}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-foreground block truncate">
                                  {fullName}
                                </span>
                                <span className="text-[10px] text-muted-foreground block truncate">
                                  {emp.employee_code ? `Code: ${emp.employee_code}` : emp.title || '-'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 border-r border-gray-200 dark:border-border">
                            <Badge variant="outline" className="text-[10px] font-medium">
                              {categoryName}
                            </Badge>
                          </td>
                          <td className="p-3 border-r border-gray-200 dark:border-border text-center font-bold">
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                              {group.entriesCount}
                            </Badge>
                          </td>
                          <td className="p-3 border-r border-gray-200 dark:border-border font-medium">
                            {formatDateDisplay(group.latestDate)}
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(group.totalAmount)}
                          </td>
                        </tr>

                        {/* Expanded details rows */}
                        {isExpanded && (
                          <tr className="bg-muted/10">
                            <td colSpan={6} className="p-4 pl-12 border-b border-gray-200 dark:border-border">
                              <div className="rounded-lg border border-gray-200 dark:border-border overflow-hidden bg-background">
                                <table className="w-full text-xs">
                                  <thead className="bg-muted/30 font-semibold text-muted-foreground">
                                    <tr>
                                      <th className="p-2.5 text-left border-b border-gray-200 dark:border-border">Date</th>
                                      <th className="p-2.5 text-left border-b border-gray-200 dark:border-border">Remarks</th>
                                      <th className="p-2.5 text-right border-b border-gray-200 dark:border-border">Amount</th>
                                      <th className="p-2.5 text-center border-b border-gray-200 dark:border-border w-20">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200 dark:divide-border">
                                    {group.items.map((subItem: any) => (
                                      <tr key={subItem.incentive_id} className="hover:bg-muted/20">
                                        <td className="p-2.5 font-medium">{formatDateDisplay(subItem.incentive_date)}</td>
                                        <td className="p-2.5 text-muted-foreground">{subItem.remarks || '-'}</td>
                                        <td className="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                          {formatCurrency(subItem.incentive_amount)}
                                        </td>
                                        <td className="p-2.5 text-center">
                                          <div className="flex items-center justify-center gap-1">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={(e) => handleOpenEdit(e, subItem)}
                                              className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                                            >
                                              <Pencil className="size-3.5" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={(e) => handleDelete(e, subItem)}
                                              className="size-6 text-muted-foreground hover:text-rose-600 cursor-pointer"
                                            >
                                              <Trash2 className="size-3" />
                                            </Button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          )}
      </div>

      {/* 5. Pagination Bar (Exact Clients Design System) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 bg-card shrink-0 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>Show</span>
          <Select
            value={String(itemsPerPage)}
            onValueChange={(val) => {
              setItemsPerPage(Number(val))
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="h-7 w-[68px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="15">15</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span>per page &bull; {currentList.length} total items</span>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <span>
            Page {currentPage} of {totalPages}
          </span>
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

      {/* ── ADD INCENTIVE MODAL (Multi-Employee Support) ── */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6 gap-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Award className="size-4 text-primary" />
              <span>Add Employee Incentive</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateBulkIncentive} className="flex flex-col gap-4 overflow-hidden flex-1">
            {/* Top Inputs: Date, Amount, Remarks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">
                  Incentive Date <span className="text-rose-500">*</span>
                </label>
                <DatePicker
                  value={addDate ? new Date(`${addDate}T00:00:00`) : undefined}
                  onChange={(d) => {
                    if (d) {
                      const y = d.getFullYear()
                      const m = String(d.getMonth() + 1).padStart(2, '0')
                      const day = String(d.getDate()).padStart(2, '0')
                      setAddDate(`${y}-${m}-${day}`)
                    }
                  }}
                  className="w-full h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">
                  Amount per Employee <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                    ₹
                  </span>
                  <Input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="e.g. 2000"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    className="pl-7 h-9 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-foreground mb-1.5 block">
                  Remarks / Reason
                </label>
                <Input
                  placeholder="e.g. Diwali Performance Bonus, Target Completion Reward"
                  value={addRemarks}
                  onChange={(e) => setAddRemarks(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Employee Selection Section */}
            <div className="border border-gray-200 dark:border-border rounded-xl p-3 flex flex-col gap-2.5 bg-muted/10 overflow-hidden flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Select Employees ({selectedEmpIds.length} chosen)
                </span>
                <div className="flex items-center gap-2">
                  <Select value={addEmpCat} onValueChange={setAddEmpCat}>
                    <SelectTrigger className="h-7 text-xs w-[130px] bg-background">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((c: any) => (
                        <SelectItem
                          key={c.employee_category_id}
                          value={String(c.employee_category_id)}
                        >
                          {c.employee_category_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="relative">
                    <Search className="size-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Filter staff..."
                      value={addEmpSearch}
                      onChange={(e) => setAddEmpSearch(e.target.value)}
                      className="h-7 pl-6 text-xs w-[130px] bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Select All Row */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-gray-200 dark:border-border text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-foreground">
                  <Checkbox
                    checked={isAllModalEmployeesSelected}
                    onCheckedChange={(checked) => handleToggleSelectAllModal(!!checked)}
                  />
                  <span>Select All Filtered Staff ({activeEmployeesForModal.length})</span>
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {selectedEmpIds.length} Selected
                </span>
              </div>

              {/* Scrollable Staff list */}
              <div className="overflow-y-auto max-h-[220px] flex flex-col gap-1 pr-1">
                {isLoadingEmployees ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span>Loading staff directory...</span>
                  </div>
                ) : activeEmployeesForModal.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    No active staff found.
                  </div>
                ) : (
                  activeEmployeesForModal.map((emp) => {
                    const isChecked = selectedEmpIds.includes(String(emp.id))
                    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Employee'
                    const catName = emp.employee_category_id?.employee_category_name || '-'

                    return (
                      <label
                        key={emp.id}
                        className={cn(
                          'flex items-center justify-between p-2 rounded-lg border border-gray-200 dark:border-border text-xs cursor-pointer transition-colors bg-background',
                          isChecked && 'bg-primary/5 border-primary/40',
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const strId = String(emp.id)
                              setSelectedEmpIds((prev) =>
                                checked ? [...prev, strId] : prev.filter((id) => id !== strId),
                              )
                            }}
                          />
                          <div className="size-6 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                            {emp.avatar ? (
                              <img
                                src={`${ATTENDANCE_SERVER_URL}/assets/${emp.avatar}`}
                                alt=""
                                className="size-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] font-bold text-muted-foreground">
                                {(emp.first_name || 'U')[0]}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground block truncate">
                              {fullName}
                            </span>
                            <span className="text-[10px] text-muted-foreground block truncate">
                              {emp.employee_code ? `Code: ${emp.employee_code}` : emp.title || '-'}
                            </span>
                          </div>
                        </div>

                        <Badge variant="outline" className="text-[10px] font-medium shrink-0">
                          {catName}
                        </Badge>
                      </label>
                    )
                  })
                )}
              </div>
            </div>

            <DialogFooter className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddModalOpen(false)}
                disabled={isSubmittingAdd}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingAdd || selectedEmpIds.length === 0}
                className="gap-2"
              >
                {isSubmittingAdd ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5" />
                    <span>Disburse to {selectedEmpIds.length} Staff</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── EDIT INCENTIVE MODAL ── */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md p-6 gap-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="size-4 text-primary" />
              <span>Edit Incentive Record</span>
            </DialogTitle>
          </DialogHeader>

          {selectedIncentive && (
            <form onSubmit={handleUpdateIncentive} className="flex flex-col gap-4">
              {/* Employee Preview Header */}
              <div className="p-3 rounded-xl border border-gray-200 dark:border-border bg-muted/20 flex items-center gap-3">
                <div className="size-9 rounded-full bg-muted border border-gray-200 dark:border-border flex items-center justify-center overflow-hidden shrink-0">
                  {selectedIncentive.employee_id?.avatar ? (
                    <img
                      src={`${ATTENDANCE_SERVER_URL}/assets/${selectedIncentive.employee_id.avatar}`}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="font-bold text-xs text-muted-foreground uppercase">
                      {(selectedIncentive.employee_id?.first_name || 'U')[0]}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-foreground text-xs block truncate">
                    {selectedIncentive.employee_id?.first_name}{' '}
                    {selectedIncentive.employee_id?.last_name || ''}
                  </span>
                  <span className="text-[11px] text-muted-foreground block truncate">
                    {selectedIncentive.employee_id?.title ||
                      selectedIncentive.employee_id?.employee_category_id?.employee_category_name ||
                      '-'}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">
                  Incentive Date <span className="text-rose-500">*</span>
                </label>
                <DatePicker
                  value={editDate ? new Date(`${editDate}T00:00:00`) : undefined}
                  onChange={(d) => {
                    if (d) {
                      const y = d.getFullYear()
                      const m = String(d.getMonth() + 1).padStart(2, '0')
                      const day = String(d.getDate()).padStart(2, '0')
                      setEditDate(`${y}-${m}-${day}`)
                    }
                  }}
                  className="w-full h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">
                  Amount <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                    ₹
                  </span>
                  <Input
                    type="number"
                    min="1"
                    step="any"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="pl-7 h-9 text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">Remarks</label>
                <Input
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <DialogFooter className="flex items-center justify-between gap-2 pt-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    if (window.confirm('Delete this incentive permanently?')) {
                      deleteMutation.mutate(selectedIncentive.incentive_id, {
                        onSuccess: () => setEditModalOpen(false),
                      })
                    }
                  }}
                  className="h-8 text-xs font-semibold"
                >
                  Delete
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditModalOpen(false)}
                    disabled={isSubmittingEdit}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingEdit}
                    className="h-8 text-xs font-semibold"
                  >
                    {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Panel>
  )
}
