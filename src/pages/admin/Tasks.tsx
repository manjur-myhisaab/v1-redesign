import React, { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ListTodo,
  Plus,
  Search,
  X,
  Trash2,
  Pencil,
  Eye,
  RefreshCw,
  FileSpreadsheet,
  Filter,
  ArrowUpDown,
  Clock,
  User,
  Users,
  CheckCircle2,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  Check,
  CalendarDays,
  FileText,
  Clock4,
} from 'lucide-react'
import ExcelJS from 'exceljs'
import Panel from '@/components/admin/Panel'
import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
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
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet'
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
import { Badge } from '@/components/ui/badge'
import ImageLightbox from '@/components/ui/image-lightbox'
import TaskReportModal from './components/TaskReportModal'
import { useResizableColumns, ColumnResizer } from '@/hooks/useResizableColumns'
import { EmployeeAvatar } from '@/lib/people'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import rdk, {
  readItems,
  readItem,
  createItem,
  updateItem,
  deleteItem,
  deleteItems,
  customEndpoint,
  ATTENDANCE_SERVER_URL,
  API_URL,
} from '@/services/server'

// --- Types ---
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'pending' | 'in_progress' | 'completed'

export interface EmployeeCategory {
  employee_category_id?: number | string
  employee_category_name?: string
  status?: string
}

export interface TaskAssignee {
  id: string
  first_name?: string
  last_name?: string
  avatar?: string
  email?: string
  title?: string
  status?: string
  employee_category_id?: EmployeeCategory | number | string | null
}

export interface TaskClient {
  client_id: number | string
  client_name?: string
  client_phone?: string
  client_address?: string
}

export interface TaskReportImage {
  id?: string
  directus_files_id?: string | { id: string }
}

export interface TaskReport {
  id: string | number
  task_id: string | number
  review?: string
  submitted_at?: string
  submitted_by?: {
    id?: string
    first_name?: string
    last_name?: string
    avatar?: string
  }
  task_images?: TaskReportImage[]
}

export interface TaskItem {
  task_id: number | string
  task_title: string
  task_description?: string
  task_priority?: TaskPriority
  task_duedate?: string
  task_duetime?: string
  status?: TaskStatus
  assignedTo?: TaskAssignee | string
  assignedToOthers?: Array<{
    id?: string | number
    directus_users_id?: TaskAssignee | string
  }>
  client_id?: TaskClient | number | string
  date_created?: string
  user_created?: string
}

const PRIORITIES: { key: TaskPriority; label: string; badgeCls: string }[] = [
  { key: 'urgent', label: 'Urgent', badgeCls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800' },
  { key: 'high', label: 'High', badgeCls: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border-orange-200 dark:border-orange-800' },
  { key: 'medium', label: 'Medium', badgeCls: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border-sky-200 dark:border-sky-800' },
  { key: 'low', label: 'Low', badgeCls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
]

const STATUSES: { key: TaskStatus; label: string; badgeCls: string; dotCls: string }[] = [
  { key: 'pending', label: 'Pending', badgeCls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800', dotCls: 'bg-amber-500' },
  { key: 'in_progress', label: 'In Progress', badgeCls: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800', dotCls: 'bg-blue-500' },
  { key: 'completed', label: 'Completed', badgeCls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800', dotCls: 'bg-emerald-500' },
]

function format12HourTime(timeStr?: string): string {
  if (!timeStr) return '-'
  try {
    const parts = timeStr.split(':')
    if (parts.length >= 2) {
      const d = new Date()
      d.setHours(Number(parts[0]), Number(parts[1]), 0, 0)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    }
    return timeStr
  } catch {
    return timeStr
  }
}

function TaskStatusSelect({
  taskId,
  currentStatus,
  onChange,
}: {
  taskId: string | number
  currentStatus?: string
  onChange: (id: string | number, status: TaskStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const norm = (currentStatus ? String(currentStatus).toLowerCase().trim() : 'pending') as TaskStatus
  const normalizedKey = norm === ('inprogress' as any) ? 'in_progress' : norm
  const statusInfo = STATUSES.find((s) => s.key === normalizedKey) || STATUSES[0]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
          }}
          className="inline-flex items-center justify-between w-full min-w-[124px] h-7 px-2.5 text-xs border border-gray-200 dark:border-border bg-background hover:bg-muted/50 rounded-md font-medium transition-colors shadow-2xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <div className="flex items-center gap-1.5 truncate">
            <span className={cn('size-1.5 rounded-full shrink-0', statusInfo.dotCls)} />
            <span className="truncate">{statusInfo.label}</span>
          </div>
          <ChevronDown className="size-3 text-muted-foreground opacity-60 shrink-0 ml-1.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        onClick={(e) => e.stopPropagation()}
        className="w-36 p-1 z-[9999] shadow-lg border border-border bg-popover text-popover-foreground rounded-lg"
      >
        {STATUSES.map((s) => {
          const isSelected = s.key === statusInfo.key
          return (
            <button
              key={s.key}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange(taskId, s.key)
                setOpen(false)
              }}
              className={cn(
                'w-full flex items-center justify-between gap-1.5 px-2 py-1.5 text-xs rounded-md hover:bg-muted cursor-pointer transition-colors text-left',
                isSelected && 'bg-primary/10 font-semibold text-primary',
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={cn('size-1.5 rounded-full shrink-0', s.dotCls)} />
                <span>{s.label}</span>
              </div>
              {isSelected && <Check className="size-3 text-primary shrink-0" />}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}

export default function Tasks() {
  const { firstTabActive } = useShell()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const firmObj = (typeof user?.firm_id === 'object' ? user?.firm_id : null) as any
  const firmId = firmObj?.firm_id || user?.firm_id || ''
  const isAdmin = user?.role === 'bb64d3fd-5fde-4493-9cb7-bf6be2031d82' || user?.is_admin

  // Resizable columns with canSort prevention
  const { colWidths, startResizing, isResizing, canSort } = useResizableColumns(
    {
      task: 270,
      assignee: 200,
      duedate: 160,
      priority: 120,
      status: 145,
      actions: 110,
    },
    { storageKey: 'tasks_table_widths_v4', minWidth: 80 },
  )

  // Filters & Search
  const [search, setSearch] = useState('')
  const [selectedStatusTab, setSelectedStatusTab] = useState<'all' | TaskStatus>('all')
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterClientId, setFilterClientId] = useState<string>('all')
  const [filterDateMode, setFilterDateMode] = useState<'month' | 'range'>('month')
  const [filterMonth, setFilterMonth] = useState<string>('')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')
  const [sortSelected, setSortSelected] = useState<string>('duedate asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Popover open states
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false)

  // Selection states
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null)

  // Sheet state: unified single sheet for view, create, and edit (matching v1)
  const [detailTask, setDetailTask] = useState<TaskItem | null>(null)
  const [sheetMode, setSheetMode] = useState<'view' | 'create' | 'edit' | null>(null)
  const [drawerTab, setDrawerTab] = useState<'details' | 'reports'>('details')

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxImages, setLightboxImages] = useState<string[]>([])

  // Form states
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formClientId, setFormClientId] = useState<string>('')
  const [formAssigneeId, setFormAssigneeId] = useState<string>('')
  const [formOtherAssignees, setFormOtherAssignees] = useState<string[]>([])
  const [formDueDate, setFormDueDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [formDueTime, setFormDueTime] = useState<string>('12:00')
  const [formPriority, setFormPriority] = useState<TaskPriority>('medium')
  const [formStatus, setFormStatus] = useState<TaskStatus>('pending')
  const [otherAssigneeSearch, setOtherAssigneeSearch] = useState('')
  const [otherAssigneeCategory, setOtherAssigneeCategory] = useState<string>('all')
  const [isSaving, setIsSaving] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)

  // --- 1. Fetch Tasks Query ---
  const { data: tasks = [], isLoading: isLoadingTasks, refetch } = useQuery<TaskItem[]>({
    queryKey: ['tasks_master_list', user?.id, isAdmin],
    queryFn: async () => {
      try {
        const queryOptions: any = {
          sort: ['-date_created'],
          limit: -1,
          fields: [
            '*',
            'assignedTo.*',
            'assignedToOthers.directus_users_id.*',
            'client_id.*',
          ],
        }

        if (!isAdmin && user?.id) {
          queryOptions.filter = {
            _or: [
              { assignedTo: { _eq: user.id } },
              { user_created: { _eq: user.id } },
              { assignedToOthers: { directus_users_id: { _eq: user.id } } },
            ],
          }
        }

        const res: any = await rdk.request(readItems('tasks', queryOptions))
        return Array.isArray(res) ? res : res?.data || []
      } catch (err) {
        console.error('Error fetching tasks:', err)
        return []
      }
    },
    staleTime: 60 * 1000,
  })

  // --- 2. Fetch Clients for dropdowns ---
  const { data: clients = [] } = useQuery<TaskClient[]>({
    queryKey: ['clients_for_tasks', firmId],
    queryFn: async () => {
      try {
        const res: any = await rdk.request(
          readItems('clients', {
            filter: firmId ? { firm_id: { _eq: firmId } } : {},
            fields: ['client_id', 'client_name', 'client_phone', 'client_address'],
            limit: -1,
          }),
        )
        return Array.isArray(res) ? res : res?.data || []
      } catch {
        return []
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  // --- 3. Fetch Employee Categories for "Assign to others" category filtering (from v1) ---
  const { data: categories = [] } = useQuery<EmployeeCategory[]>({
    queryKey: ['employee_categories_for_tasks'],
    queryFn: async () => {
      try {
        const res: any = await rdk.request(
          readItems('employee_category', {
            sort: ['employee_category_name'],
            limit: -1,
          }),
        )
        return Array.isArray(res) ? res : res?.data || []
      } catch {
        return []
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  // --- 4. Fetch Firm Users for assignees dropdown and Assign To Others ---
  const { data: firmEmployees = [] } = useQuery<TaskAssignee[]>({
    queryKey: ['firm_employees_for_tasks', firmId],
    queryFn: async () => {
      try {
        const queryParams: any = {
          limit: -1,
          fields: [
            'id',
            'first_name',
            'last_name',
            'email',
            'title',
            'avatar',
            'status',
            'employee_category_id.*',
          ],
        }
        if (firmId) {
          queryParams.filter = {
            firm_id: { _eq: firmId },
            status: { _nin: ['archived', 'suspended'] },
          }
        } else {
          queryParams.filter = {
            status: { _nin: ['archived', 'suspended'] },
          }
        }

        const res: any = await rdk.request(
          customEndpoint({
            path: 'users',
            method: 'GET',
            params: queryParams,
          }),
        )
        const rawList = Array.isArray(res) ? res : res?.data || []
        const list = rawList.filter((u: any) => { const st = (u.status || '').toLowerCase(); return st !== 'archived' && st !== 'suspended'; })
        // Fallback to cache if list is empty
        if (list.length === 0) {
          const cached = localStorage.getItem('all_users_of_firm')
          if (cached) {
            try {
              const parsed = JSON.parse(cached)
              if (Array.isArray(parsed) && parsed.length > 0) return parsed
            } catch {}
          }
        }
        return list
      } catch (err) {
        console.error('Error fetching users for tasks:', err)
        const cached = localStorage.getItem('all_users_of_firm')
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            if (Array.isArray(parsed) && parsed.length > 0) return parsed
          } catch {}
        }
        return []
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  // --- 5. Fetch Task Reports when detailTask is selected ---
  const { data: taskReports = [], isLoading: isLoadingReports } = useQuery<TaskReport[]>({
    queryKey: ['task_reports_for', detailTask?.task_id],
    queryFn: async () => {
      if (!detailTask?.task_id) return []
      try {
        const res: any = await rdk.request(
          readItems('task_reports', {
            filter: {
              task_id: { _eq: detailTask.task_id },
            },
            fields: ['*', 'task_images.*', 'submitted_by.*'],
            sort: ['-submitted_at'],
            limit: -1,
          }),
        )
        return Array.isArray(res) ? res : res?.data || []
      } catch (err) {
        console.error('Error fetching task reports:', err)
        return []
      }
    },
    enabled: !!detailTask?.task_id && sheetMode === 'view',
  })

  // Filtered employees for "Assign To Others" multi-select (from v1)
  const filteredOtherEmployees = useMemo(() => {
    return firmEmployees.filter((emp) => {
      if (emp.status === 'archived') return false

      // Category filter
      if (otherAssigneeCategory !== 'all') {
        const catObj = emp.employee_category_id
        const catId =
          typeof catObj === 'object' && catObj !== null
            ? String(catObj.employee_category_id ?? '')
            : String(catObj ?? '')
        if (catId !== otherAssigneeCategory) return false
      }

      // Search filter
      if (otherAssigneeSearch.trim()) {
        const q = otherAssigneeSearch.trim().toLowerCase()
        const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase()
        const title = (emp.title || '').toLowerCase()
        const email = (emp.email || '').toLowerCase()
        return fullName.includes(q) || title.includes(q) || email.includes(q)
      }

      return true
    })
  }, [firmEmployees, otherAssigneeCategory, otherAssigneeSearch])

  const filteredEmployeeIds = useMemo(() => {
    return filteredOtherEmployees.map((e) => String(e.id))
  }, [filteredOtherEmployees])

  const isAllFilteredSelected = useMemo(() => {
    if (filteredEmployeeIds.length === 0) return false
    return filteredEmployeeIds.every((id) => formOtherAssignees.includes(id))
  }, [filteredEmployeeIds, formOtherAssignees])

  const handleToggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      setFormOtherAssignees((prev) => prev.filter((id) => !filteredEmployeeIds.includes(id)))
    } else {
      setFormOtherAssignees((prev) => Array.from(new Set([...prev, ...filteredEmployeeIds])))
    }
  }

  const handleToggleOtherAssignee = (userId: string) => {
    setFormOtherAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  // Unique list of employees for filter dropdown
  const filterEmployeeOptions = useMemo(() => {
    const map = new Map<string, string>()
    if (Array.isArray(firmEmployees)) {
      firmEmployees.forEach((emp) => {
        if (emp?.id) {
          const name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Staff'
          map.set(String(emp.id), name)
        }
      })
    }
    // Also include from tasks data
    tasks.forEach((t) => {
      const a = t.assignedTo
      if (a) {
        const id = typeof a === 'object' && a !== null ? String(a.id || '') : String(a)
        if (id && !map.has(id)) {
          const name =
            typeof a === 'object' && a !== null
              ? `${a.first_name || ''} ${a.last_name || ''}`.trim() || `Staff #${id.slice(-6)}`
              : `Staff #${id.slice(-6)}`
          map.set(id, name)
        }
      }
      if (Array.isArray(t.assignedToOthers)) {
        t.assignedToOthers.forEach((item) => {
          const userObj = item?.directus_users_id
          if (userObj) {
            const id = typeof userObj === 'object' && userObj !== null ? String(userObj.id || '') : String(userObj)
            if (id && !map.has(id)) {
              const name =
                typeof userObj === 'object' && userObj !== null
                  ? `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() || `Staff #${id.slice(-6)}`
                  : `Staff #${id.slice(-6)}`
              map.set(id, name)
            }
          }
        })
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [firmEmployees, tasks])

  // Counts for status tabs
  const counts = useMemo(() => {
    return {
      all: tasks.length,
      pending: tasks.filter((t) => (t.status || 'pending') === 'pending').length,
      inprogress: tasks.filter((t) => t.status === 'in_progress').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
    }
  }, [tasks])

  // Filtered and Sorted Tasks
  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks]

    // 1. Status Tab filter
    if (selectedStatusTab !== 'all') {
      result = result.filter((t) => (t.status || 'pending') === selectedStatusTab)
    }

    // 2. Employee filter
    if (filterEmployeeId !== 'all') {
      result = result.filter((t) => {
        const primaryId =
          typeof t.assignedTo === 'object' && t.assignedTo !== null
            ? String(t.assignedTo.id || '')
            : String(t.assignedTo || '')
        if (primaryId === filterEmployeeId) return true

        if (Array.isArray(t.assignedToOthers)) {
          return t.assignedToOthers.some((other) => {
            const otherId =
              typeof other?.directus_users_id === 'object' && other?.directus_users_id !== null
                ? String(other.directus_users_id.id || '')
                : String(other?.directus_users_id || '')
            return otherId === filterEmployeeId
          })
        }
        return false
      })
    }

    // 3. Priority filter
    if (filterPriority !== 'all') {
      result = result.filter((t) => (t.task_priority || 'medium').toLowerCase() === filterPriority.toLowerCase())
    }

    // 4. Client filter
    if (filterClientId !== 'all') {
      result = result.filter((t) => {
        const cid =
          typeof t.client_id === 'object' && t.client_id !== null
            ? String(t.client_id.client_id || '')
            : String(t.client_id || '')
        return cid === filterClientId
      })
    }

    // 5. Month or Date Range filter
    if (filterDateMode === 'month' && filterMonth) {
      result = result.filter((t) => {
        if (!t.task_duedate) return false
        const parts = t.task_duedate.split('-')
        return parts.length >= 2 && `${parts[0]}-${parts[1]}` === filterMonth
      })
    } else if (filterDateMode === 'range' && (filterStartDate || filterEndDate)) {
      result = result.filter((t) => {
        if (!t.task_duedate) return false
        const due = t.task_duedate.split('T')[0]
        if (filterStartDate && due < filterStartDate) return false
        if (filterEndDate && due > filterEndDate) return false
        return true
      })
    }

    // 6. Search Query
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((t) => {
        const title = (t.task_title || '').toLowerCase()
        const desc = (t.task_description || '').toLowerCase()
        const clientName = typeof t.client_id === 'object' ? (t.client_id?.client_name || '').toLowerCase() : ''
        const primaryEmp =
          typeof t.assignedTo === 'object'
            ? `${t.assignedTo?.first_name || ''} ${t.assignedTo?.last_name || ''}`.toLowerCase()
            : ''
        return title.includes(q) || desc.includes(q) || clientName.includes(q) || primaryEmp.includes(q)
      })
    }

    // 7. Sorting
    const [sortField, sortDir] = sortSelected.split(' ')
    const isAsc = sortDir === 'asc'

    result.sort((a, b) => {
      let valA: any = ''
      let valB: any = ''

      if (sortField === 'duedate') {
        valA = a.task_duedate || ''
        valB = b.task_duedate || ''
      } else if (sortField === 'title') {
        valA = (a.task_title || '').toLowerCase()
        valB = (b.task_title || '').toLowerCase()
      } else if (sortField === 'priority') {
        const pOrder: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 }
        valA = pOrder[a.task_priority || 'medium'] || 0
        valB = pOrder[b.task_priority || 'medium'] || 0
      } else if (sortField === 'status') {
        const sOrder: Record<string, number> = { pending: 1, in_progress: 2, completed: 3 }
        valA = sOrder[a.status || 'pending'] || 0
        valB = sOrder[b.status || 'pending'] || 0
      }

      if (valA < valB) return isAsc ? -1 : 1
      if (valA > valB) return isAsc ? 1 : -1
      return 0
    })

    return result
  }, [
    tasks,
    selectedStatusTab,
    filterEmployeeId,
    filterPriority,
    filterClientId,
    filterDateMode,
    filterMonth,
    filterStartDate,
    filterEndDate,
    search,
    sortSelected,
  ])

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filterEmployeeId !== 'all') count++
    if (filterPriority !== 'all') count++
    if (filterClientId !== 'all') count++
    if (filterDateMode === 'month' && filterMonth) count++
    if (filterDateMode === 'range' && (filterStartDate || filterEndDate)) count++
    return count
  }, [
    filterEmployeeId,
    filterPriority,
    filterClientId,
    filterDateMode,
    filterMonth,
    filterStartDate,
    filterEndDate,
  ])

  const handleResetFilters = () => {
    setFilterEmployeeId('all')
    setFilterPriority('all')
    setFilterClientId('all')
    setFilterMonth('')
    setFilterStartDate('')
    setFilterEndDate('')
    setCurrentPage(1)
  }

  // Column sort toggle protected by canSort()
  const handleSortToggle = (col: 'duedate' | 'title' | 'priority' | 'status') => {
    if (!canSort()) return
    const [currentKey, currentDir] = sortSelected.split(' ')
    if (currentKey === col) {
      setSortSelected(`${col} ${currentDir === 'asc' ? 'desc' : 'asc'}`)
    } else {
      setSortSelected(`${col} ${col === 'priority' ? 'desc' : 'asc'}`)
    }
  }

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedTasks.length / itemsPerPage))
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredAndSortedTasks.slice(start, start + itemsPerPage)
  }, [filteredAndSortedTasks, currentPage, itemsPerPage])

  // Bulk selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTaskIds(filteredAndSortedTasks.map((t) => String(t.task_id)))
    } else {
      setSelectedTaskIds([])
    }
  }

  const handleSelectRow = (taskId: string, checked: boolean) => {
    if (checked) {
      setSelectedTaskIds((prev) => [...prev, taskId])
    } else {
      setSelectedTaskIds((prev) => prev.filter((id) => id !== taskId))
    }
  }

  // Fetch fresh task details when viewing (from v1)
  const fetchTaskFresh = async (taskId: string | number) => {
    try {
      const res: any = await rdk.request(
        readItem('tasks', taskId, {
          fields: ['*', 'assignedTo.*', 'assignedToOthers.directus_users_id.*', 'client_id.*'],
        }),
      )
      if (res) {
        setDetailTask(res)
      }
    } catch (err) {
      console.error('Error fetching fresh task:', err)
    }
  }

  // Open detail view (ViewTask from v1)
  const handleOpenDetail = (task: TaskItem) => {
    setDetailTask(task)
    setDrawerTab('details')
    setSheetMode('view')
    fetchTaskFresh(task.task_id)
  }

  // Create / Edit modal opening (from v1 AddOrEditTask)
  const handleOpenCreateModal = () => {
    setFormTitle('')
    setFormDescription('')
    setFormClientId('')
    setFormAssigneeId(user?.id || firmEmployees[0]?.id || '')
    setFormOtherAssignees([])
    setFormDueDate(new Date().toISOString().slice(0, 10))
    setFormDueTime('12:00')
    setFormPriority('medium')
    setFormStatus('pending')
    setOtherAssigneeSearch('')
    setOtherAssigneeCategory('all')
    setSheetMode('create')
  }

  const handleOpenEditModal = (task: TaskItem) => {
    setDetailTask(task)
    setFormTitle(task.task_title || '')
    setFormDescription(task.task_description || '')
    setFormClientId(
      typeof task.client_id === 'object' && task.client_id !== null
        ? String(task.client_id.client_id || '')
        : String(task.client_id || ''),
    )
    setFormAssigneeId(
      typeof task.assignedTo === 'object' && task.assignedTo !== null
        ? String(task.assignedTo.id || '')
        : String(task.assignedTo || ''),
    )
    const otherIds: string[] = []
    if (Array.isArray(task.assignedToOthers)) {
      task.assignedToOthers.forEach((o) => {
        const uid =
          typeof o.directus_users_id === 'object' && o.directus_users_id !== null
            ? String(o.directus_users_id.id || '')
            : String(o.directus_users_id || '')
        if (uid) otherIds.push(uid)
      })
    }
    setFormOtherAssignees(otherIds)
    setFormDueDate(task.task_duedate ? task.task_duedate.split('T')[0] : '')
    setFormDueTime(task.task_duetime || '12:00')
    setFormPriority(task.task_priority || 'medium')
    setFormStatus(task.status || 'pending')
    setOtherAssigneeSearch('')
    setOtherAssigneeCategory('all')
    setSheetMode('edit')
  }

  // Save task mutation (Create / Update with payload sanitization from v1)
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim()) {
      toast.error('Task title is required')
      return
    }

    setIsSaving(true)
    try {
      const rawPayload: any = {
        task_title: formTitle.trim(),
        task_description: formDescription.trim(),
        status: formStatus,
        task_duedate: formDueDate ? new Date(formDueDate).toISOString() : null,
        task_duetime: formDueTime || null,
        assignedTo: formAssigneeId || null,
        client_id: formClientId ? Number(formClientId) || formClientId : null,
        task_priority: formPriority,
        assignedToOthers:
          formOtherAssignees.length > 0
            ? formOtherAssignees.map((id) => ({ directus_users_id: id }))
            : null,
      }

      // Filter out null and empty string ("") properties exactly like v1
      const cleanedPayload = Object.keys(rawPayload).reduce((acc: any, key: string) => {
        const value = rawPayload[key]
        if (value !== null && value !== '') {
          acc[key] = value
        }
        return acc
      }, {})

      if (sheetMode === 'edit' && detailTask) {
        await rdk.request(updateItem('tasks', detailTask.task_id, cleanedPayload))
        toast.success('Task updated successfully')
        queryClient.invalidateQueries({ queryKey: ['tasks_master_list'] })

        // Refresh detail view and switch back to view mode
        const updated: any = await rdk.request(
          readItem('tasks', detailTask.task_id, {
            fields: ['*', 'assignedTo.*', 'assignedToOthers.directus_users_id.*', 'client_id.*'],
          }),
        )
        setDetailTask(updated || { ...detailTask, ...cleanedPayload })
        setSheetMode('view')
      } else {
        await rdk.request(createItem('tasks', cleanedPayload))
        toast.success('Task created successfully')
        queryClient.invalidateQueries({ queryKey: ['tasks_master_list'] })
        setSheetMode(null)
      }
    } catch (err: any) {
      console.error('Save task error:', err)
      toast.error(err?.message || 'Failed to save task')
    } finally {
      setIsSaving(false)
    }
  }

  // Quick Status Updater with optimistic UI updates
  const handleQuickStatusChange = async (taskId: string | number, newStatus: TaskStatus) => {
    // 1. Optimistic update in query cache for instant reactivity
    queryClient.setQueriesData({ queryKey: ['tasks_master_list'] }, (old: any) => {
      if (!Array.isArray(old)) return old
      return old.map((t: any) =>
        String(t.task_id) === String(taskId) ? { ...t, status: newStatus } : t
      )
    })
    if (detailTask && String(detailTask.task_id) === String(taskId)) {
      setDetailTask((prev) => (prev ? { ...prev, status: newStatus } : null))
    }

    try {
      const cleanId = !isNaN(Number(taskId)) ? Number(taskId) : taskId
      await rdk.request(updateItem('tasks', cleanId as any, { status: newStatus }))
      toast.success(`Task marked as ${newStatus.replace('_', ' ')}`)
    } catch (err: any) {
      console.error('Failed to update task status:', err)
      queryClient.invalidateQueries({ queryKey: ['tasks_master_list'] })
      toast.error('Failed to update status')
    }
  }

  // Delete single task
  const handleDeleteSingle = async () => {
    if (!taskToDelete?.task_id) return
    try {
      await rdk.request(deleteItem('tasks', taskToDelete.task_id))
      toast.success('Task deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['tasks_master_list'] })
      setTaskToDelete(null)
      if (detailTask && String(detailTask.task_id) === String(taskToDelete.task_id)) {
        setSheetMode(null)
        setDetailTask(null)
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete task')
    }
  }

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedTaskIds.length === 0) return
    try {
      await rdk.request(deleteItems('tasks', selectedTaskIds))
      toast.success(`${selectedTaskIds.length} tasks deleted`)
      setSelectedTaskIds([])
      setBulkDeleteOpen(false)
      queryClient.invalidateQueries({ queryKey: ['tasks_master_list'] })
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete tasks')
    }
  }

  // Bulk mark complete
  const handleBulkMarkComplete = async () => {
    if (selectedTaskIds.length === 0) return
    const toastId = toast.loading('Updating tasks status...')
    try {
      await Promise.all(
        selectedTaskIds.map((id) =>
          rdk.request(updateItem('tasks', id, { status: 'completed' })),
        ),
      )
      toast.success('Selected tasks marked as completed', { id: toastId })
      setSelectedTaskIds([])
      queryClient.invalidateQueries({ queryKey: ['tasks_master_list'] })
    } catch {
      toast.error('Failed to update tasks', { id: toastId })
    }
  }

  // Excel Export
  const handleDownloadExcel = async () => {
    const listToExport =
      selectedTaskIds.length > 0
        ? filteredAndSortedTasks.filter((t) => selectedTaskIds.includes(String(t.task_id)))
        : filteredAndSortedTasks

    if (listToExport.length === 0) {
      toast.error('No tasks to export')
      return
    }

    try {
      toast.loading('Generating Excel task report...', { id: 'task-excel' })
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Tasks Report')

      const headerFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' },
      }
      const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      }

      worksheet.columns = [
        { header: 'Task ID', key: 'task_id', width: 12 },
        { header: 'Task Title', key: 'title', width: 32 },
        { header: 'Description', key: 'desc', width: 40 },
        { header: 'Client', key: 'client', width: 24 },
        { header: 'Primary Assignee', key: 'assignee', width: 24 },
        { header: 'Other Assignees', key: 'other_assignees', width: 28 },
        { header: 'Priority', key: 'priority', width: 14 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Due Date', key: 'due_date', width: 16 },
        { header: 'Due Time', key: 'due_time', width: 14 },
        { header: 'Date Created', key: 'date_created', width: 18 },
      ]

      const headerRow = worksheet.getRow(1)
      headerRow.height = 24
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FF1F2937' }, size: 10 }
        cell.fill = headerFill
        cell.alignment = { vertical: 'middle', horizontal: 'left' }
        cell.border = borderStyle
      })

      listToExport.forEach((task) => {
        const clientName =
          typeof task.client_id === 'object' && task.client_id !== null
            ? task.client_id.client_name || ''
            : ''
        const assigneeName =
          typeof task.assignedTo === 'object' && task.assignedTo !== null
            ? `${task.assignedTo.first_name || ''} ${task.assignedTo.last_name || ''}`.trim()
            : ''
        const otherNames = Array.isArray(task.assignedToOthers)
          ? task.assignedToOthers
              .map((o) => {
                if (typeof o.directus_users_id === 'object' && o.directus_users_id !== null) {
                  return `${o.directus_users_id.first_name || ''} ${o.directus_users_id.last_name || ''}`.trim()
                }
                return ''
              })
              .filter(Boolean)
              .join(', ')
          : ''

        const row = worksheet.addRow({
          task_id: `#${task.task_id}`,
          title: task.task_title || '',
          desc: task.task_description || '',
          client: clientName || '-',
          assignee: assigneeName || 'Unassigned',
          other_assignees: otherNames || '-',
          priority: (task.task_priority || 'medium').toUpperCase(),
          status: (task.status || 'pending').replace('_', ' ').toUpperCase(),
          due_date: task.task_duedate ? task.task_duedate.split('T')[0] : '-',
          due_time: task.task_duetime || '-',
          date_created: task.date_created ? new Date(task.date_created).toLocaleDateString() : '-',
        })

        row.height = 20
        row.eachCell((cell) => {
          cell.font = { size: 9 }
          cell.alignment = { vertical: 'middle' }
          cell.border = borderStyle
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `Tasks_Report_${new Date().toISOString().slice(0, 10)}.xlsx`
      link.click()
      URL.revokeObjectURL(link.href)
      toast.success('Excel report downloaded successfully!', { id: 'task-excel' })
    } catch (err) {
      console.error(err)
      toast.error('Failed to export Excel report', { id: 'task-excel' })
    }
  }

  // Helper check for overdue
  const isTaskOverdue = (task: TaskItem) => {
    if (!task.task_duedate || task.status === 'completed') return false
    const due = new Date(task.task_duedate).toISOString().slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)
    return due < today
  }

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel
        className={cn(
          'flex min-w-0 flex-1 flex-col h-full overflow-hidden',
          firstTabActive && 'rounded-tl-none',
        )}
      >
        {/* Top Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5 bg-background/50">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <ListTodo className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-foreground">
                  Task Management
                </h1>
                <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-medium">
                  {tasks.length} Total
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Assign tasks, track due dates, priorities, and view team task completion reports
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-2xs"
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReportModalOpen(true)}
              className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-2xs text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              Generate Report
            </Button>
            <Button
              size="sm"
              onClick={handleOpenCreateModal}
              className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-2xs"
            >
              <Plus className="size-3.5" />
              New Task
            </Button>
          </div>
        </div>

        {/* Status Tabs and Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5 bg-background">
          {/* Status Tabs */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setSelectedStatusTab('all')
                setCurrentPage(1)
              }}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer',
                selectedStatusTab === 'all'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              All {counts.all}
            </button>
            <button
              onClick={() => {
                setSelectedStatusTab('pending')
                setCurrentPage(1)
              }}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                selectedStatusTab === 'pending'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <span className="size-1.5 rounded-full bg-amber-400" />
              Pending {counts.pending}
            </button>
            <button
              onClick={() => {
                setSelectedStatusTab('in_progress')
                setCurrentPage(1)
              }}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                selectedStatusTab === 'in_progress'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <span className="size-1.5 rounded-full bg-blue-400" />
              In Progress {counts.inprogress}
            </button>
            <button
              onClick={() => {
                setSelectedStatusTab('completed')
                setCurrentPage(1)
              }}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                selectedStatusTab === 'completed'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Completed {counts.completed}
            </button>
          </div>

          {/* Right Toolbar: Search, Filters, Sort */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Search tasks, assignee, client..."
                className="h-7.5 w-60 pl-8 pr-7 text-xs bg-muted/30 focus-visible:bg-background rounded-lg"
              />
              {search && (
                <button
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
                      'text-primary font-semibold border-primary/20 bg-primary/5',
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
              <PopoverContent className="w-80 p-3.5 space-y-3.5" align="end">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-semibold">Filter Tasks</span>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={handleResetFilters}
                      className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                    >
                      Reset all
                    </button>
                  )}
                </div>

                {/* Filter by Employee */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Assignee / Staff
                  </label>
                  <Select
                    value={filterEmployeeId}
                    onValueChange={(val) => {
                      setFilterEmployeeId(val)
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="All Staff Members" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      <SelectItem value="all">All Staff Members</SelectItem>
                      {filterEmployeeOptions.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter by Priority */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Priority Level
                  </label>
                  <Select
                    value={filterPriority}
                    onValueChange={(val) => {
                      setFilterPriority(val)
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="All Priorities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.key} value={p.key}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter by Client */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Client Entity
                  </label>
                  <Select
                    value={filterClientId}
                    onValueChange={(val) => {
                      setFilterClientId(val)
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="All Clients" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={String(c.client_id)} value={String(c.client_id)}>
                          {c.client_name || `Client #${c.client_id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter by Due Date (Month-wise or Date Range) */}
                <div className="space-y-2 border-t pt-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                      <CalendarDays className="size-3 text-muted-foreground" />
                      Due Date Filter
                    </label>
                    {((filterDateMode === 'month' && filterMonth) ||
                      (filterDateMode === 'range' && (filterStartDate || filterEndDate))) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFilterMonth('')
                          setFilterStartDate('')
                          setFilterEndDate('')
                          setCurrentPage(1)
                        }}
                        className="text-[10px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                      >
                        Clear date
                      </button>
                    )}
                  </div>

                  {/* Mode switcher tabs */}
                  <div className="flex items-center rounded-md bg-muted/60 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setFilterDateMode('month')
                        setCurrentPage(1)
                      }}
                      className={cn(
                        'flex-1 py-1 rounded text-[11px] font-medium transition-all text-center cursor-pointer',
                        filterDateMode === 'month'
                          ? 'bg-background text-foreground shadow-2xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      Month-wise
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterDateMode('range')
                        setCurrentPage(1)
                      }}
                      className={cn(
                        'flex-1 py-1 rounded text-[11px] font-medium transition-all text-center cursor-pointer',
                        filterDateMode === 'range'
                          ? 'bg-background text-foreground shadow-2xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      Date Range
                    </button>
                  </div>

                  {filterDateMode === 'month' ? (
                    <div className="flex items-center gap-1.5 pt-1">
                      <Input
                        type="month"
                        value={filterMonth}
                        onChange={(e) => {
                          setFilterMonth(e.target.value)
                          setCurrentPage(1)
                        }}
                        className="h-8 text-xs bg-background flex-1"
                      />
                      {filterMonth && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setFilterMonth('')
                            setCurrentPage(1)
                          }}
                          className="size-8 text-muted-foreground hover:text-foreground shrink-0"
                          title="Clear month filter"
                        >
                          <X className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="block text-[10px] text-muted-foreground mb-1">From</span>
                          <Input
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => {
                              setFilterStartDate(e.target.value)
                              setCurrentPage(1)
                            }}
                            className="h-8 text-xs bg-background px-2"
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] text-muted-foreground mb-1">To</span>
                          <Input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => {
                              setFilterEndDate(e.target.value)
                              setCurrentPage(1)
                            }}
                            className="h-8 text-xs bg-background px-2"
                          />
                        </div>
                      </div>
                    </div>
                  )}
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
              <PopoverContent className="w-56 p-2 space-y-1" align="end">
                <span className="text-[11px] font-semibold text-muted-foreground px-2 py-1 block">
                  Sort Order
                </span>
                {[
                  { label: 'Due Date: Soonest First', value: 'duedate asc' },
                  { label: 'Due Date: Latest First', value: 'duedate desc' },
                  { label: 'Priority: Highest First', value: 'priority desc' },
                  { label: 'Priority: Lowest First', value: 'priority asc' },
                  { label: 'Title: A to Z', value: 'title asc' },
                  { label: 'Title: Z to A', value: 'title desc' },
                ].map((s) => (
                  <button
                    key={s.value}
                    onClick={() => {
                      setSortSelected(s.value)
                      setSortPopoverOpen(false)
                    }}
                    className={cn(
                      'w-full text-left px-2.5 py-1.5 text-xs rounded-md flex items-center justify-between cursor-pointer transition-colors',
                      sortSelected === s.value
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-muted text-foreground',
                    )}
                  >
                    <span>{s.label}</span>
                    {sortSelected === s.value && <Check className="size-3.5 text-primary" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Selected Items Banner */}
        {selectedTaskIds.length > 0 && (
          <div className="flex shrink-0 items-center justify-between border-b border-primary/20 bg-primary/5 px-5 py-2 duration-150 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium text-foreground">
                <strong className="font-semibold text-primary">{selectedTaskIds.length}</strong> task
                {selectedTaskIds.length > 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadExcel}
                className="h-7 text-xs font-medium gap-1 cursor-pointer bg-background"
              >
                <FileSpreadsheet className="size-3 text-emerald-600" />
                Download Report
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkMarkComplete}
                className="h-7 text-xs font-medium gap-1 cursor-pointer bg-background"
              >
                <CheckCircle2 className="size-3 text-emerald-600" />
                Mark Completed
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
                className="h-7 text-xs font-medium gap-1 cursor-pointer text-destructive hover:bg-destructive/10 border-destructive/20 bg-background"
              >
                <Trash2 className="size-3" />
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTaskIds([])}
                className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Spreadsheet Table View */}
        <div className="min-h-0 flex-1 overflow-auto bg-card">
          <table className="w-full border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-20 bg-card shadow-2xs">
              <tr className="text-muted-foreground font-semibold">
                {/* Sticky Checkbox */}
                <th className="sticky left-0 top-0 z-30 bg-card py-2.5 px-3 w-10 text-center border-t border-b border-l border-r border-gray-200 dark:border-border shadow-[1px_0_0_0_rgba(0,0,0,0.06)]">
                  <Checkbox
                    checked={
                      paginatedTasks.length > 0 &&
                      paginatedTasks.every((t) => selectedTaskIds.includes(String(t.task_id)))
                    }
                    onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                    aria-label="Select all"
                  />
                </th>

                {/* Task Title Header */}
                <th
                  onClick={() => handleSortToggle('title')}
                  style={{ width: colWidths.task, minWidth: colWidths.task }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border cursor-pointer select-none hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 pr-2">
                    <span>TASK TITLE</span>
                    <ArrowUpDown className="size-3 text-muted-foreground/70" />
                  </div>
                  <ColumnResizer
                    isResizing={isResizing === 'task'}
                    onMouseDown={(e) => startResizing('task', e)}
                  />
                </th>

                {/* Assignee Header */}
                <th
                  style={{ width: colWidths.assignee, minWidth: colWidths.assignee }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border select-none"
                >
                  <span className="pr-2">ASSIGNEE</span>
                  <ColumnResizer
                    isResizing={isResizing === 'assignee'}
                    onMouseDown={(e) => startResizing('assignee', e)}
                  />
                </th>

                {/* Due Date Header */}
                <th
                  onClick={() => handleSortToggle('duedate')}
                  style={{ width: colWidths.duedate, minWidth: colWidths.duedate }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border cursor-pointer select-none hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 pr-2">
                    <span>DUE DATE & TIME</span>
                    <ArrowUpDown className="size-3 text-muted-foreground/70" />
                  </div>
                  <ColumnResizer
                    isResizing={isResizing === 'duedate'}
                    onMouseDown={(e) => startResizing('duedate', e)}
                  />
                </th>

                {/* Priority Header */}
                <th
                  onClick={() => handleSortToggle('priority')}
                  style={{ width: colWidths.priority, minWidth: colWidths.priority }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border cursor-pointer select-none hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 pr-2">
                    <span>PRIORITY</span>
                    <ArrowUpDown className="size-3 text-muted-foreground/70" />
                  </div>
                  <ColumnResizer
                    isResizing={isResizing === 'priority'}
                    onMouseDown={(e) => startResizing('priority', e)}
                  />
                </th>

                {/* Status Header */}
                <th
                  onClick={() => handleSortToggle('status')}
                  style={{ width: colWidths.status, minWidth: colWidths.status }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border cursor-pointer select-none hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 pr-2">
                    <span>STATUS</span>
                    <ArrowUpDown className="size-3 text-muted-foreground/70" />
                  </div>
                  <ColumnResizer
                    isResizing={isResizing === 'status'}
                    onMouseDown={(e) => startResizing('status', e)}
                  />
                </th>

                {/* Actions Header */}
                <th
                  style={{ width: colWidths.actions, minWidth: colWidths.actions }}
                  className="py-2.5 px-3 text-right border-t border-b border-r border-gray-200 dark:border-border"
                >
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoadingTasks ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3 px-3 border-b border-l border-r border-gray-200 dark:border-border">
                      <div className="h-4 w-4 bg-muted rounded mx-auto" />
                    </td>
                    <td className="py-3 px-3 border-b border-r border-gray-200 dark:border-border">
                      <div className="h-4 w-48 bg-muted rounded mb-1" />
                      <div className="h-3 w-32 bg-muted/60 rounded" />
                    </td>
                    <td className="py-3 px-3 border-b border-r border-gray-200 dark:border-border">
                      <div className="h-4 w-32 bg-muted rounded" />
                    </td>
                    <td className="py-3 px-3 border-b border-r border-gray-200 dark:border-border">
                      <div className="h-4 w-24 bg-muted rounded" />
                    </td>
                    <td className="py-3 px-3 border-b border-r border-gray-200 dark:border-border">
                      <div className="h-5 w-16 bg-muted rounded-full" />
                    </td>
                    <td className="py-3 px-3 border-b border-r border-gray-200 dark:border-border">
                      <div className="h-5 w-20 bg-muted rounded-full" />
                    </td>
                    <td className="py-3 px-3 border-b border-r border-gray-200 dark:border-border text-right">
                      <div className="h-4 w-14 bg-muted rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : paginatedTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground border-b border-l border-r border-gray-200 dark:border-border">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ListTodo className="size-8 text-muted-foreground/40" />
                      <p className="text-sm font-medium">No tasks found</p>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        Try adjusting your search query, status tabs, or employee filters.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenCreateModal}
                        className="mt-2 h-7 text-xs"
                      >
                        <Plus className="size-3.5 mr-1" />
                        Create First Task
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTasks.map((task) => {
                  const isSelected = selectedTaskIds.includes(String(task.task_id))
                  const overdue = isTaskOverdue(task)
                  const prioInfo =
                    PRIORITIES.find((p) => p.key === task.task_priority) || PRIORITIES[2]

                  const primaryEmp =
                    typeof task.assignedTo === 'object' && task.assignedTo !== null
                      ? task.assignedTo
                      : null
                  const primaryName = primaryEmp
                    ? `${primaryEmp.first_name || ''} ${primaryEmp.last_name || ''}`.trim() || 'Staff'
                    : 'Unassigned'

                  const otherCount = Array.isArray(task.assignedToOthers)
                    ? task.assignedToOthers.length
                    : 0

                  const clientName =
                    typeof task.client_id === 'object' && task.client_id !== null
                      ? task.client_id.client_name
                      : null

                  return (
                    <tr
                      key={String(task.task_id)}
                      onClick={() => handleOpenDetail(task)}
                      className={cn(
                        'group hover:bg-muted/40 cursor-pointer transition-colors',
                        isSelected && 'bg-primary/5 hover:bg-primary/10',
                      )}
                    >
                      {/* Sticky Checkbox */}
                      <td
                        onClick={(e) => e.stopPropagation()}
                        className="sticky left-0 z-10 bg-card group-hover:bg-muted/40 py-2.5 px-3 text-center border-b border-l border-r border-gray-200 dark:border-border shadow-[1px_0_0_0_rgba(0,0,0,0.06)]"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            handleSelectRow(String(task.task_id), Boolean(checked))
                          }
                          aria-label={`Select task ${task.task_title}`}
                        />
                      </td>

                      {/* Task Title & Client */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                              {task.task_title}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              #{task.task_id}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            {clientName && (
                              <span className="inline-flex items-center gap-1 text-primary/80 font-medium">
                                <Building2 className="size-3" />
                                {clientName}
                              </span>
                            )}
                            {task.task_description && (
                              <span className="truncate max-w-[200px]">
                                {task.task_description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Assignee */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <div className="flex items-center gap-2">
                          <EmployeeAvatar
                            name={primaryName}
                            employeeId={primaryEmp?.id}
                            avatar={primaryEmp?.avatar}
                            className="size-7 shrink-0 text-xs"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate font-medium text-foreground">
                              {primaryName}
                            </span>
                            {primaryEmp?.title && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                {primaryEmp.title}
                              </span>
                            )}
                          </div>
                          {otherCount > 0 && (
                            <Badge
                              variant="secondary"
                              className="h-4 px-1 text-[9px] font-semibold text-muted-foreground shrink-0"
                              title={`+${otherCount} other assignees`}
                            >
                              +{otherCount}
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Due Date & Time */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <CalendarDays className="size-3 text-muted-foreground" />
                            <span
                              className={cn(
                                'font-medium',
                                overdue
                                  ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                  : 'text-foreground',
                              )}
                            >
                              {task.task_duedate
                                ? new Date(task.task_duedate).toLocaleDateString('en-US', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : 'No deadline'}
                            </span>
                          </div>
                          {task.task_duetime && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground pl-4">
                              <Clock className="size-2.5" />
                              <span>{task.task_duetime}</span>
                              {overdue && (
                                <span className="ml-1 text-rose-500 font-semibold text-[9px]">
                                  OVERDUE
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border',
                            prioInfo.badgeCls,
                          )}
                        >
                          {prioInfo.label}
                        </span>
                      </td>

                      {/* Status Dropdown */}
                      <td
                        onClick={(e) => e.stopPropagation()}
                        className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border"
                      >
                        <TaskStatusSelect
                          taskId={task.task_id}
                          currentStatus={task.status}
                          onChange={handleQuickStatusChange}
                        />
                      </td>

                      {/* Actions */}
                      <td
                        onClick={(e) => e.stopPropagation()}
                        className="py-2.5 px-3 text-right border-b border-r border-gray-200 dark:border-border"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDetail(task)}
                            className="size-7 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="View Task Details"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDetailTask(task)
                              handleOpenEditModal(task)
                            }}
                            className="size-7 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Edit Task"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setTaskToDelete(task)}
                            className="size-7 cursor-pointer text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="Delete Task"
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

        {/* Sticky Pagination Bar */}
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
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              per page • {filteredAndSortedTasks.length} tasks
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
      </Panel>

      {/* Unified Task Drawer / Sheet (View, Create, Edit matching v1) */}
      <Sheet open={sheetMode !== null} onOpenChange={(open) => !open && setSheetMode(null)}>
        <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col bg-background">
          {sheetMode === 'view' && detailTask && (
            <>
              {/* Sheet Header */}
              <div className="p-5 border-b border-border bg-muted/20 flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      #{detailTask.task_id}
                    </Badge>
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border',
                        (PRIORITIES.find((p) => p.key === detailTask.task_priority) || PRIORITIES[2])
                          .badgeCls,
                      )}
                    >
                      {detailTask.task_priority || 'medium'}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-foreground tracking-tight line-clamp-2">
                    {detailTask.task_title}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 me-10">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEditModal(detailTask)}
                    className="h-8 gap-1 text-xs cursor-pointer"
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTaskToDelete(detailTask)}
                    className="h-8 size-8 p-0 text-destructive hover:bg-destructive/10 border-destructive/20 cursor-pointer"
                    title="Delete Task"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Tabs for Details vs Reports */}
              <div className="flex border-b border-border px-5 gap-4">
                <button
                  type="button"
                  onClick={() => setDrawerTab('details')}
                  className={cn(
                    'h-10 px-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer',
                    drawerTab === 'details'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  Task Overview
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('reports')}
                  className={cn(
                    'h-10 px-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5',
                    drawerTab === 'reports'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  Reports
                  <span className="size-4 rounded-full bg-muted text-[10px] font-bold text-foreground grid place-items-center">
                    {taskReports.length}
                  </span>
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {drawerTab === 'details' ? (
                  <>
                    {/* Status & Deadline Box */}
                    <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-border bg-muted/20">
                      <div>
                        <span className="text-[11px] font-semibold text-muted-foreground block mb-1">
                          Current Status
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'size-2 rounded-full',
                              (STATUSES.find((s) => s.key === detailTask.status) || STATUSES[0]).dotCls,
                            )}
                          />
                          <span className="text-xs font-semibold capitalize text-foreground">
                            {(detailTask.status || 'pending').replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-semibold text-muted-foreground block mb-1">
                          Due Date & Time
                        </span>
                        <div className="text-xs font-medium text-foreground flex items-center gap-1">
                          <CalendarDays className="size-3 text-muted-foreground" />
                          <span>
                            {detailTask.task_duedate
                              ? new Date(detailTask.task_duedate).toLocaleDateString('en-US', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : 'No date'}
                          </span>
                          {detailTask.task_duetime && (
                            <span className="text-muted-foreground">({format12HourTime(detailTask.task_duetime)})</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Client Information */}
                    {detailTask.client_id && typeof detailTask.client_id === 'object' && (
                      <div className="p-3.5 rounded-xl border border-border bg-card space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                          <Building2 className="size-4 text-primary" />
                          <span>Client Details</span>
                        </div>
                        <div className="text-xs space-y-1 pl-6">
                          <div>
                            <strong className="text-muted-foreground font-medium">Name: </strong>
                            <span className="font-semibold text-foreground">
                              {detailTask.client_id.client_name || '-'}
                            </span>
                          </div>
                          {detailTask.client_id.client_phone && (
                            <div>
                              <strong className="text-muted-foreground font-medium">Phone: </strong>
                              <span>{detailTask.client_id.client_phone}</span>
                            </div>
                          )}
                          {detailTask.client_id.client_address && (
                            <div>
                              <strong className="text-muted-foreground font-medium">Address: </strong>
                              <span>{detailTask.client_id.client_address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Assignees */}
                    <div className="p-3.5 rounded-xl border border-border bg-card space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <User className="size-4 text-primary" />
                        <span>Primary Assignee</span>
                      </div>
                      {detailTask.assignedTo && typeof detailTask.assignedTo === 'object' ? (
                        <div className="flex items-center gap-3 pl-6">
                          <EmployeeAvatar
                            name={`${detailTask.assignedTo.first_name || ''} ${detailTask.assignedTo.last_name || ''}`}
                            employeeId={detailTask.assignedTo.id}
                            avatar={detailTask.assignedTo.avatar}
                            className="size-8 text-xs"
                          />
                          <div>
                            <p className="text-xs font-semibold text-foreground">
                              {detailTask.assignedTo.first_name} {detailTask.assignedTo.last_name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {detailTask.assignedTo.title || detailTask.assignedTo.email || 'Staff Member'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground pl-6">No primary assignee</p>
                      )}

                      {/* Additional team members */}
                      {Array.isArray(detailTask.assignedToOthers) &&
                        detailTask.assignedToOthers.length > 0 && (
                          <div className="pt-2 border-t border-border/60">
                            <span className="text-[11px] font-semibold text-muted-foreground block mb-2">
                              Additional Assigned Team Members ({detailTask.assignedToOthers.length})
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {detailTask.assignedToOthers.map((item, idx) => {
                                const u = item.directus_users_id
                                const name =
                                  typeof u === 'object' && u !== null
                                    ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
                                    : 'Team Member'
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-muted/40 text-xs"
                                  >
                                    <EmployeeAvatar
                                      name={name}
                                      employeeId={typeof u === 'object' ? u?.id : undefined}
                                      avatar={typeof u === 'object' ? u?.avatar : undefined}
                                      className="size-5 text-[9px]"
                                    />
                                    <span>{name}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                    </div>

                    {/* Task Description */}
                    <div className="p-3.5 rounded-xl border border-border bg-card space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <FileText className="size-4 text-primary" />
                        <span>Task Description</span>
                      </div>
                      <p className="text-xs text-foreground/90 whitespace-pre-wrap pl-6 leading-relaxed">
                        {detailTask.task_description || 'No description provided for this task.'}
                      </p>
                    </div>
                  </>
                ) : (
                  /* Reports Tab */
                  <div className="space-y-3">
                    {isLoadingReports ? (
                      <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        <span>Loading reports...</span>
                      </div>
                    ) : taskReports.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground space-y-2">
                        <CheckCircle2 className="size-8 mx-auto text-muted-foreground/40" />
                        <p className="text-xs font-medium">No reports submitted yet</p>
                        <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                          Reports submitted by field agents or team members will appear here along with attached photos.
                        </p>
                      </div>
                    ) : (
                      taskReports.map((report) => {
                        const reporterName = report.submitted_by
                          ? `${report.submitted_by.first_name || ''} ${report.submitted_by.last_name || ''}`.trim() || 'Staff'
                          : 'Staff Member'
                        const images = Array.isArray(report.task_images)
                          ? report.task_images
                              .map((img) => {
                                const fileId =
                                  typeof img.directus_files_id === 'object'
                                    ? (img.directus_files_id as any)?.id
                                    : img.directus_files_id
                                return fileId ? `${ATTENDANCE_SERVER_URL || API_URL}/assets/${fileId}` : ''
                              })
                              .filter(Boolean)
                          : []

                        return (
                          <div
                            key={String(report.id)}
                            className="p-4 rounded-xl border border-border bg-card space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <EmployeeAvatar name={reporterName} className="size-6 text-[10px]" />
                                <span className="text-xs font-semibold text-foreground">
                                  {reporterName}
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock4 className="size-3" />
                                {report.submitted_at
                                  ? new Date(report.submitted_at).toLocaleString('en-US', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: 'numeric',
                                      minute: '2-digit',
                                    })
                                  : '-'}
                              </span>
                            </div>

                            {report.review && (
                              <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                {report.review}
                              </p>
                            )}

                            {images.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                                  Attached Photos ({images.length})
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {images.map((imgUrl, i) => (
                                    <button
                                      key={i}
                                      onClick={() => {
                                        setLightboxImages(images)
                                        setLightboxIndex(i)
                                        setLightboxOpen(true)
                                      }}
                                      className="group relative size-16 rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-primary transition-all cursor-pointer"
                                    >
                                      <img
                                        src={imgUrl}
                                        alt={`Report attachment ${i + 1}`}
                                        className="size-full object-cover group-hover:scale-105 transition-transform"
                                      />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Sheet Footer Quick Status Actions */}
              <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Quick Action:</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickStatusChange(detailTask.task_id, 'pending')}
                    disabled={detailTask.status === 'pending'}
                    className="h-8 text-xs cursor-pointer"
                  >
                    Set Pending
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickStatusChange(detailTask.task_id, 'in_progress')}
                    disabled={detailTask.status === 'in_progress'}
                    className="h-8 text-xs cursor-pointer"
                  >
                    Set In Progress
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleQuickStatusChange(detailTask.task_id, 'completed')}
                    disabled={detailTask.status === 'completed'}
                    className="h-8 text-xs cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="size-3.5 mr-1" />
                    Complete
                  </Button>
                </div>
              </div>
            </>
          )}

          {(sheetMode === 'create' || sheetMode === 'edit') && (
            <>
              {/* Header */}
              <div className="p-5 border-b border-border bg-muted/20">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  {sheetMode === 'edit' ? 'Edit Task' : 'New Task'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sheetMode === 'edit'
                    ? 'Update task details, assignees, deadline, or priority.'
                    : 'Set up a new task with assignees, deadline, and instructions.'}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveTask} className="flex flex-col min-h-0 flex-1">
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {/* Client Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Client (Optional)
                    </label>
                    <Select
                      value={formClientId || 'none'}
                      onValueChange={(val) => setFormClientId(val === 'none' ? '' : val)}
                    >
                      <SelectTrigger className="h-9 text-xs bg-background">
                        <SelectValue placeholder="Select a client..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        <SelectItem value="none">No Client Linked</SelectItem>
                        {clients.map((c) => (
                          <SelectItem key={String(c.client_id)} value={String(c.client_id)}>
                            {c.client_name} {c.client_phone ? `(${c.client_phone})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Task Status */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Task Status <span className="text-rose-500">*</span>
                    </label>
                    <Select
                      value={formStatus}
                      onValueChange={(val: TaskStatus) => setFormStatus(val)}
                    >
                      <SelectTrigger className="h-9 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s.key} value={s.key}>
                            <div className="flex items-center gap-2">
                              <span className={cn('size-1.5 rounded-full', s.dotCls)} />
                              <span>{s.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Task Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Task Title <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="What needs to be done?"
                      className="h-9 text-xs bg-background"
                      required
                    />
                  </div>

                  {/* Task Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Description
                    </label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Provide instructions, checkpoints, and guidelines for this task..."
                      rows={4}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    />
                  </div>

                  {/* Due Date & Time */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Due Date
                      </label>
                      <Input
                        type="date"
                        value={formDueDate}
                        onChange={(e) => setFormDueDate(e.target.value)}
                        className="h-9 text-xs bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Due Time
                      </label>
                      <Input
                        type="time"
                        value={formDueTime}
                        onChange={(e) => setFormDueTime(e.target.value)}
                        className="h-9 text-xs bg-background"
                      />
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Priority Level
                    </label>
                    <Select
                      value={formPriority}
                      onValueChange={(val: TaskPriority) => setFormPriority(val)}
                    >
                      <SelectTrigger className="h-9 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p.key} value={p.key}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assigned To (Primary Assignee) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Assigned To (Primary Assignee)
                    </label>
                    <Select
                      value={formAssigneeId || 'none'}
                      onValueChange={(val) => setFormAssigneeId(val === 'none' ? '' : val)}
                    >
                      <SelectTrigger className="h-9 text-xs bg-background">
                        <SelectValue placeholder="Select Employee..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        <SelectItem value="none">Unassigned / No Primary Assignee</SelectItem>
                        {firmEmployees
                          .filter((emp) => emp.status !== 'archived')
                          .map((e) => {
                            const fullName = `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Staff'
                            return (
                              <SelectItem key={e.id} value={e.id}>
                                {fullName} {e.title ? `(${e.title})` : ''}
                              </SelectItem>
                            )
                          })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assign To Others (Team Members) Section from v1 */}
                  <div className="space-y-2.5 pt-2 border-t border-border/80">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Users className="size-3.5 text-primary" />
                        <span>Assign To Others</span>
                        {formOtherAssignees.length > 0 && (
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold">
                            {formOtherAssignees.length} selected
                          </Badge>
                        )}
                      </label>
                    </div>

                    {/* Selected Tags list */}
                    {formOtherAssignees.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border bg-muted/30 max-h-24 overflow-y-auto">
                        {formOtherAssignees.map((id) => {
                          const emp = firmEmployees.find((e) => String(e.id) === String(id))
                          const name = emp
                            ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Staff'
                            : `Staff #${id.slice(-4)}`
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-md text-[11px] font-medium bg-background border border-border shadow-2xs text-foreground"
                            >
                              <EmployeeAvatar
                                name={name}
                                employeeId={id}
                                avatar={emp?.avatar}
                                className="size-4 text-[8px]"
                              />
                              <span className="truncate max-w-[120px]">{name}</span>
                              <button
                                type="button"
                                onClick={() => handleToggleOtherAssignee(id)}
                                className="size-3.5 rounded-full hover:bg-muted grid place-items-center text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <X className="size-2.5" />
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    )}

                    {/* Category Filter Chips (from v1) */}
                    {categories.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Filter by Category
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                          <button
                            type="button"
                            onClick={() => setOtherAssigneeCategory('all')}
                            className={cn(
                              'px-2 py-1 text-[11px] rounded-md font-medium border transition-colors shrink-0 cursor-pointer',
                              otherAssigneeCategory === 'all'
                                ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                                : 'bg-background hover:bg-muted text-muted-foreground border-border',
                            )}
                          >
                            All Categories
                          </button>
                          {categories.map((cat) => {
                            const catId = String(cat.employee_category_id || '')
                            const isSelected = otherAssigneeCategory === catId
                            return (
                              <button
                                key={catId}
                                type="button"
                                onClick={() => setOtherAssigneeCategory(isSelected ? 'all' : catId)}
                                className={cn(
                                  'px-2 py-1 text-[11px] rounded-md font-medium border transition-colors shrink-0 cursor-pointer',
                                  isSelected
                                    ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                                    : 'bg-background hover:bg-muted text-muted-foreground border-border',
                                )}
                              >
                                {cat.employee_category_name || `Category #${catId}`}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Search & Select All action bar */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={otherAssigneeSearch}
                          onChange={(e) => setOtherAssigneeSearch(e.target.value)}
                          placeholder="Search employees by name..."
                          className="h-8 pl-8 text-xs bg-background"
                        />
                      </div>
                      {filteredEmployeeIds.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleToggleSelectAllFiltered}
                          className={cn(
                            'h-8 px-2.5 text-xs font-semibold shrink-0 cursor-pointer',
                            isAllFilteredSelected
                              ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                              : 'text-primary hover:text-primary hover:bg-primary/10',
                          )}
                        >
                          {isAllFilteredSelected ? 'Deselect All' : 'Select All'} (
                          {filteredEmployeeIds.length})
                        </Button>
                      )}
                    </div>

                    {/* Scrollable Staff List */}
                    <div className="border border-border rounded-lg max-h-48 overflow-y-auto divide-y divide-border/60 bg-card">
                      {filteredOtherEmployees.length === 0 ? (
                        <div className="py-6 text-center text-xs text-muted-foreground">
                          No matching employees found
                        </div>
                      ) : (
                        filteredOtherEmployees.map((emp) => {
                          const id = String(emp.id)
                          const isChecked = formOtherAssignees.includes(id)
                          const name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Staff'
                          const catName =
                            typeof emp.employee_category_id === 'object' && emp.employee_category_id !== null
                              ? emp.employee_category_id.employee_category_name
                              : ''

                          return (
                            <div
                              key={id}
                              onClick={() => handleToggleOtherAssignee(id)}
                              className={cn(
                                'flex items-center justify-between gap-3 px-3 py-2 text-xs transition-colors cursor-pointer hover:bg-muted/50',
                                isChecked && 'bg-primary/5',
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => handleToggleOtherAssignee(id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="size-4"
                                />
                                <EmployeeAvatar
                                  name={name}
                                  employeeId={id}
                                  avatar={emp.avatar}
                                  className="size-6 text-[10px] shrink-0"
                                />
                                <div className="flex flex-col min-w-0">
                                  <span className="font-medium text-foreground truncate">
                                    {name}
                                  </span>
                                  {emp.title && (
                                    <span className="text-[10px] text-muted-foreground truncate">
                                      {emp.title}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {catName && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-normal text-muted-foreground shrink-0"
                                >
                                  {catName}
                                </Badge>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Form Footer */}
                <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (sheetMode === 'edit' && detailTask) {
                        setSheetMode('view')
                      } else {
                        setSheetMode(null)
                      }
                    }}
                    className="h-8 text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="h-8 text-xs cursor-pointer"
                  >
                    {isSaving && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                    {sheetMode === 'edit' ? 'Update Task' : 'Create Task'}
                  </Button>
                </div>
              </form>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Single Task Alert */}
      <AlertDialog
        open={taskToDelete !== null}
        onOpenChange={(open) => !open && setTaskToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete task &ldquo;{taskToDelete?.task_title}&rdquo;? This action
              cannot be undone and will remove all submitted task reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSingle}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Tasks Alert */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Tasks</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedTaskIds.length} selected tasks? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Lightbox for Report Photos */}
      <ImageLightbox
        isOpen={lightboxOpen}
        src={lightboxImages[lightboxIndex] || null}
        images={lightboxImages}
        currentIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIndex}
      />

      {/* Task Report Generator Modal (from v1 Reports.jsx & exportsOverallTaskToExcel) */}
      <TaskReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        firmName={firmObj?.firm_name || 'RRV Softech Pvt Ltd'}
        creatorName={`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Admin'}
        firmEmployees={firmEmployees}
        categories={categories}
        allTasks={tasks}
      />
    </div>
  )
}
