import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Search,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  Copy,
  Cake,
  Building2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Layers,
  Tag,
  Filter,
  ArrowUpDown,
  SlidersHorizontal,
  Users,
  UserCheck,
  UserX,
  CalendarDays,
  ShieldCheck,
  Briefcase,
  UserMinus,
  UserPlus,
} from 'lucide-react'

import rdk, { customEndpoint, readItems, API_URL } from '@/services/server'
import {
  SYSTEM_ROLE_IDS,
  isRoleAdmin,
  isRoleManager,
  getPermittedRoleIdsForQuery,
} from '@/constants/roles'
import { useAuth } from '@/context/auth/AuthContext'
import { useShell } from '@/components/admin/shell-context'
import Panel from '@/components/admin/Panel'
import { EmployeeAvatar } from '@/lib/people'
import { useResizableColumns, ColumnResizer } from '@/hooks/useResizableColumns'
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
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import Menu from '@/features/employees/components/Menu'
import { cn } from '@/lib/utils'

import { formatTime } from '@/lib/timeUtils'
import { handleBulkAttnUpdate } from '@/lib/bulkAttendance'
import { CategoryModal } from './components/CategoryModal'
import PaywallModal from '@/components/PaywallModal'

// --- In-Memory Cache (Persists across page navigation within the same session) ---
const inMemoryStaffCache: Record<string, any> = {}

const DEFAULT_DISPLAY_PAGE_SIZE = 10

const getStoredUserData = () => {
  try {
    const raw = localStorage.getItem('userData')
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

const extractPhoneNumber = (email?: string | null) => {
  if (!email) return ''
  return email.replace(/^91/, '').split('@')[0]
}

const fetchUsers = async () => {
  const queryParams = {
    limit: -1,
    fields: [
      '*',
      'shift_id.shift_shift_id.*',
      'weekly_shifts.shift_id.*',
      'monthly_shifts.shift_id.*',
      'shift_ids.shift_shift_id.*',
      'other_category_ids.*',
      'supervisor_id.*',
      'employee_category_id.*',
    ],
  }

  const response: any = await rdk.request(
    customEndpoint({
      path: `users`,
      method: 'GET',
      params: queryParams,
    }),
  )
  return response?.data || response
}

const fetchAllShifts = async () => {
  const response: any = await rdk.request(readItems('shift'))
  return response?.data || response
}

export default function Staff() {
  const navigate = useNavigate()
  const { user, activeWorkspace } = useAuth()
  const { firstTabActive } = useShell()

  const storedUserData = useMemo(() => getStoredUserData(), [])

  // Safely resolve firm information identical to Staff.jsx
  const firmId = useMemo(() => {
    return (
      storedUserData?.firm_id?.firm_id ||
      (typeof storedUserData?.firm_id === 'string'
        ? storedUserData.firm_id
        : null) ||
      (typeof user?.firm_id === 'object'
        ? (user?.firm_id as any)?.firm_id
        : null) ||
      (typeof user?.firm_id === 'string' ? user.firm_id : null) ||
      activeWorkspace?.id
    )
  }, [storedUserData, user, activeWorkspace])

  const firmName = useMemo(() => {
    return (
      storedUserData?.firm_id?.firm_name ||
      (typeof user?.firm_id === 'object'
        ? (user?.firm_id as any)?.firm_name
        : null) ||
      user?.firm_name ||
      activeWorkspace?.name ||
      'RRV SOFTECH PVT LTD'
    )
  }, [storedUserData, user, activeWorkspace])

  const effectiveUserId = storedUserData?.id || user?.id

  const rawRole = storedUserData?.role || user?.role
  const isAdmin =
    isRoleAdmin(rawRole) ||
    user?.isSuperAdmin === true ||
    storedUserData?.is_admin === true ||
    user?.is_admin === true

  const isManager = isRoleManager(rawRole)

  const canViewManager =
    storedUserData?.can_view_manager ?? user?.can_view_manager ?? true

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const [selectedCategoryId, setSelectedCategoryId] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [datePopoverOpen, setDatePopoverOpen] = useState(false)

  // Helper inside initializer to safely compute date format
  const getInitialCache = () => {
    const today = new Date()
    const dd = String(today.getDate()).padStart(2, '0')
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const yyyy = today.getFullYear()
    const key = `${dd}-${mm}-${yyyy}_all`
    return inMemoryStaffCache[key]
  }

  const initialCached = getInitialCache()

  const [isFetching, setIsFetching] = useState(false)
  const [isLoading, setIsLoading] = useState(!initialCached)
  const [totalStaffCount, setTotalStaffCount] = useState<number>(
    initialCached ? initialCached.totalStaffCount : 0,
  )

  const [dailyResponse, setDailyResponse] = useState<any>(
    initialCached ? initialCached.dailyResponse : null,
  )
  const [allStaff, setAllStaff] = useState<any[]>(
    initialCached ? initialCached.allStaff : [],
  )
  const [allShiftsDetails, setAllShiftsDetails] = useState<any[]>([])
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [totalPeople, setTotalPeople] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('all_users_of_firm')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return []
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [displayLimit, setDisplayLimit] = useState(DEFAULT_DISPLAY_PAGE_SIZE)

  // Filter / Sort States
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  const [selectedRole, setSelectedRole] = useState<string>('all')
  const [sortKey, setSortKey] = useState<string>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Selection
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
  const [activeStaff, setActiveStaff] = useState<any | null>(null)

  // Modals
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editCategoryData, setEditCategoryData] = useState<any>(null)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkSelectionMode, setBulkSelectionMode] = useState<
    'individual' | 'range'
  >('individual')
  const [selectedBulkDates, setSelectedBulkDates] = useState<string[]>([])
  const [bulkDateRange, setBulkDateRange] = useState<{
    start: Date | null
    end: Date | null
  }>({
    start: null,
    end: null,
  })
  const [bulkStatus, setBulkStatus] = useState<string>('absent')
  const [bulkLoading, setBulkLoading] = useState(false)

  // Open Menu state for Toolbar menus
  const [openToolbarMenu, setOpenToolbarMenu] = useState<
    'filter' | 'sort' | null
  >(null)

  // Categories list
  const [categories, setCategories] = useState<any[]>([])
  const [employeeBirthdays, setEmployeeBirthdays] = useState<any[]>([])

  // Resizable columns
  const { colWidths, startResizing, isResizing } = useResizableColumns(
    {
      name: 180,
      designation: 140,
      phone: 130,
      department: 130,
      category: 160,
      attendance: 160,
      totalTime: 110,
    },
    { storageKey: 'staff_table_widths', minWidth: 70 },
  )

  const activeFetchId = useRef(0)

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery)
      setCurrentPage(1)
    }, 250)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Load all users & shifts
  useEffect(() => {
    if (!firmId) return

    const loadUsersAndShifts = async () => {
      try {
        const [usersRes, shiftsRes] = await Promise.all([
          fetchUsers(),
          fetchAllShifts(),
        ])
        setTotalPeople(usersRes || [])
        setAllShiftsDetails(shiftsRes || [])
        localStorage.setItem(
          'all_users_of_firm',
          JSON.stringify(usersRes || []),
        )
      } catch (err) {
        console.error('Error fetching users/shifts:', err)
      }
    }

    loadUsersAndShifts()
  }, [firmId])

  // Fetch Categories - Exactly as in Staff.jsx line 427
  const fetchCategories = useCallback(async () => {
    try {
      const response: any = await rdk.request(readItems('employee_category'))
      const catList = Array.isArray(response) ? response : response?.data || []
      setCategories(catList)
    } catch (err) {
      console.error('Error fetching categories:', err)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const formatDateForAPI = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, '0')
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const yyyy = date.getFullYear()
    return `${dd}-${mm}-${yyyy}`
  }

  // Fetch all staff attendance data - Exactly replicating Staff.jsx line 308-423
  const fetchAllStaffData = useCallback(async () => {
    if (!firmId) return

    activeFetchId.current += 1
    const currentFetchId = activeFetchId.current

    const formattedDate = formatDateForAPI(selectedDate)
    const cacheKey = `${formattedDate}_${selectedCategoryId ?? 'all'}`
    const cached = inMemoryStaffCache[cacheKey]

    if (cached) {
      setAllStaff(cached.allStaff)
      setDailyResponse(cached.dailyResponse)
      setTotalStaffCount(cached.totalStaffCount)
      setIsLoading(false)
    } else {
      // Retain existing staff in view while fetching so the table doesn't collapse to 0
      setIsLoading(allStaff.length === 0)
    }
    setIsFetching(true)

    try {
      // Role filter - matching Staff.jsx logic exactly via global helper
      const roleFilter = getPermittedRoleIdsForQuery({
        isAdmin,
        isManager,
        canViewManager,
      })

      // Category filter - matching Staff.jsx logic exactly, safely avoiding empty _in: []
      let categoryConditions: any[] = []
      if (
        selectedCategoryId !== null &&
        selectedCategoryId !== undefined &&
        selectedCategoryId !== ''
      ) {
        const finalCatId =
          typeof selectedCategoryId === 'string' &&
          !isNaN(Number(selectedCategoryId)) &&
          selectedCategoryId.trim() !== ''
            ? Number(selectedCategoryId)
            : selectedCategoryId
        categoryConditions = [{ employee_category_id: { _eq: finalCatId } }]
      } else if (isAdmin) {
        categoryConditions = []
      } else if (isManager && !storedUserData?.employee_category_id) {
        categoryConditions = []
      } else {
        const allowedCatIds = [
          storedUserData?.employee_category_id?.employee_category_id,
          ...(storedUserData?.other_category_ids?.map(
            (cat: any) => cat.employee_category_employee_category_id,
          ) || []),
        ].filter(Boolean)

        if (allowedCatIds.length > 0) {
          categoryConditions = [
            { employee_category_id: { _in: allowedCatIds } },
          ]
        }
      }

      const requestPayload = {
        firm_id: firmId,
        date: formattedDate,
        filter: {
          _and: [
            ...(effectiveUserId ? [{ id: { _neq: effectiveUserId } }] : []),
            {
              role: {
                _in: roleFilter,
              },
            },
            ...categoryConditions,
          ],
        },
        limit: 10000,
        fields: ['.*', 'shift_id.*'],
      }

      const response: any = await rdk.request(
        customEndpoint({
          path: `api/fast/staff_attendance_with_time_and_presence_new`,
          method: 'POST',
          body: JSON.stringify(requestPayload),
        }),
      )

      if (activeFetchId.current !== currentFetchId) return

      const resData = response?.data || response
      const employees = resData?.employees || []
      const totalCount = resData?.total || employees.length || 0

      setTotalStaffCount(totalCount)

      // Transform employees identically to Staff.jsx lines 377-395
      const transformedNewStaff = employees.map((staff: any) => ({
        id: staff.id,
        name:
          `${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim() ||
          'Unnamed',
        designation: staff.title || 'Employee',
        email:
          staff.employee_email_address ||
          (staff.email && !staff.email.includes('@hisaab.reev.group')
            ? staff.email
            : '') ||
          '-',
        phone:
          extractPhoneNumber(staff.email) ||
          staff.contact_number ||
          staff.phone ||
          '-',
        department: staff.department_name || staff.department || '-',
        category:
          staff.employee_category_id?.employee_category_name ||
          staff.category_name ||
          '—',
        subcategory: staff.subcategory_name || staff.sub_category_name || '—',
        raw_category_id: staff.employee_category_id?.employee_category_id
          ? String(staff.employee_category_id.employee_category_id)
          : '',
        status: staff?.id,
        start_date: staff.date_created,
        salary: staff.salary_per_month || '',
        avatar: staff.avatar ? `${API_URL}/assets/${staff.avatar}` : undefined,
        gender: staff.gender || '-',
        employee_no:
          staff.employee_serial_no ||
          staff.employee_code ||
          (staff.id ? String(staff.id).slice(0, 8) : '-'),
        employee_birthdate: staff.employee_birthdate || '',
        role: staff.role || '-',
        is_admin: staff.is_admin,
        emp_status: staff?.status,
        country: staff.country || 'IN',
        shift_id: staff.shift_id,
      }))

      setAllStaff(transformedNewStaff)
      setDailyResponse(resData)

      inMemoryStaffCache[cacheKey] = {
        allStaff: transformedNewStaff,
        dailyResponse: resData,
        totalStaffCount: totalCount,
      }
    } catch (err: any) {
      if (activeFetchId.current === currentFetchId) {
        console.error('Error fetching staff data:', err)
        toast.error('Failed to fetch staff attendance')
      }
    } finally {
      if (activeFetchId.current === currentFetchId) {
        setIsLoading(false)
        setIsFetching(false)
      }
    }
  }, [
    firmId,
    selectedDate,
    selectedCategoryId,
    isAdmin,
    isManager,
    canViewManager,
    effectiveUserId,
    storedUserData,
    allStaff.length,
  ])

  // Category tab selection: updates selectedCategoryId and lets useQuery fetch seamlessly
  const handleCategorySelect = useCallback(
    (catId: any) => {
      const isCurrentlySelected =
        selectedCategoryId !== null &&
        String(selectedCategoryId) === String(catId)

      const nextCatId = isCurrentlySelected || catId === null ? null : catId
      setSelectedCategoryId(nextCatId)
      setCurrentPage(1)
    },
    [selectedCategoryId],
  )

  // Single fetch entry-point: fires automatically when firmId, selectedDate, or selectedCategoryId changes, and every 60s
  useQuery({
    queryKey: ['staff-attendances', firmId, selectedDate, selectedCategoryId],
    queryFn: async () => {
      await fetchAllStaffData()
      return true
    },
    refetchOnWindowFocus: false,
    refetchInterval: 60 * 1000,
    enabled: !!firmId,
  })

  // Status map - matching Staff.jsx lines 273-294 and accommodating live employee attendance
  const statusMap = useMemo(() => {
    const map = new Map<string, any>()
    if (!dailyResponse) return map

    // 1. Process absentees array from backend if present
    if (Array.isArray(dailyResponse.absentees)) {
      dailyResponse.absentees.forEach((record: any) => {
        const empId = record.employee_id || record.id
        if (!empId) return
        const matched = allStaff.find((s) => s.id === empId)
        map.set(empId, {
          ...record,
          country: matched?.country || record.country || 'IN',
        })
      })
    }

    // 2. Process employees array from backend
    if (Array.isArray(dailyResponse.employees)) {
      dailyResponse.employees.forEach((emp: any) => {
        const empId = emp.id || emp.employee_id
        if (!empId) return

        const hasPunchIn = Boolean(emp.in_time || emp.attendance_data?.in_time)
        const isPresent = emp.status === 'present' || hasPunchIn

        if (isPresent) {
          const matched = allStaff.find((s) => s.id === empId)
          const inRec =
            emp.attendance_data?.in_time ||
            (emp.in_time
              ? typeof emp.in_time === 'object'
                ? emp.in_time
                : { timestamp: emp.in_time }
              : null)
          const outRec =
            emp.attendance_data?.out_time ||
            (emp.out_time
              ? typeof emp.out_time === 'object'
                ? emp.out_time
                : { timestamp: emp.out_time }
              : null)

          map.set(empId, {
            ...emp,
            status: 'present',
            country: matched?.country || emp.country || 'IN',
            attendance_data: {
              ...(emp.attendance_data || {}),
              in_time: inRec,
              out_time: outRec,
              late: emp.late ?? emp.attendance_data?.late ?? false,
              early_exit: emp.early ?? emp.attendance_data?.early_exit ?? false,
              total_work_duration:
                emp.total_work_duration ??
                emp.attendance_data?.total_work_duration ??
                0,
              entries: emp.attendance_data?.entries || [],
            },
          })
        } else if (!map.has(empId)) {
          const matched = allStaff.find((s) => s.id === empId)
          map.set(empId, {
            ...emp,
            status: 'not marked',
            country: matched?.country || emp.country || 'IN',
          })
        }
      })
    }

    return map
  }, [dailyResponse, allStaff])

  // Birthday calculation - matching Staff.jsx lines 609-635
  useEffect(() => {
    const today = new Date()
    const bdays = allStaff
      .filter((emp) => {
        if (emp.emp_status === 'archived' || !emp.employee_birthdate)
          return false
        const b = new Date(emp.employee_birthdate)
        if (isNaN(b.getTime())) return false
        return (
          b.getDate() === today.getDate() && b.getMonth() === today.getMonth()
        )
      })
      .map((emp) => {
        const b = new Date(emp.employee_birthdate)
        return {
          id: emp.id,
          name: emp.name,
          avatar: emp.avatar,
          age: today.getFullYear() - b.getFullYear(),
        }
      })

    setEmployeeBirthdays(bdays)
  }, [allStaff])

  // Inline Category Update Mutation - matching Staff.jsx lines 476-497
  const updateCategoryMutation = useMutation({
    mutationFn: async ({
      userId,
      newCategoryId,
    }: {
      userId: string
      newCategoryId: string | null
    }) => {
      const finalCategoryId =
        newCategoryId && String(newCategoryId).trim() !== ''
          ? newCategoryId
          : null
      return await rdk.request(
        customEndpoint({
          path: `users/${userId}`,
          method: 'PATCH',
          body: JSON.stringify({
            employee_category_id: finalCategoryId,
          }),
        }),
      )
    },
    onSuccess: () => {
      toast.success('Category updated successfully!')
      fetchAllStaffData()
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update category')
    },
  })

  const handleInlineCategoryChange = (
    userId: string,
    newCategoryId: string,
  ) => {
    const val = newCategoryId === 'none' ? null : newCategoryId
    updateCategoryMutation.mutate({ userId, newCategoryId: val })
  }

  // Summary Metrics Breakdown (Live Attendance)
  const presenceCount = useMemo(
    () =>
      allStaff.filter((emp) => statusMap.get(emp.id)?.status === 'present')
        .length,
    [allStaff, statusMap],
  )
  const absenceCount = useMemo(
    () =>
      allStaff.filter((emp) => statusMap.get(emp.id)?.status === 'absent')
        .length,
    [allStaff, statusMap],
  )
  const notMarkedCount = useMemo(
    () =>
      allStaff.filter(
        (emp) =>
          statusMap.get(emp.id)?.status === 'not marked' &&
          emp.emp_status !== 'archived',
      ).length,
    [allStaff, statusMap],
  )
  const lateCount = useMemo(
    () =>
      allStaff.filter(
        (emp) =>
          statusMap.get(emp.id)?.attendance_data?.late &&
          !statusMap.get(emp.id)?.attendance_data?.absent,
      ).length,
    [allStaff, statusMap],
  )
  const leaveCount = useMemo(
    () =>
      allStaff.filter((emp) => statusMap.get(emp.id)?.status === 'leave')
        .length,
    [allStaff, statusMap],
  )
  const earlyCount = useMemo(
    () =>
      allStaff.filter(
        (emp) =>
          statusMap.get(emp.id)?.attendance_data?.early_exit &&
          !statusMap.get(emp.id)?.attendance_data?.absent,
      ).length,
    [allStaff, statusMap],
  )

  // Workforce Role Metrics
  const adminCount = useMemo(
    () => allStaff.filter((emp) => emp.role === SYSTEM_ROLE_IDS.ADMIN).length,
    [allStaff],
  )
  const managerCount = useMemo(
    () => allStaff.filter((emp) => emp.role === SYSTEM_ROLE_IDS.MANAGER).length,
    [allStaff],
  )
  const employeeRoleCount = useMemo(
    () =>
      allStaff.filter((emp) => emp.role === SYSTEM_ROLE_IDS.EMPLOYEE).length,
    [allStaff],
  )
  const archivedCount = useMemo(
    () => allStaff.filter((emp) => emp.emp_status === 'archived').length,
    [allStaff],
  )

  const departmentOptions = useMemo(() => {
    const set = new Set<string>()
    allStaff.forEach((emp) => {
      if (emp.department && emp.department !== '-') set.add(emp.department)
    })
    return Array.from(set).sort()
  }, [allStaff])

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim()

    return allStaff.filter((emp) => {
      if (emp.emp_status === 'archived' && selectedStatus !== 'archived')
        return false

      const currentEmp = statusMap.get(emp.id)
      let attendanceStatus = currentEmp?.status || 'not marked'
      if (
        attendanceStatus !== 'absent' &&
        currentEmp?.attendance_data?.entries?.find((a: any) => a.TP === 'leave')
      ) {
        attendanceStatus = 'on_leave'
      }

      if (selectedStatus === 'late') {
        if (
          !currentEmp?.attendance_data?.late ||
          currentEmp?.attendance_data?.absent
        )
          return false
      } else if (selectedStatus === 'early') {
        if (
          !currentEmp?.attendance_data?.early_exit ||
          currentEmp?.attendance_data?.absent
        )
          return false
      } else if (selectedStatus === 'archived') {
        if (emp.emp_status !== 'archived') return false
      } else if (selectedStatus !== 'all') {
        if (
          selectedStatus === 'on_leave' &&
          attendanceStatus !== 'on_leave' &&
          attendanceStatus !== 'leave'
        ) {
          return false
        } else if (
          selectedStatus !== 'on_leave' &&
          attendanceStatus !== selectedStatus
        ) {
          return false
        }
      }

      if (selectedDepartment !== 'all' && emp.department !== selectedDepartment)
        return false
      if (selectedRole !== 'all' && emp.role !== selectedRole) return false

      if (q) {
        const text =
          `${emp.name} ${emp.employee_no} ${emp.phone} ${emp.department}`.toLowerCase()
        return text.includes(q)
      }
      return true
    })
  }, [
    allStaff,
    debouncedQuery,
    selectedStatus,
    selectedDepartment,
    selectedRole,
    statusMap,
  ])

  // Sorted staff list
  const sortedStaff = useMemo(() => {
    return [...filteredStaff].sort((a, b) => {
      let valA = ''
      let valB = ''

      if (sortKey === 'name') {
        valA = a.name
        valB = b.name
      } else if (sortKey === 'designation') {
        valA = a.designation
        valB = b.designation
      } else if (sortKey === 'department') {
        valA = a.department
        valB = b.department
      } else if (sortKey === 'category') {
        valA = a.category
        valB = b.category
      }

      valA = (valA || '').toLowerCase()
      valB = (valB || '').toLowerCase()

      if (valA < valB) return sortDir === 'asc' ? -1 : 1
      if (valA > valB) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredStaff, sortKey, sortDir])

  // Paginated staff
  const paginatedStaff = useMemo(() => {
    const start = (currentPage - 1) * displayLimit
    return sortedStaff.slice(start, start + displayLimit)
  }, [sortedStaff, currentPage, displayLimit])

  const totalPages = Math.max(1, Math.ceil(sortedStaff.length / displayLimit))

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStaffIds(filteredStaff.map((s) => s.id))
    } else {
      setSelectedStaffIds([])
    }
  }

  const handleToggleSelectOne = (id: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  // Bulk update date range generator
  const getDatesInRange = (start: Date, end: Date) => {
    const dates: string[] = []
    const current = new Date(start)
    const last = new Date(end)
    current.setHours(0, 0, 0, 0)
    last.setHours(0, 0, 0, 0)

    while (current <= last) {
      dates.push(formatDateForAPI(new Date(current)))
      current.setDate(current.getDate() + 1)
    }
    return dates
  }

  const handleBulkUpdate = async () => {
    const dates =
      bulkSelectionMode === 'individual'
        ? selectedBulkDates
        : bulkDateRange.start
          ? getDatesInRange(
              bulkDateRange.start,
              bulkDateRange.end || bulkDateRange.start,
            )
          : []

    if (dates.length === 0) {
      toast.error('Please select at least one date')
      return
    }

    setBulkModalOpen(false)
    setBulkLoading(true)

    try {
      await handleBulkAttnUpdate({
        dates,
        employeeIds: selectedStaffIds,
        status: bulkStatus,
        users: totalPeople,
        user: storedUserData || user,
        allShiftsDetails,
      })

      toast.success(
        `Bulk updated attendance for ${selectedStaffIds.length} staff`,
      )
      setSelectedStaffIds([])
      setSelectedBulkDates([])
      setBulkDateRange({ start: null, end: null })
      fetchAllStaffData()
    } catch (err: any) {
      console.error(err)
      toast.error('Failed to bulk update attendance')
    } finally {
      setBulkLoading(false)
    }
  }

  // Duration renderer - matching Staff.jsx line 525-542
  const renderWorkDuration = (employeeId: string) => {
    const emp = statusMap.get(employeeId)
    if (!emp) return <span className="text-muted-foreground">-</span>

    const totalWorkDuration = emp?.attendance_data?.total_work_duration
    if (
      !totalWorkDuration ||
      totalWorkDuration === 0 ||
      emp?.attendance_data?.out_time?.made_by === 'system'
    ) {
      return <span className="text-muted-foreground">-</span>
    }

    const hours = Math.floor(totalWorkDuration / 60)
    const minutes = Math.floor(totalWorkDuration % 60)

    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
        <Clock className="w-3.5 h-3.5 text-slate-500" />
        <span>
          {hours}h{' '}
          {minutes > 0 ? `${String(minutes).padStart(2, '0')}m` : '00m'}
        </span>
      </div>
    )
  }

  // Attendance status badge renderer - matching Staff.jsx lines 544-595
  const renderAttendanceDisplay = useCallback(
    (employeeId: string) => {
      const emp = statusMap.get(employeeId)
      if (!emp) {
        return (
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            No Data
          </span>
        )
      }

      const attendance = emp?.attendance_data || {}
      const inRecord = attendance?.in_time
      const outRecord = attendance?.out_time

      if (emp.status === 'absent') {
        if (attendance.early_exit) {
          return (
            <span className="inline-flex items-center rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
              Early & Absent
            </span>
          )
        }
        if (attendance.late) {
          return (
            <span className="inline-flex items-center rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
              Late & Absent
            </span>
          )
        }
        return (
          <span className="inline-flex items-center rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
            Absent
          </span>
        )
      }

      if (emp.status === 'leave') {
        return (
          <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
            On Leave
          </span>
        )
      }

      if (emp.status === 'holiday') {
        return (
          <span className="inline-flex items-center rounded-md bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-500/20">
            Holiday
          </span>
        )
      }

      if (emp.status === 'week_off') {
        return (
          <span className="inline-flex items-center rounded-md bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-500/20">
            Week Off
          </span>
        )
      }

      if (emp.status === 'present' && (inRecord || outRecord)) {
        return (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {inRecord && (
              <div className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                <span className="font-bold text-[10px] text-emerald-700 dark:text-emerald-300">
                  IN
                </span>
                <span>{formatTime(inRecord?.timestamp, emp?.country)}</span>
                {attendance.late && (
                  <span
                    title="Late Entry"
                    className="rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 px-1 text-[10px] font-bold"
                  >
                    L
                  </span>
                )}
              </div>
            )}
            {outRecord && outRecord?.made_by !== 'system' && (
              <div className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-medium">
                <span className="font-bold text-[10px] text-amber-700 dark:text-amber-300">
                  OUT
                </span>
                <span>{formatTime(outRecord?.timestamp, emp?.country)}</span>
                {attendance.early_exit && (
                  <span
                    title="Early Exit"
                    className="rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 px-1 text-[10px] font-bold"
                  >
                    E
                  </span>
                )}
              </div>
            )}
          </div>
        )
      }

      if (emp.status === 'not marked') {
        return (
          <span className="inline-flex items-center rounded-md bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-500/20">
            Not Marked
          </span>
        )
      }

      return (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          No Data
        </span>
      )
    },
    [statusMap],
  )

  const isToday = selectedDate.toDateString() === new Date().toDateString()
  const ghostBtn =
    'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      {/* Center Main Panel */}
      <Panel
        className={cn(
          'flex min-w-0 flex-1 flex-col h-full overflow-hidden',
          firstTabActive && 'rounded-tl-none',
        )}
      >
        {/* 1. Header Banner & Live Overview */}
        <div className="border-b border-border p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-sm shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                {greeting}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <span>Here's the attendance status of employees at</span>
              <span className="font-semibold text-foreground flex items-center gap-1">
                <Building2 className="size-3.5 text-primary shrink-0" />
                {firmName}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Live Date Picker Popover */}
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs"
                >
                  <CalendarIcon className="size-3.5 text-muted-foreground" />
                  <span>
                    {isToday
                      ? `Today · ${selectedDate.toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}`
                      : selectedDate.toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => {
                    if (d) {
                      setSelectedDate(d)
                      setCurrentPage(1)
                      setDatePopoverOpen(false)
                    }
                  }}
                  autoFocus
                />
              </PopoverContent>
            </Popover>

            {/* Live Map Link */}
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/admin/tracking')}
                className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
              >
                <MapPin className="size-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Live View</span>
              </Button>
            )}

            {/* Add Employee Button */}
            <Button
              size="sm"
              onClick={() => {
                const employeeLimit =
                  storedUserData?.firm_id?.firm_employee_limit ??
                  (typeof user?.firm_id === 'object'
                    ? (user?.firm_id as any)?.firm_employee_limit
                    : null) ??
                  (user as any)?.firm_employee_limit

                if (
                  employeeLimit !== undefined &&
                  employeeLimit !== null &&
                  totalPeople &&
                  totalPeople.length >= Number(employeeLimit)
                ) {
                  setPaywallOpen(true)
                } else {
                  navigate('/admin/staff/new')
                }
              }}
              className="h-8 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
            >
              <UserPlus className="size-3.5" />
              <span>Add Employee</span>
            </Button>
          </div>
        </div>

        {/* Scrollable Wrapper for Attendance Statistics & Content Below */}
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          {/* 2. Attendance Statistics Hub (Exact metrics from v1 with modern aesthetic) */}
          <div className="border-b border-border bg-muted/20 p-4 shrink-0">
            <div className="rounded-xl border border-border bg-card/80 p-3.5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Attendance Statistics
                  </span>
                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    {isToday
                      ? 'Today'
                      : selectedDate.toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                  </span>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  Presence Rate:{' '}
                  <strong className="font-semibold text-foreground">
                    {totalStaffCount > 0
                      ? `${Math.round((presenceCount / totalStaffCount) * 100)}%`
                      : '0%'}
                  </strong>
                </span>
              </div>

              {/* Top Row: Attendance Status Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {/* Present */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatus(
                      selectedStatus === 'present' ? 'all' : 'present',
                    )
                    setCurrentPage(1)
                  }}
                  className={cn(
                    'flex flex-col rounded-lg border p-2.5 text-left transition-all cursor-pointer',
                    selectedStatus === 'present'
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500'
                      : 'border-border bg-card hover:border-emerald-500/40 hover:bg-emerald-500/5',
                  )}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    <span>PRESENT</span>
                    <UserCheck className="size-3.5" />
                  </div>
                  <span className="text-xl font-bold tracking-tight text-foreground mt-1">
                    {presenceCount}
                  </span>
                </button>

                {/* Absent */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatus(
                      selectedStatus === 'absent' ? 'all' : 'absent',
                    )
                    setCurrentPage(1)
                  }}
                  className={cn(
                    'flex flex-col rounded-lg border p-2.5 text-left transition-all cursor-pointer',
                    selectedStatus === 'absent'
                      ? 'border-rose-500 bg-rose-500/10 shadow-xs ring-1 ring-rose-500'
                      : 'border-border bg-card hover:border-rose-500/40 hover:bg-rose-500/5',
                  )}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                    <span>ABSENT</span>
                    <UserX className="size-3.5" />
                  </div>
                  <span className="text-xl font-bold tracking-tight text-foreground mt-1">
                    {absenceCount}
                  </span>
                </button>

                {/* Not Marked */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatus(
                      selectedStatus === 'not marked' ? 'all' : 'not marked',
                    )
                    setCurrentPage(1)
                  }}
                  className={cn(
                    'flex flex-col rounded-lg border p-2.5 text-left transition-all cursor-pointer',
                    selectedStatus === 'not marked'
                      ? 'border-slate-500 bg-slate-500/10 shadow-xs ring-1 ring-slate-500'
                      : 'border-border bg-card hover:border-slate-500/40 hover:bg-slate-500/5',
                  )}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-400">
                    <span>NOT MARKED</span>
                    <Clock className="size-3.5" />
                  </div>
                  <span className="text-xl font-bold tracking-tight text-foreground mt-1">
                    {notMarkedCount}
                  </span>
                </button>

                {/* Late */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatus(
                      selectedStatus === 'late' ? 'all' : 'late',
                    )
                    setCurrentPage(1)
                  }}
                  className={cn(
                    'flex flex-col rounded-lg border p-2.5 text-left transition-all cursor-pointer',
                    selectedStatus === 'late'
                      ? 'border-amber-500 bg-amber-500/10 shadow-xs ring-1 ring-amber-500'
                      : 'border-border bg-card hover:border-amber-500/40 hover:bg-amber-500/5',
                  )}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    <span>LATE</span>
                    <Clock className="size-3.5" />
                  </div>
                  <span className="text-xl font-bold tracking-tight text-foreground mt-1">
                    {lateCount}
                  </span>
                </button>

                {/* Leave */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatus(
                      selectedStatus === 'on_leave' ? 'all' : 'on_leave',
                    )
                    setCurrentPage(1)
                  }}
                  className={cn(
                    'flex flex-col rounded-lg border p-2.5 text-left transition-all cursor-pointer',
                    selectedStatus === 'on_leave'
                      ? 'border-orange-600 bg-orange-600/10 shadow-xs ring-1 ring-orange-600'
                      : 'border-border bg-card hover:border-orange-600/40 hover:bg-orange-600/5',
                  )}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-orange-700 dark:text-orange-400">
                    <span>LEAVE</span>
                    <CalendarDays className="size-3.5" />
                  </div>
                  <span className="text-xl font-bold tracking-tight text-foreground mt-1">
                    {leaveCount}
                  </span>
                </button>

                {/* Early Exit */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatus(
                      selectedStatus === 'early' ? 'all' : 'early',
                    )
                    setCurrentPage(1)
                  }}
                  className={cn(
                    'flex flex-col rounded-lg border p-2.5 text-left transition-all cursor-pointer',
                    selectedStatus === 'early'
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-xs ring-1 ring-indigo-500'
                      : 'border-border bg-card hover:border-indigo-500/40 hover:bg-indigo-500/5',
                  )}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-700 dark:text-indigo-400">
                    <span>EARLY</span>
                    <Clock className="size-3.5" />
                  </div>
                  <span className="text-xl font-bold tracking-tight text-foreground mt-1">
                    {earlyCount}
                  </span>
                </button>
              </div>

              {/* Bottom Row: Headcount & Role Breakdown */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatus('all')
                    setSelectedRole('all')
                    setCurrentPage(1)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <Users className="size-3.5 text-primary" />
                  <span>TOTAL HEADS:</span>
                  <strong className="font-semibold text-foreground">
                    {totalStaffCount}
                  </strong>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole(SYSTEM_ROLE_IDS.ADMIN)
                    setCurrentPage(1)
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 transition-colors cursor-pointer',
                    selectedRole === SYSTEM_ROLE_IDS.ADMIN
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  <ShieldCheck className="size-3.5" />
                  <span>ADMIN:</span>
                  <strong className="font-semibold">{adminCount}</strong>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole(SYSTEM_ROLE_IDS.MANAGER)
                    setCurrentPage(1)
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 transition-colors cursor-pointer',
                    selectedRole === SYSTEM_ROLE_IDS.MANAGER
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Briefcase className="size-3.5" />
                  <span>MANAGER:</span>
                  <strong className="font-semibold">{managerCount}</strong>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole(SYSTEM_ROLE_IDS.EMPLOYEE)
                    setCurrentPage(1)
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 transition-colors cursor-pointer',
                    selectedRole === SYSTEM_ROLE_IDS.EMPLOYEE
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Users className="size-3.5" />
                  <span>EMPLOYEE:</span>
                  <strong className="font-semibold">{employeeRoleCount}</strong>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatus('archived')
                    setCurrentPage(1)
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 transition-colors cursor-pointer',
                    selectedStatus === 'archived'
                      ? 'border-rose-500 bg-rose-500/10 text-rose-600 font-semibold'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  <UserMinus className="size-3.5" />
                  <span>ARCHIVED:</span>
                  <strong className="font-semibold">{archivedCount}</strong>
                </button>
              </div>
            </div>
          </div>

          {/* 3. Birthday Celebration Strip (if any) */}
          {employeeBirthdays.length > 0 && (
            <div className="flex items-center justify-between border-b border-pink-200/50 bg-pink-50/50 dark:bg-pink-950/20 px-4 py-2 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <Cake className="size-4 text-pink-600 animate-bounce" />
                <span className="font-semibold text-pink-900 dark:text-pink-300">
                  Birthdays Today:
                </span>
                <div className="flex items-center gap-2">
                  {employeeBirthdays.map((b) => (
                    <span
                      key={b.id}
                      className="font-medium text-pink-800 dark:text-pink-200"
                    >
                      {b.name} (turns {b.age})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. Category Filter Strip (Horizontal pills) */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-3 py-2 bg-muted/20 scrollbar-none shrink-0">
              <button
                type="button"
                onClick={() => handleCategorySelect(null)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer border shrink-0',
                  selectedCategoryId === null
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/80',
                )}
              >
                <Layers className="size-3.5" />
                <span>All</span>
              </button>

              {categories.map((cat: any) => {
                const isSelected =
                  selectedCategoryId !== null &&
                  String(selectedCategoryId) ===
                    String(cat.employee_category_id)
                const count =
                  totalPeople.length > 0
                    ? totalPeople.filter((u: any) => {
                        const rawCat = u.employee_category_id
                        const userCatId =
                          typeof rawCat === 'object' && rawCat !== null
                            ? rawCat.employee_category_id
                            : rawCat
                        return (
                          String(userCatId) === String(cat.employee_category_id)
                        )
                      }).length
                    : allStaff.filter(
                        (s: any) =>
                          String(s.raw_category_id) ===
                          String(cat.employee_category_id),
                      ).length

                return (
                  <button
                    key={cat.employee_category_id}
                    type="button"
                    onClick={() =>
                      handleCategorySelect(cat.employee_category_id)
                    }
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer border shrink-0',
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/80',
                    )}
                  >
                    <Tag className="size-3.5" />
                    <span>{cat.employee_category_name}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                        isSelected
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setEditCategoryData(null)
                    setCategoryModalOpen(true)
                  }}
                  className="flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer shrink-0"
                >
                  <Plus className="size-3" />
                  <span>New category</span>
                </button>
              )}
            </div>
          )}

          {/* 5. Minimalist Unified Table Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 bg-card shrink-0">
            {selectedStaffIds.length > 0 ? (
              /* Bulk selection toolbar */
              <div className="flex items-center gap-2 w-full">
                <button
                  onClick={() => setSelectedStaffIds([])}
                  className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Clear selection"
                >
                  <X className="size-3.5" />
                </button>
                <span className="text-[13px] font-medium text-primary">
                  {selectedStaffIds.length} staff selected
                </span>

                <div className="ml-auto flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setBulkModalOpen(true)}
                    className="h-7 text-xs gap-1.5 cursor-pointer"
                  >
                    <SlidersHorizontal className="size-3.5" />
                    Update Bulk Attendance
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedStaffIds([])}
                    className="h-7 text-xs cursor-pointer"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            ) : (
              /* Normal toolbar */
              <>
                {/* Left View indicator */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {selectedStatus === 'all'
                      ? 'All'
                      : selectedStatus.charAt(0).toUpperCase() +
                        selectedStatus.slice(1)}{' '}
                    &middot; {filteredStaff.length}
                  </span>
                  {isFetching && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Loader2 className="size-3 animate-spin text-primary" />
                      <span>Syncing...</span>
                    </span>
                  )}
                </div>

                {/* Center / Right controls */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search staff..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-7 w-40 sm:w-56 pl-8 text-xs bg-muted/30 focus-visible:bg-background"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>

                  {/* Filter Menu */}
                  <Menu
                    open={openToolbarMenu === 'filter'}
                    onOpenChange={(o) =>
                      setOpenToolbarMenu(o ? 'filter' : null)
                    }
                    trigger={
                      <button
                        className={cn(
                          ghostBtn,
                          (selectedDepartment !== 'all' ||
                            selectedRole !== 'all') &&
                            'text-primary font-semibold',
                        )}
                      >
                        <Filter className="size-3.5" />
                        <span>Filter</span>
                        {(selectedDepartment !== 'all' ||
                          selectedRole !== 'all') && (
                          <span className="size-1.5 rounded-full bg-primary" />
                        )}
                      </button>
                    }
                  >
                    <div className="p-1 space-y-1 text-xs min-w-44">
                      <div className="px-2 py-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        Department
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDepartment('all')
                          setOpenToolbarMenu(null)
                        }}
                        className={cn(
                          'w-full text-left px-2 py-1 rounded-md transition-colors cursor-pointer',
                          selectedDepartment === 'all'
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'hover:bg-muted text-foreground',
                        )}
                      >
                        All Departments
                      </button>
                      {departmentOptions.map((dep) => (
                        <button
                          key={dep}
                          type="button"
                          onClick={() => {
                            setSelectedDepartment(dep)
                            setOpenToolbarMenu(null)
                          }}
                          className={cn(
                            'w-full text-left px-2 py-1 rounded-md transition-colors cursor-pointer truncate',
                            selectedDepartment === dep
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'hover:bg-muted text-foreground',
                          )}
                        >
                          {dep}
                        </button>
                      ))}
                      <div className="border-t border-border my-1" />
                      <div className="px-2 py-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        Role
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRole('all')
                          setOpenToolbarMenu(null)
                        }}
                        className={cn(
                          'w-full text-left px-2 py-1 rounded-md transition-colors cursor-pointer',
                          selectedRole === 'all'
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'hover:bg-muted text-foreground',
                        )}
                      >
                        All Roles
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRole(SYSTEM_ROLE_IDS.ADMIN)
                          setOpenToolbarMenu(null)
                        }}
                        className={cn(
                          'w-full text-left px-2 py-1 rounded-md transition-colors cursor-pointer',
                          selectedRole === SYSTEM_ROLE_IDS.ADMIN
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'hover:bg-muted text-foreground',
                        )}
                      >
                        Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRole(SYSTEM_ROLE_IDS.MANAGER)
                          setOpenToolbarMenu(null)
                        }}
                        className={cn(
                          'w-full text-left px-2 py-1 rounded-md transition-colors cursor-pointer',
                          selectedRole === SYSTEM_ROLE_IDS.MANAGER
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'hover:bg-muted text-foreground',
                        )}
                      >
                        Manager
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRole(SYSTEM_ROLE_IDS.EMPLOYEE)
                          setOpenToolbarMenu(null)
                        }}
                        className={cn(
                          'w-full text-left px-2 py-1 rounded-md transition-colors cursor-pointer',
                          selectedRole === SYSTEM_ROLE_IDS.EMPLOYEE
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'hover:bg-muted text-foreground',
                        )}
                      >
                        Employee
                      </button>
                    </div>
                  </Menu>

                  {/* Sort Menu */}
                  <Menu
                    open={openToolbarMenu === 'sort'}
                    onOpenChange={(o) => setOpenToolbarMenu(o ? 'sort' : null)}
                    trigger={
                      <button className={ghostBtn}>
                        <ArrowUpDown className="size-3.5" />
                        <span>Sort</span>
                      </button>
                    }
                  >
                    <div className="p-1 space-y-1 text-xs min-w-44">
                      {[
                        { key: 'name', dir: 'asc', label: 'Name (A-Z)' },
                        { key: 'name', dir: 'desc', label: 'Name (Z-A)' },
                        {
                          key: 'designation',
                          dir: 'asc',
                          label: 'Designation (A-Z)',
                        },
                        {
                          key: 'designation',
                          dir: 'desc',
                          label: 'Designation (Z-A)',
                        },
                        {
                          key: 'department',
                          dir: 'asc',
                          label: 'Department (A-Z)',
                        },
                        {
                          key: 'category',
                          dir: 'asc',
                          label: 'Category (A-Z)',
                        },
                      ].map((opt) => (
                        <button
                          key={`${opt.key}-${opt.dir}`}
                          type="button"
                          onClick={() => {
                            setSortKey(opt.key)
                            setSortDir(opt.dir as 'asc' | 'desc')
                            setOpenToolbarMenu(null)
                          }}
                          className={cn(
                            'w-full text-left px-2 py-1 rounded-md transition-colors cursor-pointer',
                            sortKey === opt.key && sortDir === opt.dir
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'hover:bg-muted text-foreground',
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </Menu>

                  {/* Export / Quick Refresh */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => fetchAllStaffData()}
                    className="size-7 cursor-pointer"
                    title="Refresh Data"
                  >
                    <Loader2
                      className={cn(
                        'size-3.5',
                        isFetching && 'animate-spin text-primary',
                      )}
                    />
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* 6. Main Staff & Attendance Table */}
          <div className="flex-1 overflow-x-auto min-h-[350px]">
            <table className="w-full border-separate border-spacing-0 text-left text-xs">
              <thead className="sticky top-0 z-20 bg-card shadow-2xs">
                <tr className="text-muted-foreground font-semibold">
                  <th className="sticky left-0 top-0 z-30 bg-card py-2.5 px-3 w-10 text-center border-t border-b border-l border-r border-gray-200 dark:border-border shadow-[1px_0_0_0_rgba(0,0,0,0.06)]">
                    <Checkbox
                      checked={
                        filteredStaff.length > 0 &&
                        selectedStaffIds.length === filteredStaff.length
                      }
                      onCheckedChange={(checked) =>
                        handleSelectAll(Boolean(checked))
                      }
                    />
                  </th>
                  <th
                    style={{ width: colWidths.name, minWidth: colWidths.name }}
                    className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border"
                  >
                    <span className="pr-2">NAME</span>
                    <ColumnResizer
                      isResizing={isResizing === 'name'}
                      onMouseDown={(e) => startResizing('name', e)}
                    />
                  </th>
                  <th
                    style={{
                      width: colWidths.designation,
                      minWidth: colWidths.designation,
                    }}
                    className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border"
                  >
                    <span className="pr-2">DESIGNATION</span>
                    <ColumnResizer
                      isResizing={isResizing === 'designation'}
                      onMouseDown={(e) => startResizing('designation', e)}
                    />
                  </th>
                  <th
                    style={{
                      width: colWidths.phone,
                      minWidth: colWidths.phone,
                    }}
                    className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border"
                  >
                    <span className="pr-2">PHONE</span>
                    <ColumnResizer
                      isResizing={isResizing === 'phone'}
                      onMouseDown={(e) => startResizing('phone', e)}
                    />
                  </th>
                  <th
                    style={{
                      width: colWidths.department,
                      minWidth: colWidths.department,
                    }}
                    className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border"
                  >
                    <span className="pr-2">DEPARTMENT</span>
                    <ColumnResizer
                      isResizing={isResizing === 'department'}
                      onMouseDown={(e) => startResizing('department', e)}
                    />
                  </th>
                  <th
                    style={{
                      width: colWidths.category,
                      minWidth: colWidths.category,
                    }}
                    className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border"
                  >
                    <span className="pr-2">CATEGORY</span>
                    <ColumnResizer
                      isResizing={isResizing === 'category'}
                      onMouseDown={(e) => startResizing('category', e)}
                    />
                  </th>
                  <th
                    style={{
                      width: colWidths.attendance,
                      minWidth: colWidths.attendance,
                    }}
                    className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border"
                  >
                    <span className="pr-2">ATTENDANCE</span>
                    <ColumnResizer
                      isResizing={isResizing === 'attendance'}
                      onMouseDown={(e) => startResizing('attendance', e)}
                    />
                  </th>
                  <th
                    style={{
                      width: colWidths.totalTime,
                      minWidth: colWidths.totalTime,
                    }}
                    className="py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border"
                  >
                    TOTAL TIME
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && paginatedStaff.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-16 text-center text-muted-foreground border-b border-l border-r border-gray-200 dark:border-border"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="size-6 animate-spin text-primary" />
                        <p className="text-sm font-medium">
                          Loading attendance data...
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedStaff.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-16 text-center text-muted-foreground border-b border-l border-r border-gray-200 dark:border-border"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users className="size-8 text-muted-foreground/40" />
                        <p className="text-sm font-medium">
                          No staff members found.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Try adjusting your search query, status filters, or
                          selected category.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedStaff.map((emp) => {
                    const isSelected = selectedStaffIds.includes(emp.id)
                    const isActive = activeStaff?.id === emp.id
                    const isUpdatingCat =
                      updateCategoryMutation.isPending &&
                      updateCategoryMutation.variables?.userId === emp.id

                    return (
                      <tr
                        key={emp.id}
                        onClick={() => setActiveStaff(emp)}
                        className={cn(
                          'group transition-colors cursor-pointer hover:bg-muted/40',
                          isSelected && 'bg-primary/5',
                          isActive && 'bg-muted/60',
                        )}
                      >
                        {/* Checkbox (Fixed to Left) */}
                        <td
                          className={cn(
                            'sticky left-0 z-10 py-2.5 px-3 text-center border-b border-l border-r border-gray-200 dark:border-border transition-colors shadow-[1px_0_0_0_rgba(0,0,0,0.06)]',
                            isSelected
                              ? 'bg-primary/5'
                              : isActive
                                ? 'bg-muted/60'
                                : 'bg-card group-hover:bg-muted/40',
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleSelectOne(emp.id)
                          }}
                        >
                          <Checkbox checked={isSelected} />
                        </td>

                        {/* Employee Avatar + Name */}
                        <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                          <div className="flex items-center gap-2.5">
                            {emp.avatar ? (
                              <img
                                src={emp.avatar}
                                alt={emp.name}
                                className="size-7 rounded-full object-cover shrink-0 border border-border"
                                onError={(e) => {
                                  ;(e.target as HTMLElement).style.display =
                                    'none'
                                }}
                              />
                            ) : (
                              <EmployeeAvatar
                                employeeId={emp.id}
                                name={emp.name}
                                className="size-7 shrink-0 text-xs"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">
                                {emp.name}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Designation */}
                        <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border text-muted-foreground font-medium">
                          {emp.designation || '-'}
                        </td>

                        {/* Phone */}
                        <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                          {emp.phone ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigator.clipboard.writeText(emp.phone)
                                toast.success(`Copied: ${emp.phone}`)
                              }}
                              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground cursor-pointer group/copy"
                              title="Click to copy"
                            >
                              <span>{emp.phone}</span>
                              <Copy className="size-3 opacity-0 group-hover/copy:opacity-100 transition-opacity" />
                            </button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>

                        {/* Department */}
                        <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border text-muted-foreground">
                          {emp.department}
                        </td>

                        {/* Category Dropdown */}
                        <td
                          className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1.5">
                            <Select
                              value={emp.raw_category_id || 'none'}
                              onValueChange={(val) =>
                                handleInlineCategoryChange(emp.id, val)
                              }
                              disabled={isUpdatingCat}
                            >
                              <SelectTrigger className="h-7 text-xs w-32 bg-background border-border hover:border-primary/50 shadow-2xs">
                                <SelectValue placeholder="Select Category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  Select Category
                                </SelectItem>
                                {categories.map((cat: any) => (
                                  <SelectItem
                                    key={cat.employee_category_id}
                                    value={String(cat.employee_category_id)}
                                  >
                                    {cat.employee_category_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {isUpdatingCat && (
                              <Loader2 className="size-3 animate-spin text-muted-foreground shrink-0" />
                            )}
                          </div>
                        </td>

                        {/* Attendance Display (IN/OUT Chips or Absent/Leave/Not Marked Badge) */}
                        <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                          {renderAttendanceDisplay(emp.id)}
                        </td>

                        {/* Total Time */}
                        <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                          {renderWorkDuration(emp.id)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 7. Minimalist Pagination Bar */}
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground bg-card shadow-2xs shrink-0">
            <div className="flex items-center gap-1.5">
              <span>Show</span>
              <Select
                value={String(displayLimit)}
                onValueChange={(val) => {
                  setDisplayLimit(Number(val))
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
              <span>per page &middot; {sortedStaff.length} staff</span>
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
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  <ChevronRight className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* 8. Slide-Over Attendance Preview Panel (Detail Drawer) */}
      {activeStaff && (
        <Panel className="flex w-80 shrink-0 flex-col animate-in fade-in slide-in-from-right-4 duration-200">
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2.5">
                <EmployeeAvatar
                  employeeId={activeStaff.id}
                  name={activeStaff.name}
                  className="size-9 text-xs"
                />
                <div>
                  <h3 className="font-semibold text-foreground text-sm">
                    {activeStaff.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {activeStaff.designation}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActiveStaff(null)}
                className="size-7 cursor-pointer"
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 space-y-4 text-xs">
              {/* Status Banner */}
              <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-muted-foreground">
                    Status:
                  </span>
                  {renderAttendanceDisplay(activeStaff.id)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-muted-foreground">
                    Work Duration:
                  </span>
                  {renderWorkDuration(activeStaff.id)}
                </div>
              </div>

              {/* Punch Logs Timeline */}
              <div>
                <h4 className="font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Clock className="size-3.5 text-primary" />
                  <span>Punch Activity</span>
                </h4>
                {(() => {
                  const emp = statusMap.get(activeStaff.id)
                  const entries = emp?.attendance_data?.entries || []
                  if (entries.length === 0) {
                    return (
                      <p className="text-muted-foreground italic">
                        No punch entries recorded.
                      </p>
                    )
                  }
                  return (
                    <div className="space-y-2 border-l-2 border-border pl-3 ml-1.5">
                      {entries.map((entry: any, idx: number) => {
                        const isPunchIn = entry.in_time || entry.TP === 'in'
                        return (
                          <div key={idx} className="relative">
                            <span
                              className={cn(
                                'absolute -left-[17px] top-1 size-2 rounded-full',
                                isPunchIn ? 'bg-emerald-500' : 'bg-amber-500',
                              )}
                            />
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground">
                                {isPunchIn ? 'Punch In' : 'Punch Out'}
                              </span>
                              <span className="text-muted-foreground">
                                {formatTime(
                                  entry.timestamp || entry.time,
                                  emp?.country,
                                )}
                              </span>
                            </div>
                            {entry.location_name && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {entry.location_name}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>

              {/* Employee Details */}
              <div className="space-y-2 pt-2 border-t border-border">
                <h4 className="font-semibold text-foreground">Details</h4>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground/80">
                      Phone
                    </span>
                    <span className="text-foreground">
                      {activeStaff.phone || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground/80">
                      Department
                    </span>
                    <span className="text-foreground">
                      {activeStaff.department || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground/80">
                      Category
                    </span>
                    <span className="text-foreground">
                      {activeStaff.category || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground/80">
                      Emp ID
                    </span>
                    <span className="text-foreground">
                      {activeStaff.employee_no || '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border p-3 flex gap-2">
              <Button
                variant="outline"
                className="flex-1 text-xs cursor-pointer"
                onClick={() => navigate(`/admin/staff/${activeStaff.id}`)}
              >
                Full Profile
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {/* 9. Bulk Attendance Sheet */}
      <Sheet open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col bg-background">
          <div className="p-5 border-b border-border bg-muted/20">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Update Attendance in Bulk
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Updating attendance for{' '}
              <strong className="text-foreground">
                {selectedStaffIds.length}
              </strong>{' '}
              selected staff members.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
            {/* Selection Mode Toggle */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">
                Date Selection Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBulkSelectionMode('individual')}
                  className={cn(
                    'rounded-lg border p-2 text-center font-medium transition-all cursor-pointer',
                    bulkSelectionMode === 'individual'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  Individual Dates
                </button>
                <button
                  type="button"
                  onClick={() => setBulkSelectionMode('range')}
                  className={cn(
                    'rounded-lg border p-2 text-center font-medium transition-all cursor-pointer',
                    bulkSelectionMode === 'range'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  Date Range
                </button>
              </div>
            </div>

            {/* Date Pickers */}
            {bulkSelectionMode === 'individual' ? (
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Pick Dates ({selectedBulkDates.length} selected)
                </label>
                <div className="rounded-lg border border-border p-2 flex justify-center">
                  <Calendar
                    mode="multiple"
                    selected={selectedBulkDates.map((d) => {
                      const [day, m, y] = d.split('-')
                      return new Date(Number(y), Number(m) - 1, Number(day))
                    })}
                    onSelect={(dates) => {
                      if (dates) {
                        setSelectedBulkDates(
                          dates.map((d) => formatDateForAPI(d)),
                        )
                      }
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Select Range
                </label>
                <div className="rounded-lg border border-border p-2 flex justify-center">
                  <Calendar
                    mode="range"
                    selected={{
                      from: bulkDateRange.start || undefined,
                      to: bulkDateRange.end || undefined,
                    }}
                    onSelect={(range) => {
                      setBulkDateRange({
                        start: range?.from || null,
                        end: range?.to || null,
                      })
                    }}
                  />
                </div>
              </div>
            )}

            {/* Target Status Select */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">
                Status to Apply
              </label>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="present">
                    Present (Default Shift Time)
                  </SelectItem>
                  <SelectItem value="leave">Approved Leave</SelectItem>
                  <SelectItem value="week_off">Week Off</SelectItem>
                  <SelectItem value="holiday">Holiday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkModalOpen(false)}
              disabled={bulkLoading}
              className="h-8 text-xs cursor-pointer px-3"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleBulkUpdate}
              disabled={bulkLoading}
              className="h-8 text-xs font-semibold cursor-pointer gap-1.5 px-3"
            >
              {bulkLoading && (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              )}
              Apply Bulk Attendance
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* 10. Category Add / Edit Modal */}
      <CategoryModal
        open={categoryModalOpen}
        onOpenChange={setCategoryModalOpen}
        initialEditData={editCategoryData}
        onSuccess={() => {
          fetchCategories()
          fetchAllStaffData()
        }}
      />

      <PaywallModal isOpen={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </div>
  )
}
