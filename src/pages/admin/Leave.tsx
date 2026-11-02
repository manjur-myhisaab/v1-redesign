import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CalendarDays,
  CalendarCheck,
  Clock,
  CheckCircle2,
  XCircle,
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
  RefreshCw,
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
const LEAVE_TYPES = [
  { label: 'Paid Leave', value: 'paid' },
  { label: 'Loss of Pay (LOP)', value: 'LOP' },
  { label: 'Half Day Leave', value: 'half_day' },
]

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function calculateDays(from?: string, to?: string, leaveDate?: string, isHalfDay?: boolean) {
  if (isHalfDay) return 0.5
  const start = from || leaveDate
  const end = to || from || leaveDate
  if (!start) return 1
  if (!end || start === end) return 1
  try {
    const d1 = new Date(start)
    const d2 = new Date(end)
    const diffTime = Math.abs(d2.getTime() - d1.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return diffDays || 1
  } catch {
    return 1
  }
}

function getLeaveTypeInfo(type?: string) {
  const t = (type || '').toLowerCase()
  if (t === 'paid' || t.includes('paid')) {
    return {
      label: 'Paid Leave',
      badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    }
  }
  if (t === 'lop' || t.includes('loss') || t.includes('unpaid')) {
    return {
      label: 'Loss of Pay (LOP)',
      badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    }
  }
  if (t === 'half_day' || t.includes('half')) {
    return {
      label: 'Half Day',
      badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
    }
  }
  return {
    label: type || 'Leave',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  }
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

export default function Leave() {
  const { firstTabActive } = useShell()
  const { user, activeWorkspace } = useAuth()
  const queryClient = useQueryClient()

  const firmObj = (typeof user?.firm_id === 'object' ? user?.firm_id : null) as any
  const firmId = firmObj?.firm_id || (typeof user?.firm_id === 'string' ? user?.firm_id : null) || activeWorkspace?.id

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
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Advanced Table Filters & Sort states
  const [filterLeaveType, setFilterLeaveType] = useState<string>('all')
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all')
  const [filterHasDocs, setFilterHasDocs] = useState<string>('all')
  const [sortSelected, setSortSelected] = useState<string>('date desc')
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false)

  // Resizable columns
  const { colWidths, startResizing, isResizing, canSort } = useResizableColumns(
    {
      employee: 200,
      type: 130,
      date: 170,
      reason: 200,
      documents: 100,
      status: 110,
      updatedBy: 130,
      actions: 150,
    },
    { storageKey: 'leave_table_widths', minWidth: 70 },
  )

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filterLeaveType !== 'all') count++
    if (filterEmployeeId !== 'all') count++
    if (filterHasDocs !== 'all') count++
    return count
  }, [filterLeaveType, filterEmployeeId, filterHasDocs])

  const handleResetFilters = () => {
    setFilterLeaveType('all')
    setFilterEmployeeId('all')
    setFilterHasDocs('all')
    setCurrentPage(1)
  }

  const handleSortToggle = (columnKey: 'date' | 'name' | 'duration') => {
    if (!canSort()) return
    const [currentKey, currentDir] = sortSelected.split(' ')
    if (currentKey === columnKey) {
      setSortSelected(`${columnKey} ${currentDir === 'asc' ? 'desc' : 'asc'}`)
    } else {
      setSortSelected(`${columnKey} ${columnKey === 'name' ? 'asc' : 'desc'}`)
    }
  }

  // Drawer & Modals state
  const [detailLeave, setDetailLeave] = useState<any | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Lightbox state for previewing attached leave documents
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxTitle, setLightboxTitle] = useState('')
  const [lightboxDesc, setLightboxDesc] = useState('')

  const openLeaveLightbox = (leave: any, initialIndex: number = 0) => {
    if (!Array.isArray(leave?.leave_documents) || leave.leave_documents.length === 0) return
    const urls = leave.leave_documents.map(
      (d: any) => `${ATTENDANCE_SERVER_URL || API_URL}/assets/${d.directus_files_id}`
    )
    setLightboxImages(urls)
    setLightboxIndex(initialIndex)
    const empName = `${leave.employee_id?.first_name || ''} ${leave.employee_id?.last_name || ''}`.trim() || 'Employee'
    setLightboxTitle(`${empName} — Leave Document #${initialIndex + 1}`)
    setLightboxDesc(
      `${leave.leave_type_name || 'Leave Request'} · ${formatDisplayDate(leave.leave_date_from || leave.leave_date)}`
    )
    setLightboxOpen(true)
  }

  // Quick Action confirmation modal (Approve / Reject)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    type: 'approved' | 'rejected'
    leave: any | null
  }>({
    open: false,
    type: 'approved',
    leave: null,
  })
  const [confirmLeaveType, setConfirmLeaveType] = useState('paid')
  const [confirmRemarks, setConfirmRemarks] = useState('')

  // Status Update modal (for changing any status anytime)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusModalLeave, setStatusModalLeave] = useState<any | null>(null)
  const [statusModalTarget, setStatusModalTarget] = useState<string>('pending')
  const [statusModalLeaveType, setStatusModalLeaveType] = useState<string>('paid')
  const [statusModalRemarks, setStatusModalRemarks] = useState<string>('')

  // Apply Leave modal (Admin/Manager creating leave on behalf of staff)
  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [applyEmployeeId, setApplyEmployeeId] = useState('')
  const [applyLeaveType, setApplyLeaveType] = useState('paid')
  const [applyFromDate, setApplyFromDate] = useState('')
  const [applyToDate, setApplyToDate] = useState('')
  const [applyIsHalfDay, setApplyIsHalfDay] = useState(false)
  const [applyReason, setApplyReason] = useState('')

  // Dynamic Date Filter calculation for Server API (matching Staff.jsx)
  const filterDates = useMemo(() => {
    if (!selectedMonth) return null
    const [year, month] = selectedMonth.split('-')
    const startDate = new Date(Number(year), parseInt(month) - 1, 1)
    const endDate = new Date(Number(year), parseInt(month), 0)
    const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`
    const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

    return {
      start: startStr,
      end: endStr,
      startDateTime: `${startStr}T00:00:00`,
      endDateTime: `${endStr}T23:59:59`,
    }
  }, [selectedMonth])

  // Fetch firm employees (for Manager access checking and Apply Leave dropdown)
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

  // Permitted employee IDs if manager
  const managerPermittedIds = useMemo(() => {
    return firmEmployees.map((e: any) => e.id)
  }, [firmEmployees])

  // Main Leave Requests Query
  const {
    data: leaveRequests = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['leave_requests', selectedMonth, firmId, isManager],
    queryFn: async () => {
      let filterQuery: any = {}

      if (filterDates) {
        filterQuery = {
          _or: [
            {
              leave_date: {
                _between: [filterDates.start, filterDates.end],
              },
            },
            {
              leave_date_from: {
                _between: [filterDates.start, filterDates.end],
              },
            },
            {
              date_created: {
                _between: [filterDates.startDateTime, filterDates.endDateTime],
              },
            },
          ],
        }
      }

      if (isManager && managerPermittedIds.length > 0) {
        filterQuery = {
          _and: [
            filterQuery,
            {
              employee_id: {
                _in: managerPermittedIds,
              },
            },
          ],
        }
      }

      const response: any = await rdk.request(
        readItems('leave_requests', {
          fields: [
            '*',
            'employee_id.id',
            'employee_id.first_name',
            'employee_id.last_name',
            'employee_id.avatar',
            'employee_id.email',
            'employee_id.phone',
            'employee_id.department_name',
            'employee_id.title',
            'employee_id.employee_serial_no',
            'employee_id.employee_code',
            'user_updated.first_name',
            'user_updated.last_name',
            'leave_documents.*',
          ],
          filter: filterQuery,
          sort: ['-date_created', '-leave_date'],
          limit: -1,
        }),
      )

      return Array.isArray(response) ? response : response?.data || []
    },
    enabled: !!firmId,
    refetchOnWindowFocus: false,
  })

  // Update Leave Request Mutation (Status, remarks, leave_type)
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      decision_remarks,
      leave_type,
    }: {
      id: string | number
      status: string
      decision_remarks?: string | null
      leave_type?: string
    }) => {
      const updatePayload: any = { status }
      if (decision_remarks !== undefined) updatePayload.decision_remarks = decision_remarks
      if (leave_type) updatePayload.leave_type = leave_type
      return await rdk.request(updateItem('leave_requests', id as any, updatePayload))
    },
    onSuccess: (_, variables) => {
      const actionName =
        variables.status === 'approved'
          ? 'approved'
          : variables.status === 'rejected'
            ? 'rejected'
            : 'updated'
      toast.success(`Leave request ${actionName} successfully!`)
      queryClient.invalidateQueries({ queryKey: ['leave_requests'] })
      setConfirmModal({ open: false, type: 'approved', leave: null })
      setStatusModalOpen(false)

      // Sync active drawer data if open
      if (detailLeave && String(detailLeave.leave_request_id) === String(variables.id)) {
        setDetailLeave((prev: any) =>
          prev
            ? {
                ...prev,
                status: variables.status,
                decision_remarks: variables.decision_remarks ?? prev.decision_remarks,
                leave_type: variables.leave_type ?? prev.leave_type,
              }
            : null,
        )
      }
    },
    onError: (err: any) => {
      console.error('Error updating leave status:', err)
      toast.error(err?.message || 'Failed to update leave request status')
    },
  })

  // Apply Leave Mutation (Create new request)
  const applyMutation = useMutation({
    mutationFn: async (payload: any) => {
      return await rdk.request(createItem('leave_requests', payload))
    },
    onSuccess: () => {
      toast.success('Leave applied successfully!')
      queryClient.invalidateQueries({ queryKey: ['leave_requests'] })
      setApplyModalOpen(false)
      // Reset form
      setApplyEmployeeId('')
      setApplyLeaveType('paid')
      setApplyFromDate('')
      setApplyToDate('')
      setApplyIsHalfDay(false)
      setApplyReason('')
    },
    onError: (err: any) => {
      console.error('Error creating leave request:', err)
      toast.error(err?.message || 'Failed to apply leave')
    },
  })

  // Metrics counts
  const metrics = useMemo(() => {
    let pending = 0
    let approved = 0
    let rejected = 0
    leaveRequests.forEach((item: any) => {
      const s = (item.status || '').toLowerCase()
      if (s === 'pending') pending++
      else if (s === 'approved') approved++
      else if (s === 'rejected') rejected++
    })
    return {
      total: leaveRequests.length,
      pending,
      approved,
      rejected,
    }
  }, [leaveRequests])

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
    leaveRequests.forEach((item: any) => {
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
  }, [firmEmployees, leaveRequests])

  // Filtered & Sorted Leave Requests
  const filteredRequests = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()

    let result = leaveRequests.filter((item: any) => {
      const status = (item.status || 'pending').toLowerCase()

      // Tab filter
      if (selectedStatusTab !== 'all' && status !== selectedStatusTab) {
        return false
      }

      // Employee filter
      if (filterEmployeeId !== 'all') {
        const empId = String(item.employee_id?.id || item.employee_id || '')
        if (empId !== filterEmployeeId) return false
      }

      // Leave Type filter
      if (filterLeaveType !== 'all' && (item.leave_type || '').toLowerCase() !== filterLeaveType.toLowerCase()) {
        return false
      }

      // Attached Docs filter
      if (filterHasDocs === 'yes' && (!Array.isArray(item.leave_documents) || item.leave_documents.length === 0)) {
        return false
      }
      if (filterHasDocs === 'no' && Array.isArray(item.leave_documents) && item.leave_documents.length > 0) {
        return false
      }

      // Search filter
      if (q) {
        const fullName = `${item.employee_id?.first_name || ''} ${item.employee_id?.last_name || ''}`.toLowerCase()
        const reason = (item.leave_reason || '').toLowerCase()
        const type = (item.leave_type || '').toLowerCase()
        const email = (item.employee_id?.email || '').toLowerCase()
        const code = (item.employee_id?.employee_serial_no || item.employee_id?.employee_code || '').toLowerCase()

        return (
          fullName.includes(q) ||
          reason.includes(q) ||
          type.includes(q) ||
          email.includes(q) ||
          code.includes(q)
        )
      }

      return true
    })

    // Sorting
    const [sortKey, sortDir] = sortSelected.split(' ')
    result.sort((a: any, b: any) => {
      if (sortKey === 'name') {
        const nameA = `${a.employee_id?.first_name || ''} ${a.employee_id?.last_name || ''}`.toLowerCase()
        const nameB = `${b.employee_id?.first_name || ''} ${b.employee_id?.last_name || ''}`.toLowerCase()
        return sortDir === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
      } else if (sortKey === 'duration') {
        const durA = calculateDays(a.leave_date_from, a.leave_date_to, a.leave_date)
        const durB = calculateDays(b.leave_date_from, b.leave_date_to, b.leave_date)
        return sortDir === 'asc' ? durA - durB : durB - durA
      } else {
        // Date sort
        const dateA = new Date(a.leave_date_from || a.leave_date || a.date_created || 0).getTime()
        const dateB = new Date(b.leave_date_from || b.leave_date || b.date_created || 0).getTime()
        return sortDir === 'asc' ? dateA - dateB : dateB - dateA
      }
    })

    return result
  }, [leaveRequests, selectedStatusTab, filterLeaveType, filterHasDocs, searchQuery, sortSelected])

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / itemsPerPage))
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredRequests.slice(start, start + itemsPerPage)
  }, [filteredRequests, currentPage, itemsPerPage])

  // Handlers for confirmation dialogs
  const handleOpenConfirm = (leave: any, type: 'approved' | 'rejected') => {
    setConfirmLeaveType(leave.leave_type || 'paid')
    setConfirmRemarks(leave.decision_remarks || '')
    setConfirmModal({
      open: true,
      type,
      leave,
    })
  }

  const handleConfirmSubmit = () => {
    if (!confirmModal.leave) return
    updateMutation.mutate({
      id: confirmModal.leave.leave_request_id,
      status: confirmModal.type,
      decision_remarks: confirmRemarks || null,
      leave_type: confirmModal.type === 'approved' ? confirmLeaveType : undefined,
    })
  }

  const handleOpenStatusModal = (leave: any) => {
    setStatusModalLeave(leave)
    setStatusModalTarget(leave.status || 'pending')
    setStatusModalLeaveType(leave.leave_type || 'paid')
    setStatusModalRemarks(leave.decision_remarks || '')
    setStatusModalOpen(true)
  }

  const handleStatusModalSubmit = () => {
    if (!statusModalLeave) return
    updateMutation.mutate({
      id: statusModalLeave.leave_request_id,
      status: statusModalTarget,
      decision_remarks: statusModalRemarks || null,
      leave_type: statusModalTarget === 'approved' ? statusModalLeaveType : undefined,
    })
  }

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!applyEmployeeId) {
      toast.error('Please select an employee')
      return
    }
    if (!applyFromDate) {
      toast.error('Please specify the start date')
      return
    }

    const payload: any = {
      employee_id: applyEmployeeId,
      leave_type: applyIsHalfDay ? 'half_day' : applyLeaveType,
      leave_date: applyFromDate,
      leave_date_from: applyFromDate,
      leave_date_to: applyToDate || applyFromDate,
      leave_reason: applyReason || 'Leave application',
      status: 'pending',
    }

    applyMutation.mutate(payload)
  }

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel
        className={cn(
          'flex min-w-0 flex-1 flex-col h-full overflow-hidden',
          firstTabActive && 'rounded-tl-none',
        )}
      >
        {/* 1. Header Bar with Month Switcher & Apply CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-card/60 backdrop-blur-sm shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
              Leave Requests
            </h1>
            <Badge variant="outline" className="text-[11px] font-normal px-2 py-0 border-border">
              {getMonthLabel(selectedMonth)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review, approve, and track employee leave applications and status
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

          {/* Quick Apply Leave */}
          <Button
            size="sm"
            onClick={() => setApplyModalOpen(true)}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-xs"
          >
            <Plus className="size-3.5" />
            Apply Leave
          </Button>
        </div>
      </div>

        {/* 2. Metric Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 border-b border-border bg-card/30 shrink-0">
          {/* Total Requests */}
          <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-3.5 shadow-2xs">
            <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Total Requests
              </p>
              <p className="font-display text-xl font-bold tracking-tight text-foreground">
                {isLoading ? '—' : metrics.total}
              </p>
            </div>
          </div>

          {/* Pending Action */}
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
                {isLoading ? '—' : metrics.pending}
              </p>
            </div>
          </div>

          {/* Approved */}
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
                {isLoading ? '—' : metrics.approved}
              </p>
            </div>
          </div>

          {/* Rejected */}
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
                {isLoading ? '—' : metrics.rejected}
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar: Status Tabs + Search + Filter + Sort + Refresh */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-b border-border bg-card px-4 py-2.5 shrink-0">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 md:pb-0 shrink-0">
            {[
              { id: 'all', label: 'All', count: metrics.total },
              { id: 'pending', label: 'Pending', count: metrics.pending },
              { id: 'approved', label: 'Approved', count: metrics.approved },
              { id: 'rejected', label: 'Rejected', count: metrics.rejected },
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
            <div className="relative min-w-[170px] sm:w-56">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
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
                  <p className="text-xs font-bold text-foreground">Filter Requests</p>
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

                {/* Filter by Leave Type */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Leave Type</label>
                  <Select value={filterLeaveType} onValueChange={(val) => { setFilterLeaveType(val); setCurrentPage(1); }}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {LEAVE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter by Attached Documents */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Attached Documents</label>
                  <Select value={filterHasDocs} onValueChange={(val) => { setFilterHasDocs(val); setCurrentPage(1); }}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Requests</SelectItem>
                      <SelectItem value="yes">With Documents Only</SelectItem>
                      <SelectItem value="no">Without Documents</SelectItem>
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
                  Sort Requests By
                </div>
                {[
                  { key: 'date desc', label: 'Date: Newest First' },
                  { key: 'date asc', label: 'Date: Oldest First' },
                  { key: 'duration desc', label: 'Duration: Longest First' },
                  { key: 'duration asc', label: 'Duration: Shortest First' },
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

            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              className="size-7 cursor-pointer text-muted-foreground hover:text-foreground rounded-md"
              title="Refresh requests"
            >
              <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin text-primary')} />
            </Button>
          </div>
        </div>

        {/* Table View */}
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-20 bg-card shadow-2xs">
              <tr className="text-muted-foreground font-semibold">
                <th
                  onClick={() => handleSortToggle('name')}
                  style={{ width: colWidths.employee, minWidth: colWidths.employee }}
                  className="relative py-2.5 px-3 border-t border-b border-l border-r border-gray-200 dark:border-border cursor-pointer select-none hover:bg-muted/50 transition-colors"
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
                  <span className="pr-2">LEAVE TYPE</span>
                  <ColumnResizer
                    isResizing={isResizing === 'type'}
                    onMouseDown={(e) => startResizing('type', e)}
                  />
                </th>
                <th
                  onClick={() => handleSortToggle('date')}
                  style={{ width: colWidths.date, minWidth: colWidths.date }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border cursor-pointer select-none hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 pr-2">
                    <span>DATES & DURATION</span>
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
                  style={{ width: colWidths.reason, minWidth: colWidths.reason }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border"
                >
                  <span className="pr-2">REASON</span>
                  <ColumnResizer
                    isResizing={isResizing === 'reason'}
                    onMouseDown={(e) => startResizing('reason', e)}
                  />
                </th>
                <th
                  style={{ width: colWidths.documents, minWidth: colWidths.documents }}
                  className="relative py-2.5 px-3 text-center border-t border-b border-r border-gray-200 dark:border-border"
                >
                  <span className="pr-2">DOCUMENTS</span>
                  <ColumnResizer
                    isResizing={isResizing === 'documents'}
                    onMouseDown={(e) => startResizing('documents', e)}
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
                  style={{ width: colWidths.updatedBy, minWidth: colWidths.updatedBy }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border"
                >
                  <span className="pr-2">UPDATED BY</span>
                  <ColumnResizer
                    isResizing={isResizing === 'updatedBy'}
                    onMouseDown={(e) => startResizing('updatedBy', e)}
                  />
                </th>
                <th
                  style={{ width: colWidths.actions, minWidth: colWidths.actions }}
                  className="py-2.5 px-3 min-w-[150px] text-right border-t border-b border-r border-gray-200 dark:border-border"
                >
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted-foreground border-b border-l border-r border-gray-200 dark:border-border">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="size-6 animate-spin text-primary" />
                      <p className="text-sm font-medium">Loading leave requests...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted-foreground border-b border-l border-r border-gray-200 dark:border-border">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CalendarCheck className="size-8 text-muted-foreground/40" />
                      <p className="text-sm font-medium">No leave requests found.</p>
                      <p className="text-xs text-muted-foreground">
                        Try adjusting your search query, status filters, or selected month.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((item: any) => {
                  const emp = item.employee_id
                  const fullName = `${emp?.first_name || ''} ${emp?.last_name || ''}`.trim() || 'Unnamed'
                  const code = emp?.employee_serial_no || emp?.employee_code || (emp?.id ? String(emp.id).slice(0, 8) : null)
                  const typeInfo = getLeaveTypeInfo(item.leave_type)
                  const isHalfDay = (item.leave_type || '').toLowerCase().includes('half')
                  const days = calculateDays(item.leave_date_from, item.leave_date_to, item.leave_date, isHalfDay)
                  const isPending = (item.status || 'pending').toLowerCase() === 'pending'
                  const updatedBy = item.user_updated?.first_name
                    ? `${item.user_updated.first_name} ${item.user_updated.last_name || ''}`.trim()
                    : '—'
                  const docCount = Array.isArray(item.leave_documents) ? item.leave_documents.length : 0

                  return (
                    <tr
                      key={item.leave_request_id}
                      onClick={() => {
                        setDetailLeave(item)
                        setDrawerOpen(true)
                      }}
                      className="group transition-colors cursor-pointer hover:bg-muted/40"
                    >
                      {/* Employee Info */}
                      <td className="py-2.5 px-3 border-b border-l border-r border-gray-200 dark:border-border">
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

                      {/* Leave Type */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border',
                            typeInfo.badgeClass,
                          )}
                        >
                          {typeInfo.label}
                        </span>
                      </td>

                      {/* Dates & Duration */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <div>
                          <p className="font-medium text-foreground">
                            {formatDisplayDate(item.leave_date_from || item.leave_date)}
                            {item.leave_date_to && item.leave_date_to !== item.leave_date_from && (
                              <span> &rarr; {formatDisplayDate(item.leave_date_to)}</span>
                            )}
                          </p>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {days} {days === 1 ? 'day' : 'days'}
                            {isHalfDay && ' (Half Day)'}
                          </span>
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border max-w-[240px]">
                        <p className="text-foreground line-clamp-2 text-xs" title={item.leave_reason}>
                          {item.leave_reason || '—'}
                        </p>
                        {item.decision_remarks && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 italic line-clamp-1" title={item.decision_remarks}>
                            Note: {item.decision_remarks}
                          </p>
                        )}
                      </td>

                      {/* Documents */}
                      <td className="py-2.5 px-3 text-center border-b border-r border-gray-200 dark:border-border">
                        {docCount > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openLeaveLightbox(item, 0)
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 px-2 py-0.5 text-[11px] font-medium cursor-pointer transition-colors shadow-2xs"
                            title="Click to view attached document in lightbox"
                          >
                            <Paperclip className="size-3" />
                            {docCount}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        {renderStatusBadge(item.status)}
                      </td>

                      {/* Updated By */}
                      <td className="py-2.5 px-3 text-muted-foreground border-b border-r border-gray-200 dark:border-border">
                        <p className="truncate font-medium text-foreground">{updatedBy}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDisplayDate(item.date_created)}
                        </p>
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
                              setDetailLeave(item)
                              setDrawerOpen(true)
                            }}
                            className="size-7 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="View Leave Details"
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
                                title="Approve Leave"
                              >
                                <Check className="size-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenConfirm(item, 'rejected')}
                                className="size-7 cursor-pointer text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title="Reject Leave"
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

        {/* 3. Bottom Sticky Pagination Bar */}
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
            <span>per page &middot; {filteredRequests.length} requests</span>
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
          {detailLeave && (
            <>
              {/* Drawer Header */}
              <SheetHeader className="p-5 border-b border-border bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    {detailLeave.employee_id?.avatar ? (
                      <img
                        src={`${API_URL}/assets/${detailLeave.employee_id.avatar}`}
                        alt=""
                        className="size-11 rounded-full object-cover border border-border shrink-0"
                      />
                    ) : (
                      <PersonAvatar
                        name={`${detailLeave.employee_id?.first_name || ''} ${detailLeave.employee_id?.last_name || ''}`}
                        className="size-11 text-sm shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <SheetTitle className="text-base font-bold text-foreground truncate">
                        {`${detailLeave.employee_id?.first_name || ''} ${detailLeave.employee_id?.last_name || ''}`.trim() || 'Unnamed'}
                      </SheetTitle>
                      <SheetDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                        {detailLeave.employee_id?.department_name || detailLeave.employee_id?.title || 'Staff Member'}
                      </SheetDescription>
                    </div>
                  </div>

                  <div className="mr-8 shrink-0">{renderStatusBadge(detailLeave.status)}</div>
                </div>
              </SheetHeader>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                {/* Section: Leave Details */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                    Leave Overview
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Leave Type</span>
                      <span className="font-semibold text-foreground mt-0.5 inline-block">
                        {getLeaveTypeInfo(detailLeave.leave_type).label}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">Duration</span>
                      <span className="font-semibold text-foreground mt-0.5 inline-block">
                        {calculateDays(detailLeave.leave_date_from, detailLeave.leave_date_to, detailLeave.leave_date)} days
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">Start Date</span>
                      <span className="font-semibold text-foreground mt-0.5 inline-block">
                        {formatDisplayDate(detailLeave.leave_date_from || detailLeave.leave_date)}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">End Date</span>
                      <span className="font-semibold text-foreground mt-0.5 inline-block">
                        {formatDisplayDate(detailLeave.leave_date_to || detailLeave.leave_date_from || detailLeave.leave_date)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <span className="text-muted-foreground block text-[11px] mb-1">Reason for Leave</span>
                    <p className="bg-muted/30 p-2.5 rounded-lg text-foreground leading-relaxed">
                      {detailLeave.leave_reason || 'No reason provided.'}
                    </p>
                  </div>
                </div>

                {/* Section: Review & Meta Information */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                    Review Information
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Application Date</span>
                      <span className="font-medium text-foreground mt-0.5 inline-block">
                        {formatDisplayDate(detailLeave.date_created)}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">Reviewed By</span>
                      <span className="font-medium text-foreground mt-0.5 inline-block">
                        {detailLeave.user_updated?.first_name
                          ? `${detailLeave.user_updated.first_name} ${detailLeave.user_updated.last_name || ''}`
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {detailLeave.decision_remarks && (
                    <div className="pt-2 border-t border-border">
                      <span className="text-muted-foreground block text-[11px] mb-1">Decision Remarks</span>
                      <p className="bg-muted/30 p-2.5 rounded-lg text-foreground italic leading-relaxed">
                        &ldquo;{detailLeave.decision_remarks}&rdquo;
                      </p>
                    </div>
                  )}
                </div>

                {/* Section: Uploaded Documents */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                      Attached Documents
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {Array.isArray(detailLeave.leave_documents) ? detailLeave.leave_documents.length : 0} file(s)
                    </span>
                  </div>

                  {Array.isArray(detailLeave.leave_documents) && detailLeave.leave_documents.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {detailLeave.leave_documents.map((doc: any, i: number) => {
                        const fileUrl = `${ATTENDANCE_SERVER_URL || API_URL}/assets/${doc.directus_files_id}`
                        return (
                          <div
                            key={i}
                            onClick={() => openLeaveLightbox(detailLeave, i)}
                            className="group/doc relative rounded-lg border border-border overflow-hidden bg-muted/20 hover:border-primary/50 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                          >
                            <div className="relative overflow-hidden aspect-video bg-muted/30">
                              <img
                                src={fileUrl}
                                alt={`Document ${i + 1}`}
                                className="w-full h-full object-cover transition-transform group-hover/doc:scale-105"
                                onError={(e) => {
                                  const target = e.target as HTMLElement
                                  target.style.display = 'none'
                                  if (target.parentElement) {
                                    target.parentElement.innerHTML = `<div class="w-full h-28 flex flex-col items-center justify-center p-2 text-muted-foreground"><svg class="size-6 mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><span class="text-[10px]">Document ${i + 1}</span></div>`
                                  }
                                }}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover/doc:bg-black/30 flex items-center justify-center transition-all opacity-0 group-hover/doc:opacity-100">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-black/75 text-white text-[11px] font-medium backdrop-blur-xs shadow-xs">
                                  <ZoomIn className="size-3.5" />
                                  Preview
                                </span>
                              </div>
                            </div>
                            <div className="p-1.5 flex items-center justify-between bg-card border-t border-border">
                              <span className="text-[10px] font-medium truncate">Doc #{i + 1}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-6 text-muted-foreground hover:text-primary cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openLeaveLightbox(detailLeave, i)
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
                      <Paperclip className="size-5 mx-auto mb-1 opacity-40" />
                      <p className="text-xs">No documents attached with this request.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 border-t border-border bg-card flex items-center gap-2">
                {(detailLeave.status || 'pending').toLowerCase() === 'pending' ? (
                  <>
                    <Button
                      onClick={() => handleOpenConfirm(detailLeave, 'approved')}
                      className="flex-1 h-8 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1.5"
                    >
                      <Check className="size-3.5" />
                      Approve Leave
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleOpenConfirm(detailLeave, 'rejected')}
                      className="flex-1 h-8 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 cursor-pointer gap-1.5"
                    >
                      <Ban className="size-3.5" />
                      Reject Leave
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => handleOpenStatusModal(detailLeave)}
                    className="w-full h-8 text-xs font-medium cursor-pointer gap-1.5"
                  >
                    <Edit2 className="size-3.5" />
                    Change Status / Remarks
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
          if (!open) setConfirmModal({ open: false, type: 'approved', leave: null })
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmModal.type === 'approved' ? 'Approve Leave Request' : 'Reject Leave Request'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to{' '}
              <strong className={confirmModal.type === 'approved' ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                {confirmModal.type}
              </strong>{' '}
              the leave request for{' '}
              <strong className="text-foreground">
                {confirmModal.leave?.employee_id?.first_name} {confirmModal.leave?.employee_id?.last_name}
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {confirmModal.type === 'approved' && (
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                  Select Leave Type
                </label>
                <Select value={confirmLeaveType} onValueChange={setConfirmLeaveType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map((lt) => (
                      <SelectItem key={lt.value} value={lt.value}>
                        {lt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                {confirmModal.type === 'rejected' ? 'Decision Remarks (Reason for rejection)' : 'Remarks (Optional)'}
              </label>
              <Textarea
                placeholder={
                  confirmModal.type === 'rejected'
                    ? 'Please explain the reason for rejecting this leave...'
                    : 'Add any optional remarks or instructions...'
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
              onClick={() => setConfirmModal({ open: false, type: 'approved', leave: null })}
              className="h-8 text-xs cursor-pointer px-3"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={updateMutation.isPending}
              onClick={handleConfirmSubmit}
              className={cn(
                'h-8 text-xs font-semibold cursor-pointer gap-1.5 text-white px-3',
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

      {/* --- Status Update Sheet (For modifying existing decisions) --- */}
      <Sheet open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col bg-background">
          <div className="p-5 border-b border-border bg-muted/20">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Update Leave Status
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Modify the status, remarks, or type for this leave request.
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

            {statusModalTarget === 'approved' && (
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                  Leave Type
                </label>
                <Select value={statusModalLeaveType} onValueChange={setStatusModalLeaveType}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map((lt) => (
                      <SelectItem key={lt.value} value={lt.value}>
                        {lt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                Decision Remarks
              </label>
              <Textarea
                placeholder="Reason or notes..."
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

      {/* --- Apply Leave Sheet (Admin/Manager on behalf of employee) --- */}
      <Sheet open={applyModalOpen} onOpenChange={setApplyModalOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col bg-background">
          <div className="p-5 border-b border-border bg-muted/20">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Apply Employee Leave
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Submit a new leave request for a staff member.
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

            {/* Leave Type */}
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                Leave Type <span className="text-rose-500">*</span>
              </label>
              <Select value={applyLeaveType} onValueChange={setApplyLeaveType}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((lt) => (
                    <SelectItem key={lt.value} value={lt.value}>
                      {lt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dates: From & To */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                  From Date <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="date"
                  value={applyFromDate}
                  onChange={(e) => {
                    setApplyFromDate(e.target.value)
                    if (!applyToDate) setApplyToDate(e.target.value)
                  }}
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                  To Date
                </label>
                <Input
                  type="date"
                  value={applyToDate}
                  min={applyFromDate}
                  onChange={(e) => setApplyToDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Half Day Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="apply_half_day"
                checked={applyIsHalfDay}
                onChange={(e) => setApplyIsHalfDay(e.target.checked)}
                className="size-3.5 rounded border-border accent-primary cursor-pointer"
              />
              <label htmlFor="apply_half_day" className="text-xs font-medium cursor-pointer">
                This is a Half Day leave
              </label>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                Reason for Leave
              </label>
              <Textarea
                placeholder="Reason or explanation..."
                value={applyReason}
                onChange={(e) => setApplyReason(e.target.value)}
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
                disabled={applyMutation.isPending}
                className="h-8 text-xs font-semibold cursor-pointer gap-1.5 px-3"
              >
                {applyMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                Submit Request
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* --- Image Lightbox for Leave Documents --- */}
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
