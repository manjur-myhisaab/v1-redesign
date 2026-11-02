import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import ExcelJS from 'exceljs'
import {
  Clock,
  CheckCircle2,
  XCircle,
  IndianRupee,
  Search,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Paperclip,
  Check,
  Ban,
  Edit2,
  Eye,
  Pencil,
  FileSpreadsheet,
  RefreshCw,
  Receipt,
  ZoomIn,
  Maximize2,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import Panel from '@/components/admin/Panel'
import ImageLightbox from '@/components/ui/image-lightbox'
import { useResizableColumns, ColumnResizer } from '@/hooks/useResizableColumns'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import rdk, {
  API_URL,
  ATTENDANCE_SERVER_URL,
  readItems,
  updateItem,
  createItem,
} from '@/services/server'
import { useAuth } from '@/context/auth/AuthContext'
import { isRoleAdmin, isRoleManager } from '@/constants/roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import PersonAvatar from '@/components/admin/PersonAvatar'
import { useShell } from '@/components/admin/shell-context'
import { cn } from '@/lib/utils'

// --- Options & Helpers ---
const EXPENSE_TYPES = [
  'Travel / Conveyance',
  'Food & Meals',
  'Fuel & Mileage',
  'Hotel & Accommodation',
  'Office Supplies',
  'Client Entertainment',
  'Internet / Phone',
  'Medical',
  'Miscellaneous',
]

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatRupee(amount: number | string | undefined | null): string {
  const num = Number(amount || 0)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(num)
}

function getMonthLabel(ym: string) {
  const [year, month] = ym.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function shiftMonth(ym: string, delta: number) {
  const [year, month] = ym.split('-')
  const d = new Date(Number(year), Number(month) - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function renderStatusBadge(status?: string) {
  const s = (status || '').toLowerCase()
  if (s === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Approved
      </span>
    )
  }
  if (s === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
        <span className="size-1.5 rounded-full bg-rose-500" />
        Rejected
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
      <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
      Pending
    </span>
  )
}

export default function Expenses() {
  const { firstTabActive } = useShell()
  const { user, activeWorkspace } = useAuth()
  const queryClient = useQueryClient()

  const firmObj = (typeof user?.firm_id === 'object' ? user?.firm_id : null) as any
  const firmId = firmObj?.firm_id || (typeof user?.firm_id === 'string' ? user?.firm_id : null) || activeWorkspace?.id
  const firmName = firmObj?.firm_name || (typeof user?.firm_name === 'string' ? user?.firm_name : null) || activeWorkspace?.name || 'Company'

  const isAdmin = isRoleAdmin(user?.role) || user?.isSuperAdmin || user?.is_admin === true
  const isManager = isRoleManager(user?.role) || (!isAdmin && user?.employee_category_id !== null)

  // Current month default: YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Status Filter tab: 'all' | 'pending' | 'approved' | 'rejected'
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortSelected, setSortSelected] = useState<string>('date desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Advanced Table Filters & Sort states
  const [filterExpenseType, setFilterExpenseType] = useState<string>('all')
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all')
  const [filterHasBills, setFilterHasBills] = useState<string>('all')
  const [minAmount, setMinAmount] = useState<string>('')
  const [maxAmount, setMaxAmount] = useState<string>('')
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false)

  // Resizable columns
  const { colWidths, startResizing, isResizing, canSort } = useResizableColumns(
    {
      employee: 200,
      type: 140,
      amount: 130,
      date: 130,
      remarks: 220,
      bills: 90,
      status: 110,
      actions: 160,
    },
    { storageKey: 'expenses_table_widths', minWidth: 70 },
  )

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filterExpenseType !== 'all') count++
    if (filterEmployeeId !== 'all') count++
    if (filterHasBills !== 'all') count++
    if (minAmount.trim() !== '') count++
    if (maxAmount.trim() !== '') count++
    return count
  }, [filterExpenseType, filterEmployeeId, filterHasBills, minAmount, maxAmount])

  const handleResetFilters = () => {
    setFilterExpenseType('all')
    setFilterEmployeeId('all')
    setFilterHasBills('all')
    setMinAmount('')
    setMaxAmount('')
    setCurrentPage(1)
  }

  // Bulk selection
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)

  // Drawer state
  const [detailExpense, setDetailExpense] = useState<any | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Lightbox state for previewing attached receipts & bills
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxTitle, setLightboxTitle] = useState('')
  const [lightboxDesc, setLightboxDesc] = useState('')

  const openExpenseLightbox = (expense: any, initialIndex: number = 0) => {
    if (!Array.isArray(expense?.bill_image) || expense.bill_image.length === 0) return
    const urls = expense.bill_image.map(
      (b: any) => `${ATTENDANCE_SERVER_URL || API_URL}/assets/${b.directus_files_id || b.id}`
    )
    setLightboxImages(urls)
    setLightboxIndex(initialIndex)
    const empName = `${expense.employee_id?.first_name || ''} ${expense.employee_id?.last_name || ''}`.trim() || 'Employee'
    setLightboxTitle(`${empName} — Receipt #${initialIndex + 1}`)
    setLightboxDesc(
      `${expense.expense_entry_type || 'Expense'} · ${formatRupee(expense.amount)} · ${formatDisplayDate(expense.expense_date)}`
    )
    setLightboxOpen(true)
  }

  // Quick Action confirmation modal (Approve / Reject)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    type: 'approved' | 'rejected'
    expense: any | null
  }>({
    open: false,
    type: 'approved',
    expense: null,
  })
  const [confirmRemarks, setConfirmRemarks] = useState('')

  // Status Update modal (for arbitrary modifications)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusModalExpense, setStatusModalExpense] = useState<any | null>(null)
  const [statusModalTarget, setStatusModalTarget] = useState<string>('pending')
  const [statusModalRemarks, setStatusModalRemarks] = useState<string>('')

  // Add / Claim Expense modal (Admin/Manager submitting for employee)
  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [applyEmployeeId, setApplyEmployeeId] = useState('')
  const [applyType, setApplyType] = useState(EXPENSE_TYPES[0])
  const [applyAmount, setApplyAmount] = useState('')
  const [applyDate, setApplyDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [applyRemarks, setApplyRemarks] = useState('')

  // Dynamic Date Filter calculation for Server API (matching Expenses.jsx line 58)
  const filterDates = useMemo(() => {
    if (!selectedMonth) return null
    const [year, month] = selectedMonth.split('-')
    const startDate = new Date(Number(year), parseInt(month) - 1, 1)
    const endDate = new Date(Number(year), parseInt(month), 0)

    const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01T00:00:00`
    const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}T23:59:59`

    return {
      start: startStr,
      end: endStr,
      startDateStr: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`,
      endDateStr: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`,
    }
  }, [selectedMonth])

  // Fetch firm employees (for manager permissioning and employee select dropdown)
  const { data: firmEmployees = [] } = useQuery({
    queryKey: ['firm_users', firmId],
    queryFn: async () => {
      if (!firmId) return []
      try {
        const response: any = await rdk.request(
          readItems('users', {
            filter: {
              firm_id: { _eq: firmId },
              status: { _nin: ['archived', 'suspended'] },
            },
            fields: [
              'id',
              'first_name',
              'last_name',
              'email',
              'avatar',
              'employee_serial_no',
              'employee_code',
              'title',
              'department_name',
            ],
            limit: 500,
          }),
        )
        const rawRes = Array.isArray(response) ? response : response?.data || []
        return rawRes.filter((u: any) => { const st = (u.status || '').toLowerCase(); return st !== 'archived' && st !== 'suspended'; })
      } catch (err) {
        console.error('Error fetching firm users:', err)
        return []
      }
    },
    enabled: !!firmId,
    staleTime: 5 * 60 * 1000,
  })

  const managerPermittedIds = useMemo(() => {
    return firmEmployees.map((e: any) => e.id)
  }, [firmEmployees])

  // Main Expenses Query (matching Expenses.jsx line 76)
  const {
    data: expenses = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['expenses', selectedMonth, firmId, isManager],
    queryFn: async () => {
      let filterQuery: any = {}

      if (filterDates) {
        filterQuery = {
          expense_date: {
            _between: [filterDates.start, filterDates.end],
          },
        }
        if (isManager && managerPermittedIds.length > 0) {
          filterQuery.employee_id = {
            _in: managerPermittedIds,
          }
        }
      }

      const response: any = await rdk.request(
        readItems('expenses', {
          fields: [
            '*',
            'bill_image.*',
            'employee_id.*',
            'employee_id.employee_category_id.*',
            'user_updated.first_name',
            'user_updated.last_name',
          ],
          filter: filterQuery,
          sort: ['-date_created', '-expense_date'],
          limit: -1,
        }),
      )

      return Array.isArray(response) ? response : response?.data || []
    },
    enabled: !!firmId,
    refetchOnWindowFocus: false,
  })

  // Update Single Expense Mutation (matching Expenses.jsx line 106)
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      remark,
    }: {
      id: string | number
      status: string
      remark?: string | null
    }) => {
      const payload: any = { status }
      if (remark !== undefined) payload.remark = remark
      return await rdk.request(updateItem('expenses', id as any, payload))
    },
    onSuccess: (_, variables) => {
      const actionName =
        variables.status === 'approved'
          ? 'approved'
          : variables.status === 'rejected'
            ? 'rejected'
            : 'updated'
      toast.success(`Expense ${actionName} successfully!`)
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      setConfirmModal({ open: false, type: 'approved', expense: null })
      setStatusModalOpen(false)

      if (detailExpense && String(detailExpense.expense_id) === String(variables.id)) {
        setDetailExpense((prev: any) =>
          prev
            ? {
                ...prev,
                status: variables.status,
                remark: variables.remark ?? prev.remark,
              }
            : null,
        )
      }
    },
    onError: (err: any) => {
      console.error('Error updating expense:', err)
      toast.error(err?.message || 'Failed to update expense status')
    },
  })

  // Bulk Status Update Mutation (matching Expenses.jsx line 241)
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const promises = ids.map((id) =>
        rdk.request(updateItem('expenses', id as any, { status })),
      )
      return await Promise.all(promises)
    },
    onSuccess: (_, variables) => {
      toast.success(`Successfully updated ${variables.ids.length} expenses to ${variables.status}`)
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      setSelectedExpenseIds([])
      setBulkBusy(false)
    },
    onError: (err: any) => {
      console.error('Error during bulk update:', err)
      toast.error('Failed to update some expenses')
      setBulkBusy(false)
    },
  })

  // Create Expense Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await rdk.request(createItem('expenses', payload))
    },
    onSuccess: () => {
      toast.success('Expense claim submitted successfully!')
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      setApplyModalOpen(false)
      setApplyEmployeeId('')
      setApplyType(EXPENSE_TYPES[0])
      setApplyAmount('')
      setApplyRemarks('')
    },
    onError: (err: any) => {
      console.error('Error creating expense:', err)
      toast.error(err?.message || 'Failed to submit expense claim')
    },
  })

  // Metrics calculation
  const metrics = useMemo(() => {
    let pendingCount = 0
    let pendingAmount = 0
    let approvedCount = 0
    let approvedAmount = 0
    let rejectedCount = 0
    let totalAmount = 0

    expenses.forEach((item: any) => {
      const amt = Number(item.amount || 0)
      totalAmount += amt
      const s = (item.status || 'pending').toLowerCase()
      if (s === 'pending') {
        pendingCount++
        pendingAmount += amt
      } else if (s === 'approved') {
        approvedCount++
        approvedAmount += amt
      } else if (s === 'rejected') {
        rejectedCount++
      }
    })

    return {
      totalCount: expenses.length,
      totalAmount,
      pendingCount,
      pendingAmount,
      approvedCount,
      approvedAmount,
      rejectedCount,
    }
  }, [expenses])

  // Dynamically resolve unique expense types
  const availableExpenseTypes = useMemo(() => {
    const set = new Set<string>()
    expenses.forEach((e: any) => {
      if (e.expense_entry_type) set.add(e.expense_entry_type)
    })
    return Array.from(set)
  }, [expenses])

  // Unique list of employees for the filter dropdown
  const filterEmployeeOptions = useMemo(() => {
    const map = new Map<string, string>()
    if (Array.isArray(firmEmployees)) {
      firmEmployees.forEach((emp: any) => {
        if (emp?.id) {
          const name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Staff'
          map.set(String(emp.id), name)
        }
      })
    }
    expenses.forEach((item: any) => {
      const emp = item?.employee_id
      if (emp) {
        const id = typeof emp === 'object' && emp !== null ? String(emp.id || '') : String(emp)
        if (id && !map.has(id)) {
          const name =
            typeof emp === 'object' && emp !== null
              ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || `Staff #${id.slice(-6)}`
              : `Staff #${id.slice(-6)}`
          map.set(id, name)
        }
      }
    })
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [firmEmployees, expenses])

  // Filtered & Sorted Expenses
  const filteredAndSortedExpenses = useMemo(() => {
    let result = [...expenses]

    // Status tab filter
    if (selectedStatusTab !== 'all') {
      result = result.filter(
        (item) => (item.status || 'pending').toLowerCase() === selectedStatusTab,
      )
    }

    // Employee filter
    if (filterEmployeeId !== 'all') {
      result = result.filter((item) => {
        const empId = String(item.employee_id?.id || item.employee_id || '')
        return empId === filterEmployeeId
      })
    }

    // Expense Type filter
    if (filterExpenseType !== 'all') {
      result = result.filter(
        (item) => (item.expense_entry_type || '').toLowerCase() === filterExpenseType.toLowerCase(),
      )
    }

    // Has Bills filter
    if (filterHasBills === 'yes') {
      result = result.filter((item) => Array.isArray(item.bill_image) && item.bill_image.length > 0)
    } else if (filterHasBills === 'no') {
      result = result.filter((item) => !Array.isArray(item.bill_image) || item.bill_image.length === 0)
    }

    // Min / Max Amount filter
    if (minAmount.trim() && !isNaN(Number(minAmount))) {
      result = result.filter((item) => Number(item.amount || 0) >= Number(minAmount))
    }
    if (maxAmount.trim() && !isNaN(Number(maxAmount))) {
      result = result.filter((item) => Number(item.amount || 0) <= Number(maxAmount))
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((item) => {
        const fullName = `${item.employee_id?.first_name || ''} ${item.employee_id?.last_name || ''}`.toLowerCase()
        const remark = (item.remark || '').toLowerCase()
        const type = (item.expense_entry_type || '').toLowerCase()
        const amountStr = String(item.amount || '')
        const code = (item.employee_id?.employee_serial_no || item.employee_id?.employee_code || '').toLowerCase()

        return (
          fullName.includes(q) ||
          remark.includes(q) ||
          type.includes(q) ||
          amountStr.includes(q) ||
          code.includes(q)
        )
      })
    }

    // Sorting
    const [sortKey, sortDir] = sortSelected.split(' ')
    result.sort((a, b) => {
      if (sortKey === 'name') {
        const nameA = `${a.employee_id?.first_name || ''} ${a.employee_id?.last_name || ''}`.toLowerCase()
        const nameB = `${b.employee_id?.first_name || ''} ${b.employee_id?.last_name || ''}`.toLowerCase()
        return sortDir === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
      } else if (sortKey === 'amount') {
        const amtA = Number(a.amount || 0)
        const amtB = Number(b.amount || 0)
        return sortDir === 'asc' ? amtA - amtB : amtB - amtA
      } else {
        // Date sort
        const dateA = new Date(a.expense_date || 0).getTime()
        const dateB = new Date(b.expense_date || 0).getTime()
        return sortDir === 'asc' ? dateA - dateB : dateB - dateA
      }
    })

    return result
  }, [
    expenses,
    selectedStatusTab,
    filterExpenseType,
    filterHasBills,
    minAmount,
    maxAmount,
    searchQuery,
    sortSelected,
  ])

  // Column header sort toggle handler
  const handleSortToggle = (columnKey: 'date' | 'amount' | 'name') => {
    if (!canSort()) return
    const [currentKey, currentDir] = sortSelected.split(' ')
    if (currentKey === columnKey) {
      setSortSelected(`${columnKey} ${currentDir === 'asc' ? 'desc' : 'asc'}`)
    } else {
      setSortSelected(`${columnKey} ${columnKey === 'amount' ? 'desc' : columnKey === 'name' ? 'asc' : 'desc'}`)
    }
  }

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedExpenses.length / itemsPerPage))
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredAndSortedExpenses.slice(start, start + itemsPerPage)
  }, [filteredAndSortedExpenses, currentPage, itemsPerPage])

  // Checkbox handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedExpenseIds(filteredAndSortedExpenses.map((e) => String(e.expense_id)))
    } else {
      setSelectedExpenseIds([])
    }
  }

  const handleToggleSelectOne = (id: string) => {
    setSelectedExpenseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleBulkStatusChange = (status: 'pending' | 'approved' | 'rejected') => {
    if (selectedExpenseIds.length === 0 || bulkBusy) return
    setBulkBusy(true)
    bulkUpdateMutation.mutate({ ids: selectedExpenseIds, status })
  }

  // Quick Action confirmation
  const handleOpenConfirm = (expense: any, type: 'approved' | 'rejected') => {
    setConfirmRemarks(expense.remark || '')
    setConfirmModal({
      open: true,
      type,
      expense,
    })
  }

  const handleConfirmSubmit = () => {
    if (!confirmModal.expense) return
    updateMutation.mutate({
      id: confirmModal.expense.expense_id,
      status: confirmModal.type,
      remark: confirmRemarks || null,
    })
  }

  const handleOpenStatusModal = (expense: any) => {
    setStatusModalExpense(expense)
    setStatusModalTarget(expense.status || 'pending')
    setStatusModalRemarks(expense.remark || '')
    setStatusModalOpen(true)
  }

  const handleStatusModalSubmit = () => {
    if (!statusModalExpense) return
    updateMutation.mutate({
      id: statusModalExpense.expense_id,
      status: statusModalTarget,
      remark: statusModalRemarks || null,
    })
  }

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!applyEmployeeId) {
      toast.error('Please select an employee')
      return
    }
    if (!applyAmount || isNaN(Number(applyAmount)) || Number(applyAmount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    const payload: any = {
      employee_id: applyEmployeeId,
      expense_entry_type: applyType,
      amount: Number(applyAmount),
      expense_date: `${applyDate}T00:00:00`,
      remark: applyRemarks || 'Expense claim',
      status: 'pending',
    }

    createMutation.mutate(payload)
  }

  // --- Excel Export (Replicating downloadAllEmployeeExpenseExcel.js) ---
  const handleDownloadExcel = async () => {
    if (expenses.length === 0) {
      toast.error('No expense records to export')
      return
    }

    try {
      toast.loading('Generating Excel report...', { id: 'expense-excel' })
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Expense Report')

      const headingFont = { bold: true, size: 14 }
      const subheadingFont = { bold: true, size: 11 }
      const parentRowFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      }
      const headerFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
      }
      const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }

      worksheet.columns = [
        { key: 'col1', width: 25 },
        { key: 'col2', width: 20 },
        { key: 'col3', width: 20 },
        { key: 'col4', width: 20 },
        { key: 'col5', width: 22 },
        { key: 'col6', width: 16 },
        { key: 'col7', width: 16 },
        { key: 'col8', width: 16 },
        { key: 'col9', width: 35 },
        { key: 'col10', width: 20 },
      ]

      let currentRow = 1
      const LAST_COLUMN = 'J'

      worksheet.mergeCells(`A${currentRow}:${LAST_COLUMN}${currentRow}`)
      const firmCell = worksheet.getCell(`A${currentRow}`)
      firmCell.value = `${firmName} - Expense Report`
      firmCell.font = headingFont
      firmCell.alignment = { horizontal: 'center' }
      currentRow++

      worksheet.mergeCells(`A${currentRow}:${LAST_COLUMN}${currentRow}`)
      const dateCell = worksheet.getCell(`A${currentRow}`)
      dateCell.value = `Period: ${filterDates?.startDateStr} to ${filterDates?.endDateStr} (${getMonthLabel(selectedMonth)})`
      dateCell.font = subheadingFont
      dateCell.alignment = { horizontal: 'center' }
      currentRow++

      currentRow++ // Empty row

      const headers = [
        'Employee Name',
        'Designation',
        'Category',
        'Department',
        'Expense Type',
        'Date',
        'Amount',
        'Status',
        'Remarks',
        'Bill Link',
      ]

      const headerRow = worksheet.getRow(currentRow)
      headers.forEach((header, idx) => {
        const cell = headerRow.getCell(idx + 1)
        cell.value = header
        cell.font = { bold: true }
        cell.fill = headerFill
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = borderStyle
      })
      worksheet.views = [{ state: 'frozen', ySplit: currentRow }]
      currentRow++

      // Group by Employee
      const groupedData: Record<string, any> = {}
      expenses.forEach((expense: any) => {
        const empId = expense.employee_id?.id || 'unknown'
        if (!groupedData[empId]) {
          const emp = expense.employee_id || {}
          groupedData[empId] = {
            employeeName: `${emp.first_name || 'Unknown'} ${emp.last_name || ''}`.trim(),
            designation: emp.title || '-',
            category: emp.employee_category_id?.employee_category_name || '-',
            department: emp.department_name || '-',
            totalAmount: 0,
            claims: [],
          }
        }
        groupedData[empId].totalAmount += Number(expense.amount || 0)
        groupedData[empId].claims.push(expense)
      })

      Object.values(groupedData).forEach((group: any) => {
        const parentRow = worksheet.getRow(currentRow)
        parentRow.getCell(1).value = `👤 ${group.employeeName}`
        parentRow.getCell(2).value = group.designation
        parentRow.getCell(3).value = group.category
        parentRow.getCell(4).value = group.department
        parentRow.getCell(5).value = ''
        parentRow.getCell(6).value = ''
        parentRow.getCell(7).value = `₹${group.totalAmount}`
        parentRow.getCell(8).value = `${group.claims.length} Claims`
        parentRow.getCell(9).value = ''
        parentRow.getCell(10).value = ''

        for (let i = 1; i <= 10; i++) {
          const cell = parentRow.getCell(i)
          cell.font = { bold: true }
          cell.fill = parentRowFill
          cell.border = borderStyle
          cell.alignment = { vertical: 'middle', horizontal: i === 7 ? 'right' : 'left' }
        }
        parentRow.commit()
        currentRow++

        group.claims.forEach((claim: any) => {
          const date = formatDisplayDate(claim.expense_date)
          const status = (claim.status || 'PENDING').toUpperCase()

          const childRow = worksheet.getRow(currentRow)
          childRow.getCell(1).value = ''
          childRow.getCell(2).value = ''
          childRow.getCell(3).value = ''
          childRow.getCell(4).value = ''
          childRow.getCell(5).value = `↳ ${claim.expense_entry_type || 'Expense'}`
          childRow.getCell(6).value = date
          childRow.getCell(7).value = Number(claim.amount || 0)
          childRow.getCell(8).value = status
          childRow.getCell(9).value = claim.remark || '-'

          const billCell = childRow.getCell(10)
          if (claim.bill_image && claim.bill_image.length > 0) {
            const firstImg = claim.bill_image[0]
            const link = `${ATTENDANCE_SERVER_URL || API_URL}/assets/${firstImg.directus_files_id || firstImg.id}`
            billCell.value = {
              text: 'View Bill',
              hyperlink: link,
              tooltip: 'Click to open bill image',
            }
            billCell.font = { color: { argb: 'FF2563EB' }, underline: true }
          } else {
            billCell.value = 'No Bill'
          }

          for (let i = 1; i <= 10; i++) {
            const cell = childRow.getCell(i)
            cell.border = borderStyle
            cell.alignment = { vertical: 'middle', horizontal: i === 7 ? 'right' : 'left' }
          }

          const fillArgb =
            status === 'APPROVED' ? 'FFDCFCE7' : status === 'REJECTED' ? 'FFFEE2E2' : 'FFFEF3C7'
          childRow.getCell(8).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: fillArgb },
          }

          childRow.commit()
          currentRow++
        })
      })

      const fileName = `${firmName.replace(/\s+/g, '_')}_Expenses_${selectedMonth}.xlsx`
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = fileName
      link.click()
      URL.revokeObjectURL(link.href)

      toast.success('Excel report downloaded successfully!', { id: 'expense-excel' })
    } catch (err) {
      console.error('Failed to export Excel:', err)
      toast.error('Failed to generate Excel report', { id: 'expense-excel' })
    }
  }

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel
        className={cn(
          'flex min-w-0 flex-1 flex-col h-full overflow-hidden',
          firstTabActive && 'rounded-tl-none',
        )}
      >
        {/* 1. Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-card/60 backdrop-blur-sm shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
              Expense Claims
            </h1>
            <Badge variant="outline" className="text-[11px] font-normal px-2 py-0 border-border">
              {getMonthLabel(selectedMonth)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review, verify, and approve employee reimbursement requests and claims
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month Switcher */}
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5 shadow-2xs">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSelectedMonth((prev) => shiftMonth(prev, -1))
                setCurrentPage(1)
              }}
              title="Previous Month"
            >
              <ChevronLeft className="size-4" />
            </Button>

            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedMonth(e.target.value)
                  setCurrentPage(1)
                }
              }}
              className="h-7 border-0 bg-transparent px-2 text-xs font-semibold text-foreground cursor-pointer focus:outline-hidden"
            />

            <Button
              variant="ghost"
              size="icon"
              className="size-7 cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSelectedMonth((prev) => shiftMonth(prev, 1))
                setCurrentPage(1)
              }}
              title="Next Month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* Export Report CTA */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadExcel}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-2xs"
            title="Download Excel Report"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600" />
            Export Excel
          </Button>

          {/* New Expense CTA */}
          <Button
            size="sm"
            onClick={() => setApplyModalOpen(true)}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-xs"
          >
            <Plus className="size-3.5" />
            Add Expense
          </Button>
        </div>
      </div>

        {/* 2. Metric Stat Cards */}
        <div className="grid grid-cols-2 gap-3 p-4 border-b border-border bg-card/30 sm:grid-cols-4 shrink-0">
          {/* Total Amount Claimed */}
          <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-3.5 shadow-2xs">
            <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <IndianRupee className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Total Claimed
              </p>
              <p className="font-display text-xl font-bold tracking-tight text-foreground">
                {isLoading ? '—' : formatRupee(metrics.totalAmount)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {metrics.totalCount} {metrics.totalCount === 1 ? 'claim' : 'claims'}
              </p>
            </div>
          </div>

          {/* Pending Review */}
          <div
            onClick={() => {
              setSelectedStatusTab('pending')
              setCurrentPage(1)
            }}
            className={cn(
              'flex items-center gap-3.5 rounded-xl border p-3.5 shadow-2xs cursor-pointer transition-colors',
              selectedStatusTab === 'pending'
                ? 'border-amber-500/40 bg-amber-500/10'
                : 'border-border bg-card hover:bg-muted/40',
            )}
          >
            <div className="grid size-10 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-amber-600 dark:text-amber-400 uppercase">
                Pending Action
              </p>
              <p className="font-display text-xl font-bold tracking-tight text-foreground">
                {isLoading ? '—' : formatRupee(metrics.pendingAmount)}
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                {metrics.pendingCount} pending review
              </p>
            </div>
          </div>

          {/* Approved Claims */}
          <div
            onClick={() => {
              setSelectedStatusTab('approved')
              setCurrentPage(1)
            }}
            className={cn(
              'flex items-center gap-3.5 rounded-xl border p-3.5 shadow-2xs cursor-pointer transition-colors',
              selectedStatusTab === 'approved'
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-border bg-card hover:bg-muted/40',
            )}
          >
            <div className="grid size-10 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
                Approved
              </p>
              <p className="font-display text-xl font-bold tracking-tight text-foreground">
                {isLoading ? '—' : formatRupee(metrics.approvedAmount)}
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                {metrics.approvedCount} approved claims
              </p>
            </div>
          </div>

          {/* Rejected Claims */}
          <div
            onClick={() => {
              setSelectedStatusTab('rejected')
              setCurrentPage(1)
            }}
            className={cn(
              'flex items-center gap-3.5 rounded-xl border p-3.5 shadow-2xs cursor-pointer transition-colors',
              selectedStatusTab === 'rejected'
                ? 'border-rose-500/40 bg-rose-500/10'
                : 'border-border bg-card hover:bg-muted/40',
            )}
          >
            <div className="grid size-10 place-items-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <XCircle className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-rose-600 dark:text-rose-400 uppercase">
                Rejected
              </p>
              <p className="font-display text-xl font-bold tracking-tight text-foreground">
                {isLoading ? '—' : metrics.rejectedCount}
              </p>
              <p className="text-[11px] text-muted-foreground">claims rejected</p>
            </div>
          </div>
        </div>

        {/* Toolbar: Status Tabs + Bulk Selection Bar + Search + Sort + Refresh */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 bg-card shrink-0">
          {selectedExpenseIds.length > 0 ? (
            /* Bulk Actions Toolbar */
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={() => setSelectedExpenseIds([])}
                className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear selection"
              >
                <X className="size-3.5" />
              </button>
              <span className="text-[13px] font-medium text-primary">
                {selectedExpenseIds.length} expense(s) selected
              </span>

              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={bulkBusy}
                  onClick={() => handleBulkStatusChange('approved')}
                  className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <Check className="size-3" />
                  Approve Selected
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={bulkBusy}
                  onClick={() => handleBulkStatusChange('rejected')}
                  className="h-7 text-xs gap-1.5 text-rose-600 hover:bg-rose-50 border-rose-200 cursor-pointer"
                >
                  <Ban className="size-3" />
                  Reject Selected
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedExpenseIds([])}
                  className="h-7 text-xs cursor-pointer"
                >
                  Clear
                </Button>
              </div>
            </div>
          ) : (
            /* Normal Toolbar */
            <>
              {/* Status Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                {[
                  { id: 'all', label: 'All', count: metrics.totalCount },
                  { id: 'pending', label: 'Pending', count: metrics.pendingCount },
                  { id: 'approved', label: 'Approved', count: metrics.approvedCount },
                  { id: 'rejected', label: 'Rejected', count: metrics.rejectedCount },
                ].map((tab) => {
                  const isSelected = selectedStatusTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setSelectedStatusTab(tab.id)
                        setCurrentPage(1)
                      }}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer border shrink-0',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                          : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/80',
                      )}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                          isSelected
                            ? 'bg-primary-foreground/20 text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Search, Filter, Sort & Refresh */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search Input */}
                <div className="relative min-w-[170px] sm:w-56">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search claims..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="h-7.5 pl-8 pr-7 text-xs bg-muted/30 focus-visible:bg-background rounded-lg"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
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
                        activeFilterCount > 0 && 'text-primary font-semibold border-primary/20 bg-primary/5',
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
                  <PopoverContent align="end" className="w-72 p-3.5 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <p className="text-xs font-bold text-foreground">Filter Claims</p>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                        >
                          Reset all
                        </button>
                      )}
                    </div>

                    {/* Filter by Employee */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Employee</label>
                      <Select
                        value={filterEmployeeId}
                        onValueChange={(val) => {
                          setFilterEmployeeId(val)
                          setCurrentPage(1)
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder="All Employees" />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          <SelectItem value="all">All Employees</SelectItem>
                          {filterEmployeeOptions.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Filter by Expense Type */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Expense Type</label>
                      <Select value={filterExpenseType} onValueChange={(val) => { setFilterExpenseType(val); setCurrentPage(1); }}>
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {availableExpenseTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Filter by Attached Receipts */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Receipts / Bills</label>
                      <Select value={filterHasBills} onValueChange={(val) => { setFilterHasBills(val); setCurrentPage(1); }}>
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Claims</SelectItem>
                          <SelectItem value="yes">With Receipts Only</SelectItem>
                          <SelectItem value="no">Without Receipts</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Filter by Amount Range */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Amount Range (₹)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          placeholder="Min ₹"
                          value={minAmount}
                          onChange={(e) => { setMinAmount(e.target.value); setCurrentPage(1); }}
                          className="h-8 text-xs bg-background"
                        />
                        <Input
                          type="number"
                          placeholder="Max ₹"
                          value={maxAmount}
                          onChange={(e) => { setMaxAmount(e.target.value); setCurrentPage(1); }}
                          className="h-8 text-xs bg-background"
                        />
                      </div>
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
                      Sort Claims By
                    </div>
                    {[
                      { key: 'date desc', label: 'Date: Newest First' },
                      { key: 'date asc', label: 'Date: Oldest First' },
                      { key: 'amount desc', label: 'Amount: High to Low' },
                      { key: 'amount asc', label: 'Amount: Low to High' },
                      { key: 'name asc', label: 'Employee Name: A to Z' },
                      { key: 'name desc', label: 'Employee Name: Z to A' },
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

                {/* Refresh */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => refetch()}
                  className="size-7 cursor-pointer text-muted-foreground hover:text-foreground rounded-md"
                  title="Refresh claims"
                >
                  <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin text-primary')} />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* 3. Main Expenses Table (Spreadsheet Style) */}
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-20 bg-card shadow-2xs">
              <tr className="text-muted-foreground font-semibold">
                {/* Checkbox (Sticky Left) */}
                <th className="sticky left-0 top-0 z-30 bg-card py-2.5 px-3 w-10 text-center border-t border-b border-l border-r border-gray-200 dark:border-border shadow-[1px_0_0_0_rgba(0,0,0,0.06)]">
                  <Checkbox
                    checked={
                      filteredAndSortedExpenses.length > 0 &&
                      selectedExpenseIds.length === filteredAndSortedExpenses.length
                    }
                    onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                  />
                </th>
                <th
                  onClick={() => handleSortToggle('name')}
                  style={{ width: colWidths.employee, minWidth: colWidths.employee }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border cursor-pointer select-none hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 pr-2">
                    <span>EMPLOYEE</span>
                    {sortSelected.startsWith('name') ? (
                      sortSelected.endsWith('asc') ? <ArrowUp className="size-3 text-primary" /> : <ArrowDown className="size-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="size-3 text-muted-foreground/40" />
                    )}
                  </div>
                  <ColumnResizer
                    isResizing={isResizing === 'employee'}
                    onMouseDown={(e) => startResizing('employee', e)}
                  />
                </th>
                <th
                  style={{ width: colWidths.type, minWidth: colWidths.type }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border"
                >
                  <span className="pr-2">EXPENSE TYPE</span>
                  <ColumnResizer
                    isResizing={isResizing === 'type'}
                    onMouseDown={(e) => startResizing('type', e)}
                  />
                </th>
                <th
                  onClick={() => handleSortToggle('amount')}
                  style={{ width: colWidths.amount, minWidth: colWidths.amount }}
                  className="relative py-2.5 px-3 text-right border-t border-b border-r border-gray-200 dark:border-border cursor-pointer select-none hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5 pr-2">
                    <span>AMOUNT</span>
                    {sortSelected.startsWith('amount') ? (
                      sortSelected.endsWith('asc') ? <ArrowUp className="size-3 text-primary" /> : <ArrowDown className="size-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="size-3 text-muted-foreground/40" />
                    )}
                  </div>
                  <ColumnResizer
                    isResizing={isResizing === 'amount'}
                    onMouseDown={(e) => startResizing('amount', e)}
                  />
                </th>
                <th
                  onClick={() => handleSortToggle('date')}
                  style={{ width: colWidths.date, minWidth: colWidths.date }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border cursor-pointer select-none hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 pr-2">
                    <span>EXPENSE DATE</span>
                    {sortSelected.startsWith('date') ? (
                      sortSelected.endsWith('asc') ? <ArrowUp className="size-3 text-primary" /> : <ArrowDown className="size-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="size-3 text-muted-foreground/40" />
                    )}
                  </div>
                  <ColumnResizer
                    isResizing={isResizing === 'date'}
                    onMouseDown={(e) => startResizing('date', e)}
                  />
                </th>
                <th
                  style={{ width: colWidths.remarks, minWidth: colWidths.remarks }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border"
                >
                  <span className="pr-2">REMARKS / PURPOSE</span>
                  <ColumnResizer
                    isResizing={isResizing === 'remarks'}
                    onMouseDown={(e) => startResizing('remarks', e)}
                  />
                </th>
                <th
                  style={{ width: colWidths.bills, minWidth: colWidths.bills }}
                  className="relative py-2.5 px-3 text-center border-t border-b border-r border-gray-200 dark:border-border"
                >
                  <span className="pr-2">BILLS</span>
                  <ColumnResizer
                    isResizing={isResizing === 'bills'}
                    onMouseDown={(e) => startResizing('bills', e)}
                  />
                </th>
                <th
                  style={{ width: colWidths.status, minWidth: colWidths.status }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border"
                >
                  <span className="pr-2">STATUS</span>
                  <ColumnResizer
                    isResizing={isResizing === 'status'}
                    onMouseDown={(e) => startResizing('status', e)}
                  />
                </th>
                <th
                  style={{ width: colWidths.actions, minWidth: colWidths.actions }}
                  className="py-2.5 px-3 text-right border-t border-b border-r border-gray-200 dark:border-border"
                >
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-muted-foreground border-b border-l border-r border-gray-200 dark:border-border">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="size-6 animate-spin text-primary" />
                      <p className="text-sm font-medium">Loading expense claims...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-muted-foreground border-b border-l border-r border-gray-200 dark:border-border">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Receipt className="size-8 text-muted-foreground/40" />
                      <p className="text-sm font-medium">No expense records found.</p>
                      <p className="text-xs text-muted-foreground">
                        Try adjusting your search query, status tabs, or selected month.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((item: any) => {
                  const emp = item.employee_id
                  const fullName = `${emp?.first_name || ''} ${emp?.last_name || ''}`.trim() || 'Unnamed'
                  const code = emp?.employee_serial_no || emp?.employee_code || (emp?.id ? String(emp.id).slice(0, 8) : null)
                  const isSelected = selectedExpenseIds.includes(String(item.expense_id))
                  const isPending = (item.status || 'pending').toLowerCase() === 'pending'
                  const billCount = Array.isArray(item.bill_image) ? item.bill_image.length : 0

                  return (
                    <tr
                      key={item.expense_id}
                      onClick={() => {
                        setDetailExpense(item)
                        setDrawerOpen(true)
                      }}
                      className={cn(
                        'group transition-colors cursor-pointer hover:bg-muted/40',
                        isSelected && 'bg-primary/5',
                      )}
                    >
                      {/* Checkbox (Sticky Left) */}
                      <td
                        className={cn(
                          'sticky left-0 z-10 py-2.5 px-3 text-center border-b border-l border-r border-gray-200 dark:border-border transition-colors shadow-[1px_0_0_0_rgba(0,0,0,0.06)]',
                          isSelected ? 'bg-primary/5' : 'bg-card group-hover:bg-muted/40',
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleSelectOne(String(item.expense_id))
                        }}
                      >
                        <Checkbox checked={isSelected} />
                      </td>

                      {/* Employee Info */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <div className="flex items-center gap-2.5">
                          {emp?.avatar ? (
                            <img
                              src={`${API_URL}/assets/${emp.avatar}`}
                              alt={fullName}
                              className="size-7 rounded-full object-cover shrink-0 border border-border"
                              onError={(e) => {
                                ;(e.target as HTMLElement).style.display = 'none'
                              }}
                            />
                          ) : (
                            <PersonAvatar name={fullName} className="size-7 shrink-0 text-xs" />
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">{fullName}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {emp?.department_name || emp?.title || (code ? `#${code}` : 'Staff')}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Expense Type */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground border border-border">
                          {item.expense_entry_type || 'Expense'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-2.5 px-3 text-right border-b border-r border-gray-200 dark:border-border font-semibold text-foreground tabular-nums">
                        {formatRupee(item.amount)}
                      </td>

                      {/* Expense Date */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border text-foreground font-medium">
                        {formatDisplayDate(item.expense_date)}
                      </td>

                      {/* Remarks */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border max-w-[220px]">
                        <p className="text-foreground line-clamp-2 text-xs" title={item.remark}>
                          {item.remark || '—'}
                        </p>
                      </td>

                      {/* Attached Bills */}
                      <td className="py-2.5 px-3 text-center border-b border-r border-gray-200 dark:border-border">
                        {billCount > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openExpenseLightbox(item, 0)
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 px-2 py-0.5 text-[11px] font-medium cursor-pointer transition-colors shadow-2xs"
                            title="Click to view attached receipt in lightbox"
                          >
                            <Paperclip className="size-3" />
                            {billCount}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        {renderStatusBadge(item.status)}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-2.5 px-3 text-right border-b border-r border-gray-200 dark:border-border"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {/* View details */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDetailExpense(item)
                              setDrawerOpen(true)
                            }}
                            className="size-7 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="View Claim Details"
                          >
                            <Eye className="size-3.5" />
                          </Button>

                          {isPending ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenConfirm(item, 'approved')}
                                className="size-7 cursor-pointer text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                title="Approve Claim"
                              >
                                <Check className="size-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenConfirm(item, 'rejected')}
                                className="size-7 cursor-pointer text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title="Reject Claim"
                              >
                                <Ban className="size-3.5" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenStatusModal(item)}
                              className="size-7 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Edit / Update Status"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Bottom Sticky Pagination Bar */}
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground bg-card shadow-2xs shrink-0">
          <div className="flex items-center gap-1.5">
            <span>Show</span>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(val) => {
                setItemsPerPage(Number(val))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-6 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span>per page &middot; {filteredAndSortedExpenses.length} claims</span>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                variant="outline"
                size="icon"
                className="size-6 cursor-pointer"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-6 cursor-pointer"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="size-3" />
              </Button>
            </div>
          </div>
        </div>

      {/* --- Slide-Over Detail Drawer (Radix Sheet) --- */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col bg-card">
          {detailExpense && (
            <>
              {/* Drawer Header */}
              <SheetHeader className="p-5 border-b border-border bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    {detailExpense.employee_id?.avatar ? (
                      <img
                        src={`${API_URL}/assets/${detailExpense.employee_id.avatar}`}
                        alt=""
                        className="size-11 rounded-full object-cover border border-border shrink-0"
                      />
                    ) : (
                      <PersonAvatar
                        name={`${detailExpense.employee_id?.first_name || ''} ${detailExpense.employee_id?.last_name || ''}`}
                        className="size-11 text-sm shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <SheetTitle className="text-base font-bold text-foreground truncate">
                        {`${detailExpense.employee_id?.first_name || ''} ${detailExpense.employee_id?.last_name || ''}`.trim() || 'Unnamed'}
                      </SheetTitle>
                      <SheetDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                        {detailExpense.employee_id?.department_name || detailExpense.employee_id?.title || 'Staff Member'}
                      </SheetDescription>
                    </div>
                  </div>

                  <div className="mr-8 shrink-0">{renderStatusBadge(detailExpense.status)}</div>
                </div>
              </SheetHeader>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                {/* Section: Expense Summary Card */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Amount Claimed
                      </span>
                      <p className="text-2xl font-bold font-display text-primary mt-0.5">
                        {formatRupee(detailExpense.amount)}
                      </p>
                    </div>

                    <span className="inline-flex items-center rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold border border-border">
                      {detailExpense.expense_entry_type || 'Expense'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Expense Date</span>
                      <span className="font-semibold text-foreground mt-0.5 inline-block">
                        {formatDisplayDate(detailExpense.expense_date)}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">Submission Date</span>
                      <span className="font-semibold text-foreground mt-0.5 inline-block">
                        {formatDisplayDate(detailExpense.date_created)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <span className="text-muted-foreground block text-[11px] mb-1">Remarks / Purpose</span>
                    <p className="bg-muted/30 p-2.5 rounded-lg text-foreground leading-relaxed">
                      {detailExpense.remark || 'No description provided.'}
                    </p>
                  </div>
                </div>

                {/* Section: Attached Receipts & Bills */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                      Attached Bills & Receipts
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {Array.isArray(detailExpense.bill_image) ? detailExpense.bill_image.length : 0} file(s)
                    </span>
                  </div>

                  {Array.isArray(detailExpense.bill_image) && detailExpense.bill_image.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {detailExpense.bill_image.map((bill: any, i: number) => {
                        const fileUrl = `${ATTENDANCE_SERVER_URL || API_URL}/assets/${bill.directus_files_id || bill.id}`
                        return (
                          <div
                            key={i}
                            onClick={() => openExpenseLightbox(detailExpense, i)}
                            className="group/bill relative rounded-lg border border-border overflow-hidden bg-muted/20 hover:border-primary/50 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                          >
                            <div className="relative overflow-hidden aspect-video bg-muted/30">
                              <img
                                src={fileUrl}
                                alt={`Bill receipt ${i + 1}`}
                                className="w-full h-full object-cover transition-transform group-hover/bill:scale-105"
                                onError={(e) => {
                                  const target = e.target as HTMLElement
                                  target.style.display = 'none'
                                  if (target.parentElement) {
                                    target.parentElement.innerHTML = `<div class="w-full h-28 flex flex-col items-center justify-center p-2 text-muted-foreground"><svg class="size-6 mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><span class="text-[10px]">Receipt ${i + 1}</span></div>`
                                  }
                                }}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover/bill:bg-black/30 flex items-center justify-center transition-all opacity-0 group-hover/bill:opacity-100">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-black/75 text-white text-[11px] font-medium backdrop-blur-xs shadow-xs">
                                  <ZoomIn className="size-3.5" />
                                  Preview
                                </span>
                              </div>
                            </div>
                            <div className="p-1.5 flex items-center justify-between bg-card border-t border-border">
                              <span className="text-[10px] font-medium truncate">Receipt #{i + 1}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-6 text-muted-foreground hover:text-primary cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openExpenseLightbox(detailExpense, i)
                                }}
                                title="Open in Lightbox"
                              >
                                <Maximize2 className="size-3" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-muted-foreground">
                      <Receipt className="size-6 mx-auto mb-1 opacity-40" />
                      <p className="text-xs">No bills or receipts attached.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 border-t border-border bg-card flex items-center gap-2">
                {(detailExpense.status || 'pending').toLowerCase() === 'pending' ? (
                  <>
                    <Button
                      onClick={() => handleOpenConfirm(detailExpense, 'approved')}
                      className="flex-1 h-8 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1.5"
                    >
                      <Check className="size-3.5" />
                      Approve Claim
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleOpenConfirm(detailExpense, 'rejected')}
                      className="flex-1 h-8 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 cursor-pointer gap-1.5"
                    >
                      <Ban className="size-3.5" />
                      Reject Claim
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => handleOpenStatusModal(detailExpense)}
                    className="w-full h-8 text-xs font-medium cursor-pointer gap-1.5"
                  >
                    <Edit2 className="size-3.5" />
                    Modify Status / Remarks
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* --- Quick Confirmation Modal (Approve / Reject) --- */}
      <Dialog
        open={confirmModal.open}
        onOpenChange={(open) => {
          if (!open) setConfirmModal({ open: false, type: 'approved', expense: null })
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmModal.type === 'approved' ? 'Approve Expense Claim' : 'Reject Expense Claim'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to{' '}
              <strong className={confirmModal.type === 'approved' ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                {confirmModal.type}
              </strong>{' '}
              the claim of{' '}
              <strong className="text-foreground">{formatRupee(confirmModal.expense?.amount)}</strong> for{' '}
              <strong className="text-foreground">
                {confirmModal.expense?.employee_id?.first_name} {confirmModal.expense?.employee_id?.last_name}
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                {confirmModal.type === 'rejected' ? 'Rejection Reason (Required)' : 'Remarks / Notes (Optional)'}
              </label>
              <Textarea
                placeholder={
                  confirmModal.type === 'rejected'
                    ? 'Please explain why this claim is being rejected...'
                    : 'Add any optional reimbursement remarks or payout notes...'
                }
                value={confirmRemarks}
                onChange={(e) => setConfirmRemarks(e.target.value)}
                className="text-xs min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-end gap-3 pt-3 border-t border-border mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmModal({ open: false, type: 'approved', expense: null })}
              className="h-8 text-xs cursor-pointer px-3"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={updateMutation.isPending}
              onClick={handleConfirmSubmit}
              className={cn(
                'h-8 text-xs font-semibold cursor-pointer gap-1.5 text-white',
                confirmModal.type === 'approved'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700',
              )}
            >
              {updateMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : confirmModal.type === 'approved' ? (
                <Check className="size-3.5" />
              ) : (
                <Ban className="size-3.5" />
              )}
              {confirmModal.type === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Status Update Sheet (For modifying existing claims) --- */}
      <Sheet open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col bg-background">
          <div className="p-5 border-b border-border bg-muted/20">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Update Expense Status
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Modify the status or reviewer remarks for this claim.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                Change Status
              </label>
              <Select value={statusModalTarget} onValueChange={setStatusModalTarget}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                Remarks / Notes
              </label>
              <Textarea
                placeholder="Reason or update notes..."
                value={statusModalRemarks}
                onChange={(e) => setStatusModalRemarks(e.target.value)}
                className="text-xs min-h-[90px] bg-background"
              />
            </div>
          </div>

          <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusModalOpen(false)}
              className="h-8 text-xs cursor-pointer px-3"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={updateMutation.isPending}
              onClick={handleStatusModalSubmit}
              className="h-8 text-xs font-semibold cursor-pointer gap-1.5 px-3"
            >
              {updateMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* --- Apply / Claim Expense Sheet (Admin/Manager) --- */}
      <Sheet open={applyModalOpen} onOpenChange={setApplyModalOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col bg-background">
          <div className="p-5 border-b border-border bg-muted/20">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Add Expense Claim
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Record a new employee expense reimbursement claim.
            </p>
          </div>

          <form onSubmit={handleApplySubmit} className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
            {/* Employee Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                Employee <span className="text-rose-500">*</span>
              </label>
              <Select value={applyEmployeeId} onValueChange={setApplyEmployeeId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select staff member..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {firmEmployees.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.title || emp.department_name || 'Staff'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Expense Type & Amount */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                  Expense Type <span className="text-rose-500">*</span>
                </label>
                <Select value={applyType} onValueChange={setApplyType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                  Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={applyAmount}
                  onChange={(e) => setApplyAmount(e.target.value)}
                  className="h-8 text-xs"
                  required
                />
              </div>
            </div>

            {/* Expense Date */}
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                Expense Date <span className="text-rose-500">*</span>
              </label>
              <Input
                type="date"
                value={applyDate}
                onChange={(e) => setApplyDate(e.target.value)}
                className="h-8 text-xs"
                required
              />
            </div>

            {/* Remarks / Purpose */}
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                Description / Purpose
              </label>
              <Textarea
                placeholder="Explain the purpose of this expense..."
                value={applyRemarks}
                onChange={(e) => setApplyRemarks(e.target.value)}
                className="text-xs min-h-[70px]"
              />
            </div>

            </div>

            <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setApplyModalOpen(false)}
                className="h-8 text-xs cursor-pointer px-3"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending}
                className="h-8 text-xs font-semibold cursor-pointer gap-1.5 px-3"
              >
                {createMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                Submit Claim
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* --- Image Lightbox for Receipts & Bills --- */}
      <ImageLightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        src={lightboxImages[lightboxIndex] || null}
        images={lightboxImages}
        currentIndex={lightboxIndex}
        onIndexChange={setLightboxIndex}
        title={lightboxTitle}
        description={lightboxDesc}
      />
      </Panel>
    </div>
  )
}
