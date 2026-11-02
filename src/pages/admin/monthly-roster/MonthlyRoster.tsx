// @ts-nocheck
import React, { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Panel from '@/components/admin/Panel'
import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
import rdk, { customEndpoint, readItems } from '@/services/server'
import { cn } from '@/lib/utils'

// Roster modular components
import { RosterHeader } from './components/RosterHeader'
import { RosterFilters } from './components/RosterFilters'
import { RosterTable } from './components/RosterTable'
import { RosterPagination } from './components/RosterPagination'
import { BulkShiftUpdateModal } from './components/BulkShiftUpdateModal'
import { RosterReportModal } from './components/RosterReportModal'
import { ExcelImportModal } from './components/ExcelImportModal'

// Utilities matching 100% of V1 logic
import { downloadRoasterExcel } from './utils/downloadRoasterExcel'
import { downloadRoasterExcelByDateRange } from './utils/downloadRoasterExcelByDateRange'
import { handleExcelImportPayload } from './utils/handleExcelImport'
import { mergeEmployeeMonthlyShifts } from './utils/rosterMergeUtils'
import type { RosterUser, Shift, EmployeeCategory, RosterModalMode } from './types'

export const MonthlyRoster: React.FC = () => {
  const { firstTabActive } = useShell()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const currentYear = new Date().getFullYear()
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString())
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [page, setPage] = useState<number>(1)
  const [itemPerPage, setItemPerPage] = useState<number>(10)

  const [queryValue, setQueryValue] = useState<string>('')
  const [sortSelected, setSortSelected] = useState<string>('name asc')
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])
  const [selectedDesignations, setSelectedDesignations] = useState<string[]>([])
  const [selectedFilterCategories, setSelectedFilterCategories] = useState<string[]>([])

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [modalMode, setModalMode] = useState<RosterModalMode>(null)

  // Cell click prefill states
  const [cellPrefillCategories, setCellPrefillCategories] = useState<string[]>([])
  const [cellPrefillEmployees, setCellPrefillEmployees] = useState<string[]>([])
  const [cellPrefillShifts, setCellPrefillShifts] = useState<string[]>([])
  const [cellPrefillDateRange, setCellPrefillDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(),
    end: new Date(),
  })
  const [cellPrefillMode, setCellPrefillMode] = useState<'single' | 'range' | 'multiple'>('single')

  // --- ROLE & CATEGORY LOGIC (Exact V1) ---
  const TARGET_ROLE_ID = '8734320f-991f-479f-bba8-9d4af261856e'
  const ADMIN_ROLE_ID = 'bb64d3fd-5fde-4493-9cb7-bf6be2031d82'
  const userRoleId = (user as any)?.role
  const isManager = userRoleId === TARGET_ROLE_ID
  const isRestrictedAdmin = userRoleId === ADMIN_ROLE_ID && (user as any)?.is_admin === false
  const isRestrictedUser = isManager || isRestrictedAdmin

  const allowedCategoryIds = useMemo(() => {
    if (!isRestrictedUser || !user) return []
    const primary = (user as any)?.employee_category_id?.employee_category_id
    const others =
      (user as any)?.other_category_ids?.map((cat: any) => cat.employee_category_employee_category_id) || []
    return [primary, ...others].filter(Boolean).map(String)
  }, [user, isRestrictedUser])

  // --- Data Fetching ---
  const { data: categories = [], isLoading: isLoadingCats } = useQuery<EmployeeCategory[]>({
    queryKey: ['roster-employee-categories'],
    queryFn: async () => {
      const response: any = await rdk.request(readItems('employee_category' as any, { limit: -1 }))
      return response?.data || response || []
    },
    staleTime: 60_000,
  })

  const { data: shifts = [], isLoading: isLoadingShifts } = useQuery<Shift[]>({
    queryKey: ['roster-shifts'],
    queryFn: async () => {
      const response: any = await rdk.request(readItems('shift' as any, { limit: -1 }))
      return response?.data || response || []
    },
    staleTime: 60_000,
  })

  const cacheData = localStorage.getItem('all_users_of_firm')
  const employeeIds = cacheData ? JSON.parse(cacheData)?.map((item: any) => item.id) || [] : []

  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery<RosterUser[]>({
    queryKey: ['roster-users', userRoleId, employeeIds],
    queryFn: async () => {
      const queryParams: any = {
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
          'designation_id.*',
        ],
      }

      if (isRestrictedUser && allowedCategoryIds.length > 0) {
        queryParams.filter = { id: { _in: employeeIds } }
      }

      const response: any = await rdk.request(
        customEndpoint({
          path: 'users',
          method: 'GET',
          params: queryParams,
        })
      )

      return response?.data || response || []
    },
    enabled: !isRestrictedUser || employeeIds.length > 0,
    staleTime: 60_000,
  })

  // --- Options Preparation ---
  const monthOptions = [
    { label: 'January', value: '0' },
    { label: 'February', value: '1' },
    { label: 'March', value: '2' },
    { label: 'April', value: '3' },
    { label: 'May', value: '4' },
    { label: 'June', value: '5' },
    { label: 'July', value: '6' },
    { label: 'August', value: '7' },
    { label: 'September', value: '8' },
    { label: 'October', value: '9' },
    { label: 'November', value: '10' },
    { label: 'December', value: '11' },
  ]

  const tableCategoryOptions = useMemo(() => {
    let filteredCats = categories
    if (isRestrictedUser) {
      filteredCats = categories.filter((cat) =>
        allowedCategoryIds.includes(String(cat.employee_category_id))
      )
    }
    const options = filteredCats.map((cat) => ({
      label: cat.employee_category_name,
      value: String(cat.employee_category_id),
    }))
    return [{ label: 'All Categories', value: 'all' }, ...options]
  }, [categories, isRestrictedUser, allowedCategoryIds])

  const modalCategoryOptions = useMemo(() => {
    let filteredCats = categories
    if (isRestrictedUser) {
      filteredCats = categories.filter((cat) =>
        allowedCategoryIds.includes(String(cat.employee_category_id))
      )
    }
    return filteredCats.map((cat) => ({
      label: cat.employee_category_name,
      value: String(cat.employee_category_id),
    }))
  }, [categories, isRestrictedUser, allowedCategoryIds])

  const employeeOptions = useMemo(() => {
    const filtered = allUsers.filter((u) => u.status !== 'archived')
    return filtered.map((u) => ({
      value: String(u.id),
      label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Employee',
      categoryId: String(u.employee_category_id?.employee_category_id || ''),
    }))
  }, [allUsers])

  const shiftOptions = useMemo(() => {
    const mappedShifts = shifts
      .filter((shift) => {
        const isDeleted =
          shift.status === 'deleted' || shift.status === 'archived' || shift.is_deleted === true
        const hasTiming = Boolean(shift.shift_from && shift.shift_to)
        return !isDeleted && hasTiming
      })
      .map((shift) => ({
        value: String(shift.shift_id ?? shift.id),
        label: shift.shift_name || shift.name || `Shift ${shift.shift_id ?? shift.id}`,
      }))
    return [{ value: '0', label: 'Week Off' }, ...mappedShifts]
  }, [shifts])

  const categoryFilterOptions = useMemo(() => {
    const unique = new Set(
      allUsers.map((u) => u.employee_category_id?.employee_category_name).filter(Boolean)
    )
    return Array.from(unique).map((c) => ({ label: c as string, value: c as string }))
  }, [allUsers])

  const departmentFilterOptions = useMemo(() => {
    const unique = new Set(allUsers.map((u) => u?.department_name).filter(Boolean))
    return Array.from(unique).map((d) => ({ label: d as string, value: d as string }))
  }, [allUsers])

  const designationFilterOptions = useMemo(() => {
    const unique = new Set(
      allUsers
        .map((u) => u?.designation_id?.designation_name || u?.designation_id?.name)
        .filter(Boolean)
    )
    return Array.from(unique).map((d) => ({ label: d as string, value: d as string }))
  }, [allUsers])

  const sortOptions = [
    { label: 'Name (A-Z)', value: 'name asc' },
    { label: 'Name (Z-A)', value: 'name desc' },
    { label: 'Category (A-Z)', value: 'category asc' },
    { label: 'Category (Z-A)', value: 'category desc' },
    { label: 'Designation (A-Z)', value: 'designation asc' },
    { label: 'Designation (Z-A)', value: 'designation desc' },
    { label: 'Department (A-Z)', value: 'department asc' },
    { label: 'Department (Z-A)', value: 'department desc' },
  ]

  // --- Table & Filtering Logic (Exact V1) ---
  const daysInMonth = useMemo(() => {
    const month = parseInt(selectedMonth, 10)
    const totalDays = new Date(currentYear, month + 1, 0).getDate()
    return Array.from({ length: totalDays }, (_, i) => i + 1)
  }, [selectedMonth, currentYear])

  const filteredUsers = useMemo(() => {
    const employeeRoles = [
      '69a38aea-61ab-4d48-8d3d-1b3a9f78360a',
      '8734320f-991f-479f-bba8-9d4af261856e',
    ]
    const lowerCaseQuery = queryValue.toLowerCase().trim()

    return allUsers.filter((usr) => {
      const isEmployee = employeeRoles.includes(usr.role || '')
      const isActive = usr.status !== 'archived'
      const isInCategory =
        selectedCategory === 'all' ||
        String(usr.employee_category_id?.employee_category_id) === selectedCategory

      const hasCategoryAccess =
        !isManager ||
        allowedCategoryIds?.includes(String(usr.employee_category_id?.employee_category_id))

      const catName = usr.employee_category_id?.employee_category_name || ''
      const desigName = usr.designation_id?.designation_name || usr.designation_id?.name || ''
      const deptName = usr?.department_name || ''
      const fullName = `${usr.first_name || ''} ${usr.last_name || ''}`.toLowerCase()

      if (selectedDepartments.length > 0 && !selectedDepartments.includes(deptName)) return false
      if (selectedDesignations.length > 0 && !selectedDesignations.includes(desigName)) return false
      if (selectedFilterCategories.length > 0 && !selectedFilterCategories.includes(catName))
        return false

      const searchableText = `${fullName} ${catName} ${desigName} ${deptName}`.toLowerCase()
      const matchesSearch = searchableText.includes(lowerCaseQuery)

      return isEmployee && isActive && isInCategory && hasCategoryAccess && matchesSearch
    })
  }, [
    allUsers,
    selectedCategory,
    queryValue,
    isRestrictedUser,
    allowedCategoryIds,
    selectedDepartments,
    selectedDesignations,
    selectedFilterCategories,
    isManager,
  ])

  const sortedUsers = useMemo(() => {
    const [sortKey, sortDirectionText] = sortSelected.split(' ')

    return [...filteredUsers].sort((a, b) => {
      let valA = ''
      let valB = ''

      if (sortKey === 'name') {
        valA = `${a.first_name || ''} ${a.last_name || ''}`.trim()
        valB = `${b.first_name || ''} ${b.last_name || ''}`.trim()
      } else if (sortKey === 'category') {
        valA = a.employee_category_id?.employee_category_name || ''
        valB = b.employee_category_id?.employee_category_name || ''
      } else if (sortKey === 'designation') {
        valA = a.designation_id?.designation_name || a.designation_id?.name || ''
        valB = b.designation_id?.designation_name || b.designation_id?.name || ''
      } else if (sortKey === 'department') {
        valA = a.department_name || ''
        valB = b.department_name || ''
      }

      valA = valA.toLowerCase()
      valB = valB.toLowerCase()

      if (valA < valB) return sortDirectionText === 'asc' ? -1 : 1
      if (valA > valB) return sortDirectionText === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredUsers, sortSelected])

  const totalPages = Math.ceil(sortedUsers.length / itemPerPage)
  const paginatedUsers = useMemo(() => {
    return sortedUsers.slice((page - 1) * itemPerPage, page * itemPerPage)
  }, [sortedUsers, page, itemPerPage])

  // --- Shift Bulk Update Mutation ---
  const shiftBulkUpdateMutation = useMutation({
    mutationFn: async (payload: {
      employee_id: string | number
      schedule_data: any[]
      shift_ids: any[]
    }) => {
      const cleanShiftIds = (payload.shift_ids || []).filter((item: any) => {
        const sId =
          item?.shift_shift_id?.shift_id ?? item?.shift_shift_id ?? item?.shift_id ?? item
        return sId !== 0 && sId !== '0' && sId !== null && sId !== undefined && !isNaN(sId)
      })

      return await rdk.request(
        customEndpoint({
          path: `users/${payload.employee_id}`,
          method: 'PATCH',
          body: JSON.stringify({
            shift_type: 'monthly',
            shiftwise_attendance: true,
            monthly_shifts: payload.schedule_data,
            shift_ids: cleanShiftIds,
          }),
        })
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster-users'] })
    },
    onError: (error) => {
      console.error('Error updating shifts:', error)
      toast.error('Failed to update shifts.')
    },
  })

  // --- Handlers ---
  const handleCellClick = useCallback(
    (targetUser: RosterUser, day: number, month: string, year: number) => {
      const dateStr = `${String(day).padStart(2, '0')}-${String(parseInt(month, 10) + 1).padStart(2, '0')}-${year}`
      const clickedDate = new Date(year, parseInt(month, 10), day)

      let monthlyShiftsArr: any[] = []
      if (Array.isArray(targetUser.monthly_shifts)) {
        monthlyShiftsArr = targetUser.monthly_shifts
      } else if (typeof targetUser.monthly_shifts === 'string') {
        try {
          monthlyShiftsArr = JSON.parse(targetUser.monthly_shifts)
        } catch {
          monthlyShiftsArr = []
        }
      }

      const currentShiftData = monthlyShiftsArr.find((ms: any) => ms.date_string === dateStr)
      const currentShiftIds =
        currentShiftData?.shift_ids?.map((s: any) => {
          const sId = s.shift_id?.shift_id ?? s.shift_id
          return String(sId)
        }) || []

      const userCatId = String(targetUser.employee_category_id?.employee_category_id)

      if (userCatId && userCatId !== 'undefined') {
        setCellPrefillCategories([userCatId])
      } else {
        setCellPrefillCategories([])
      }
      setCellPrefillEmployees([String(targetUser.id)])
      setCellPrefillShifts(currentShiftIds)
      setCellPrefillDateRange({ start: clickedDate, end: clickedDate })
      setCellPrefillMode('single')

      setModalMode('update')
      setIsModalOpen(true)
    },
    []
  )

  const handleBulkUpdateSubmit = async (data: {
    employees: string[]
    shifts: string[]
    dateRange?: { start: Date; end: Date }
    dates?: Date[]
    selectionMode?: 'single' | 'range' | 'multiple'
  }) => {
    const { employees, shifts: selectedShiftIds, dateRange, dates } = data

    const toastId = toast.loading('Updating shifts, please wait...')

    try {
      const formattedShifts = selectedShiftIds.map((sId) => ({
        shift_id: parseInt(sId, 10),
      }))

      const newDatesPayload: any[] = []

      if (Array.isArray(dates) && dates.length > 0) {
        const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime())
        sortedDates.forEach((d) => {
          const day = String(d.getDate()).padStart(2, '0')
          const month = String(d.getMonth() + 1).padStart(2, '0')
          const year = d.getFullYear()
          const dateString = `${day}-${month}-${year}`

          newDatesPayload.push({
            date_string: dateString,
            shift_ids: formattedShifts,
          })
        })
      } else if (dateRange?.start && dateRange?.end) {
        const currentDate = new Date(dateRange.start)
        const endDate = new Date(dateRange.end)
        currentDate.setHours(0, 0, 0, 0)
        endDate.setHours(0, 0, 0, 0)

        while (currentDate <= endDate) {
          const day = String(currentDate.getDate()).padStart(2, '0')
          const month = String(currentDate.getMonth() + 1).padStart(2, '0')
          const year = currentDate.getFullYear()
          const dateString = `${day}-${month}-${year}`

          newDatesPayload.push({
            date_string: dateString,
            shift_ids: formattedShifts,
          })
          currentDate.setDate(currentDate.getDate() + 1)
        }
      } else {
        toast.error('Please select valid dates.', { id: toastId })
        return
      }

      if (newDatesPayload.length === 0) {
        toast.error('No dates to update.', { id: toastId })
        return
      }

      const finalEmployeePayloads = employees.map((empId) => {
        const currentUser = allUsers.find((u) => String(u.id) === String(empId))
        const { schedule_data, shift_ids } = mergeEmployeeMonthlyShifts(
          currentUser,
          newDatesPayload
        )

        return {
          employee_id: empId,
          schedule_data,
          shift_ids,
        }
      })

      const updatePromises = finalEmployeePayloads.map((payload) =>
        shiftBulkUpdateMutation.mutateAsync(payload)
      )

      await Promise.all(updatePromises)
      queryClient.invalidateQueries({ queryKey: ['roster-users'] })
      toast.success('Shifts updated successfully!', { id: toastId })
      setIsModalOpen(false)
    } catch (error) {
      console.error('Error during bulk update:', error)
      toast.error('Failed to update shifts. Please try again.', { id: toastId })
    }
  }

  const handleImportSubmit = async (importFile: File) => {
    const toastId = toast.loading('Processing Excel and updating shifts... Please wait!')

    try {
      const excelPayloads = await handleExcelImportPayload(importFile, shifts, allUsers)

      if (excelPayloads && excelPayloads.length > 0) {
        const finalEmployeePayloads = excelPayloads.map((excelEmpData) => {
          const empId = excelEmpData.employee_id
          const newDatesPayload = excelEmpData.schedule_data
          const currentUser = allUsers.find((u) => String(u.id) === String(empId))

          const { schedule_data, shift_ids } = mergeEmployeeMonthlyShifts(
            currentUser,
            newDatesPayload
          )

          return {
            employee_id: empId,
            schedule_data,
            shift_ids,
          }
        })

        const updatePromises = finalEmployeePayloads.map((payload) =>
          shiftBulkUpdateMutation.mutateAsync(payload)
        )

        await Promise.all(updatePromises)
        queryClient.invalidateQueries({ queryKey: ['roster-users'] })
        toast.success('Excel processed and shifts updated successfully!', { id: toastId })
        setIsModalOpen(false)
      } else {
        toast.error('No valid data found or mismatched employees in Excel.', { id: toastId })
      }
    } catch (error) {
      console.error('Error during import bulk update:', error)
      toast.error('An error occurred while updating shifts. Please try again.', { id: toastId })
    }
  }

  const handleDownloadSubmit = (data: {
    categories: string[]
    shifts: string[]
    selectionMode: 'month' | 'range'
    downloadMonth: string
    dateRange: { start: Date; end: Date }
  }) => {
    const { categories: selCats, shifts: selShifts, selectionMode, downloadMonth, dateRange } = data
    const employeeRoles = [
      '69a38aea-61ab-4d48-8d3d-1b3a9f78360a',
      '8734320f-991f-479f-bba8-9d4af261856e',
    ]

    let exportUsers = allUsers.filter((usr) => {
      const isEmployee = employeeRoles.includes(usr.role || '')
      const isActive = usr.status !== 'archived'
      const hasAccess =
        !isManager ||
        allowedCategoryIds?.includes(String(usr.employee_category_id?.employee_category_id))

      return isEmployee && isActive && hasAccess
    })

    if (selCats && selCats.length > 0) {
      exportUsers = exportUsers.filter((u) =>
        selCats.includes(String(u.employee_category_id?.employee_category_id))
      )
    }

    if (selShifts && selShifts.length > 0) {
      exportUsers = exportUsers.filter((u) => {
        let monthlyShiftsArr: any[] = []
        if (Array.isArray(u.monthly_shifts)) {
          monthlyShiftsArr = u.monthly_shifts
        } else if (typeof u.monthly_shifts === 'string') {
          try {
            monthlyShiftsArr = JSON.parse(u.monthly_shifts)
          } catch {
            monthlyShiftsArr = []
          }
        }

        return monthlyShiftsArr.some((ms: any) => {
          const [day, monthStr, yearStr] = ms.date_string.split('-')
          const shiftDate = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, parseInt(day, 10))

          let isDateInRange = false

          if (selectionMode === 'month') {
            isDateInRange =
              parseInt(monthStr, 10) - 1 === parseInt(downloadMonth, 10) &&
              parseInt(yearStr, 10) === currentYear
          } else {
            const start = new Date(dateRange.start)
            start.setHours(0, 0, 0, 0)
            const end = new Date(dateRange.end)
            end.setHours(23, 59, 59, 999)
            isDateInRange = shiftDate >= start && shiftDate <= end
          }

          if (isDateInRange) {
            return ms.shift_ids?.some((s: any) => {
              const sId = String(s.shift_id?.shift_id ?? s.shift_id)
              return selShifts.includes(sId)
            })
          }
          return false
        })
      })
    }

    if (exportUsers.length === 0) {
      toast.error('No employees found matching these filters.')
      return
    }

    const firmName =
      (user as any)?.firm_id?.firm_name || (user as any)?.firm_name || 'MyHisaab'

    if (selectionMode === 'range') {
      downloadRoasterExcelByDateRange(
        exportUsers,
        shifts,
        dateRange.start,
        dateRange.end,
        firmName
      )
    } else {
      downloadRoasterExcel(exportUsers, shifts, downloadMonth, currentYear, firmName)
    }

    toast.success('Download started!')
    setIsModalOpen(false)
  }

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel
        className={cn(
          'flex min-w-0 flex-1 flex-col h-full overflow-hidden bg-background border border-border shadow-2xs',
          firstTabActive && 'rounded-tl-none'
        )}
      >
        {/* Top Page Header with Title & Action Buttons (matching Tasks.tsx / Staff.tsx) */}
        <RosterHeader
          onOpenImport={() => {
            setModalMode('import')
            setIsModalOpen(true)
          }}
          onOpenBulkUpdate={() => {
            setCellPrefillCategories([])
            setCellPrefillEmployees([])
            setCellPrefillShifts([])
            setCellPrefillDateRange({ start: new Date(), end: new Date() })
            setCellPrefillMode('single')
            setModalMode('update')
            setIsModalOpen(true)
          }}
          onOpenDownload={() => {
            setModalMode('download')
            setIsModalOpen(true)
          }}
        />

        {/* Sub-toolbar: Selectors, Search, Filter Popover, Sort Popover */}
        <RosterFilters
          selectedMonth={selectedMonth}
          onMonthChange={(m) => {
            setSelectedMonth(m)
            setPage(1)
          }}
          monthOptions={monthOptions}
          selectedCategory={selectedCategory}
          onCategoryChange={(c) => {
            setSelectedCategory(c)
            setPage(1)
          }}
          tableCategoryOptions={tableCategoryOptions}
          isLoadingCats={isLoadingCats}
          searchQuery={queryValue}
          onSearchChange={(q) => {
            setQueryValue(q)
            setPage(1)
          }}
          sortSelected={sortSelected}
          onSortChange={setSortSelected}
          sortOptions={sortOptions}
          departmentOptions={departmentFilterOptions}
          selectedDepartments={selectedDepartments}
          onDepartmentsChange={setSelectedDepartments}
          designationOptions={designationFilterOptions}
          selectedDesignations={selectedDesignations}
          onDesignationsChange={setSelectedDesignations}
          categoryOptions={categoryFilterOptions}
          selectedCategories={selectedFilterCategories}
          onCategoriesChange={setSelectedFilterCategories}
          onClearAll={() => {
            setQueryValue('')
            setSelectedDepartments([])
            setSelectedDesignations([])
            setSelectedFilterCategories([])
            setPage(1)
          }}
        />

        {/* Edge-to-Edge Monthly Spreadsheet Table View with Frozen First Column */}
        <RosterTable
          users={paginatedUsers}
          daysInMonth={daysInMonth}
          selectedMonth={selectedMonth}
          currentYear={currentYear}
          shifts={shifts}
          isLoading={isLoadingUsers}
          onCellClick={handleCellClick}
        />

        {/* Edge-to-Edge Sticky Pagination Bar */}
        <RosterPagination
          page={page}
          totalPages={totalPages}
          itemPerPage={itemPerPage}
          totalItems={sortedUsers.length}
          onPageChange={setPage}
          onItemPerPageChange={(lim) => {
            setItemPerPage(lim)
            setPage(1)
          }}
        />
      </Panel>

      {/* ── Modals ── */}
      {modalMode === 'update' && (
        <BulkShiftUpdateModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleBulkUpdateSubmit}
          categoryOptions={modalCategoryOptions}
          employeeOptions={employeeOptions}
          shiftOptions={shiftOptions}
          initialCategories={cellPrefillCategories}
          initialEmployees={cellPrefillEmployees}
          initialShifts={cellPrefillShifts}
          initialDateRange={cellPrefillDateRange}
          initialSelectionMode={cellPrefillMode}
        />
      )}

      {modalMode === 'download' && (
        <RosterReportModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleDownloadSubmit}
          categoryOptions={modalCategoryOptions}
          shiftOptions={shiftOptions}
          monthOptions={monthOptions}
          currentMonth={selectedMonth}
        />
      )}

      {modalMode === 'import' && (
        <ExcelImportModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleImportSubmit}
        />
      )}
    </div>
  )
}

export default MonthlyRoster
