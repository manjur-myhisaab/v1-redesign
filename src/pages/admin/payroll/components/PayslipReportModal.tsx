import { useState, useMemo, useEffect } from 'react'
import {
  X,
  FileSpreadsheet,
  Search,
  Loader2,
} from 'lucide-react'
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
import { DatePicker } from '@/components/ui/date-picker'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import rdk, { customEndpoint } from '@/services/server'
import { handleGenerateExcel } from '../utils/downloadPayslipSummerySheet'
import { downloadDailyEarningsSheet } from '../utils/downloadDailyEarningsSheet'
import { downloadWeeklyEarningsSheet } from '../utils/downloadWeeklyEarningsSheet'

interface PayslipReportModalProps {
  open: boolean
  onClose: () => void
  user: any
  allUsers: any[]
  usersLoading: boolean
  categoryList: any[]
  selectedMonth: string
  selectedYear: string
  months: { label: string; value: string }[]
  years: { label: string; value: string }[]
  allEmpSalaryResults?: any[]
  isRestrictedUser: boolean
  allowedCategoryIds: string[]
  allowedRolesForModal: string[]
}

const isEmployeeActiveForPeriod = (
  employee: any,
  selectionMode: 'fixed' | 'singleDate' | 'weekly',
  reportMonth: string,
  reportYear: string,
  singleDate: string,
  weeklyRange: { start: string; end: string },
) => {
  const status = String(employee.status || employee.emp_status || '').toLowerCase().trim()
  const isInactive =
    status === 'archived' || status === 'deleted' || status === 'suspended' || status === 'inactive'

  if (!isInactive) return true

  const rawDate = employee.inactive_date
  if (!rawDate) return false

  const inDate = new Date(rawDate)
  if (isNaN(inDate.getTime())) return false

  if (selectionMode === 'weekly') {
    if (!weeklyRange.start) return false
    const dStart = new Date(weeklyRange.start)
    dStart.setHours(0, 0, 0, 0)
    const dEnd = weeklyRange.end ? new Date(weeklyRange.end) : new Date(dStart)
    dEnd.setHours(23, 59, 59, 999)
    return inDate >= dStart && inDate <= dEnd
  }

  if (selectionMode === 'singleDate') {
    if (!singleDate) return false
    const sDate = new Date(singleDate)
    if (isNaN(sDate.getTime())) return false

    const sameLocal =
      inDate.getDate() === sDate.getDate() &&
      inDate.getMonth() === sDate.getMonth() &&
      inDate.getFullYear() === sDate.getFullYear()

    let strMatch = false
    if (typeof rawDate === 'string' && rawDate.length >= 10) {
      const sDay = String(sDate.getDate()).padStart(2, '0')
      const sMonth = String(sDate.getMonth() + 1).padStart(2, '0')
      const sYear = String(sDate.getFullYear())
      strMatch = rawDate.slice(0, 10) === `${sYear}-${sMonth}-${sDay}`
    }
    return sameLocal || strMatch
  }

  if (selectionMode === 'fixed') {
    if (!reportMonth || !reportYear || reportMonth === '#' || reportYear === '#') return false
    const targetMonthStr = String(reportMonth).padStart(2, '0')
    const targetYearStr = String(reportYear)

    const inMonthStr = String(inDate.getMonth() + 1).padStart(2, '0')
    const inYearStr = String(inDate.getFullYear())
    const sameLocal = inMonthStr === targetMonthStr && inYearStr === targetYearStr

    let strMatch = false
    if (typeof rawDate === 'string' && rawDate.length >= 7) {
      strMatch = rawDate.startsWith(`${targetYearStr}-${targetMonthStr}`)
    }
    return sameLocal || strMatch
  }

  return false
}

const getEmployeeRoleId = (emp: any) => {
  if (!emp) return null
  if (typeof emp.role === 'object' && emp.role !== null) return emp.role.id || emp.role.role_id
  return emp.role
}

export default function PayslipReportModal({
  open,
  onClose,
  user,
  allUsers,
  usersLoading,
  categoryList,
  selectedMonth,
  selectedYear,
  months,
  years,
  allEmpSalaryResults = [],
  isRestrictedUser,
  allowedCategoryIds,
  allowedRolesForModal,
}: PayslipReportModalProps) {
  const [selectionMode, setSelectionMode] = useState<'fixed' | 'singleDate' | 'weekly'>('fixed')
  const [reportMonth, setReportMonth] = useState(selectedMonth)
  const [reportYear, setReportYear] = useState(selectedYear)

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return d.toISOString().slice(0, 10)
  }, [])

  const [singleDate, setSingleDate] = useState<string>(todayStr)
  const [weeklyRange, setWeeklyRange] = useState<{ start: string; end: string }>({
    start: sevenDaysAgoStr,
    end: todayStr,
  })

  const [categorySearchQuery, setCategorySearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string[]>([])
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  // Reset or initialize eligible employees on open
  useEffect(() => {
    if (open) {
      setSelectionMode('fixed')
      setReportMonth(selectedMonth)
      setReportYear(selectedYear)
      setSingleDate(todayStr)
      setWeeklyRange({ start: sevenDaysAgoStr, end: todayStr })
      setCategorySearchQuery('')
      setSelectedCategory([])
      setEmployeeSearchQuery('')

      const initialEligible = allUsers
        .filter((employee) => {
          const empCatId =
            employee.employee_category_id?.employee_category_id || employee.employee_category_id
          const hasCatAccess = !isRestrictedUser || allowedCategoryIds.includes(String(empCatId))
          const roleId = getEmployeeRoleId(employee)
          const hasRoleAccess = !roleId || allowedRolesForModal.includes(String(roleId))
          return (
            hasCatAccess &&
            hasRoleAccess &&
            isEmployeeActiveForPeriod(
              employee,
              'fixed',
              selectedMonth,
              selectedYear,
              todayStr,
              { start: sevenDaysAgoStr, end: todayStr },
            )
          )
        })
        .map((e) => String(e.id))

      setSelectedEmployee(initialEligible)
    }
  }, [open, selectedMonth, selectedYear, allUsers])

  const modalCategories = useMemo(() => {
    if (!categoryList) return []
    return categoryList.filter((category) => {
      const matchesSearch = (category.employee_category_name || '')
        .toLowerCase()
        .includes(categorySearchQuery.toLowerCase())
      const hasAccess =
        !isRestrictedUser || allowedCategoryIds.includes(String(category.employee_category_id))
      return matchesSearch && hasAccess
    })
  }, [categoryList, categorySearchQuery, isRestrictedUser, allowedCategoryIds])

  const modalEmployees = useMemo(() => {
    if (!allUsers) return []
    return allUsers.filter((employee) => {
      const fullName = `${employee.first_name || ''} ${employee.last_name || ''}`.toLowerCase()
      const matchesSearch = fullName.includes(employeeSearchQuery.toLowerCase())
      const empCatId =
        employee.employee_category_id?.employee_category_id || employee.employee_category_id
      const hasCatAccess = !isRestrictedUser || allowedCategoryIds.includes(String(empCatId))
      const roleId = getEmployeeRoleId(employee)
      const hasRoleAccess = !roleId || allowedRolesForModal.includes(String(roleId))
      const isEligible = isEmployeeActiveForPeriod(
        employee,
        selectionMode,
        reportMonth,
        reportYear,
        singleDate,
        weeklyRange,
      )
      return matchesSearch && hasCatAccess && hasRoleAccess && isEligible
    })
  }, [
    allUsers,
    employeeSearchQuery,
    isRestrictedUser,
    allowedCategoryIds,
    allowedRolesForModal,
    selectionMode,
    reportMonth,
    reportYear,
    singleDate,
    weeklyRange,
  ])

  const activeEmployeeList = useMemo(() => {
    if (selectedCategory.length === 0) return modalEmployees
    return modalEmployees.filter((employee) => {
      const empCatId = String(
        employee.employee_category_id?.employee_category_id || employee.employee_category_id,
      )
      return selectedCategory.includes(empCatId)
    })
  }, [modalEmployees, selectedCategory])

  const isAllCategoriesSelected =
    modalCategories.length > 0 &&
    modalCategories.every((c) => selectedCategory.includes(String(c.employee_category_id)))

  const isAllEmployeesSelected =
    activeEmployeeList.length > 0 &&
    activeEmployeeList.every((e) => selectedEmployee.includes(String(e.id)))

  const handleSelectAllCategories = (checked: boolean) => {
    if (checked) {
      setSelectedCategory(modalCategories.map((c) => String(c.employee_category_id)))
    } else {
      setSelectedCategory([])
    }
  }

  const handleSelectAllEmployees = (checked: boolean) => {
    if (checked) {
      setSelectedEmployee(activeEmployeeList.map((e) => String(e.id)))
    } else {
      setSelectedEmployee([])
    }
  }

  const handleModeChange = (mode: 'fixed' | 'singleDate' | 'weekly') => {
    setSelectionMode(mode)
    const eligible = allUsers
      .filter((employee) => {
        const empCatId =
          employee.employee_category_id?.employee_category_id || employee.employee_category_id
        const hasCatAccess = !isRestrictedUser || allowedCategoryIds.includes(String(empCatId))
        const roleId = getEmployeeRoleId(employee)
        const hasRoleAccess = !roleId || allowedRolesForModal.includes(String(roleId))
        return (
          hasCatAccess &&
          hasRoleAccess &&
          isEmployeeActiveForPeriod(
            employee,
            mode,
            reportMonth,
            reportYear,
            singleDate,
            weeklyRange,
          )
        )
      })
      .map((e) => String(e.id))
    setSelectedEmployee(eligible)
  }

  const handleWeeklyChange = (field: 'start' | 'end', val: string) => {
    const next = { ...weeklyRange, [field]: val }
    if (next.start && next.end) {
      const s = new Date(next.start)
      const e = new Date(next.end)
      const diffMs = e.getTime() - s.getTime()
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1
      if (diffDays > 7) {
        toast.error('You cannot select more than 7 days for weekly payments')
        return
      }
      if (diffDays <= 0) {
        toast.error('Start date must be before or equal to End date')
        return
      }
    }
    setWeeklyRange(next)
  }

  const handleGenerate = async () => {
    if (selectedEmployee.length === 0) {
      toast.error('Please select at least one employee')
      return
    }

    setIsGenerating(true)
    const toastId = toast.loading('Generating report...')

    try {
      const firmId = user?.firm_id?.firm_id
      const firmName = user?.firm_id?.firm_name || ''

      if (selectionMode === 'fixed') {
        if (!reportMonth || !reportYear || reportMonth === '#' || reportYear === '#') {
          toast.error('Please select a valid month and year', { id: toastId })
          setIsGenerating(false)
          return
        }

        let salaryResults: any[] = []
        if (
          reportMonth === selectedMonth &&
          reportYear === selectedYear &&
          allEmpSalaryResults.length > 0
        ) {
          salaryResults = allEmpSalaryResults
        } else {
          const response: any = await rdk.request(
            customEndpoint({
              path: `api/all_employee_salary/${reportYear}-${reportMonth}/${firmId}`,
              method: 'GET',
            }),
          )
          salaryResults = response?.results || []
        }

        const selectedSet = new Set(selectedEmployee.map(String))
        const filteredPayslips = salaryResults.filter((item) =>
          selectedSet.has(String(item.employee?.id)),
        )

        if (filteredPayslips.length === 0) {
          toast.error('No payslip data found for the selected employees in this period', {
            id: toastId,
          })
          setIsGenerating(false)
          return
        }

        const monthName = months.find((m) => m.value === reportMonth)?.label || reportMonth
        await handleGenerateExcel(filteredPayslips, monthName, reportYear, firmName)
        toast.success('Payslip report generated successfully!', { id: toastId })
        onClose()
      } else if (selectionMode === 'singleDate') {
        if (!singleDate) {
          toast.error('Please select a valid date', { id: toastId })
          setIsGenerating(false)
          return
        }
        const selectedSet = new Set(selectedEmployee.map(String))
        const selectedEmpList = allUsers.filter((emp) => selectedSet.has(String(emp.id)))

        await (downloadDailyEarningsSheet as any)(
          selectedEmpList,
          new Date(singleDate),
          firmName,
          user,
        )
        toast.success('Daily Earnings report generated successfully!', { id: toastId })
        onClose()
      } else if (selectionMode === 'weekly') {
        if (!weeklyRange.start || !weeklyRange.end) {
          toast.error('Please select valid start and end dates', { id: toastId })
          setIsGenerating(false)
          return
        }
        const selectedSet = new Set(selectedEmployee.map(String))
        const selectedEmpList = allUsers.filter((emp) => selectedSet.has(String(emp.id)))

        await (downloadWeeklyEarningsSheet as any)(
          selectedEmpList,
          { start: new Date(weeklyRange.start), end: new Date(weeklyRange.end) },
          firmName,
          user,
        )
        toast.success('Weekly Payments report generated successfully!', { id: toastId })
        onClose()
      }
    } catch (err: any) {
      console.error('Report error:', err)
      toast.error(err?.message || 'Failed to generate report', { id: toastId })
    } finally {
      setIsGenerating(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {selectionMode === 'weekly'
                  ? 'Generate Weekly Payments Report'
                  : selectionMode === 'singleDate'
                    ? 'Generate Daily Earnings Report'
                    : 'Generate Payslip Report'}
              </h2>
              <p className="text-xs text-muted-foreground">
                Export comprehensive payroll &amp; attendance breakdown directly to Excel
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body: 3-column Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Section 1: Mode & Date Selection */}
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-foreground mb-2 block tracking-wide uppercase">
                1. Selection Mode
              </label>
              <div className="flex flex-col gap-2 p-3 bg-muted/30 rounded-xl border border-dashed border-border">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-foreground">
                  <input
                    type="radio"
                    name="report_mode"
                    value="fixed"
                    checked={selectionMode === 'fixed'}
                    onChange={() => handleModeChange('fixed')}
                    className="accent-primary"
                  />
                  <span>Month Selection (Full Payslip)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-foreground">
                  <input
                    type="radio"
                    name="report_mode"
                    value="singleDate"
                    checked={selectionMode === 'singleDate'}
                    onChange={() => handleModeChange('singleDate')}
                    className="accent-primary"
                  />
                  <span>Single Date (Per Day Earnings)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-foreground">
                  <input
                    type="radio"
                    name="report_mode"
                    value="weekly"
                    checked={selectionMode === 'weekly'}
                    onChange={() => handleModeChange('weekly')}
                    className="accent-primary"
                  />
                  <span>Weekly Payments (Up to 7 Days)</span>
                </label>
              </div>
            </div>

            {/* Sub-inputs based on mode */}
            {selectionMode === 'fixed' && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-foreground tracking-wide uppercase">
                  Select Month &amp; Year
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={reportMonth} onValueChange={setReportMonth}>
                    <SelectTrigger className="w-full h-9 text-xs bg-background">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={reportYear} onValueChange={setReportYear}>
                    <SelectTrigger className="w-full h-9 text-xs bg-background">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y.value} value={y.value}>
                          {y.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {selectionMode === 'singleDate' && (
              <div className="flex flex-col gap-2 min-w-0">
                <label className="text-xs font-bold text-foreground tracking-wide uppercase">
                  Select Date
                </label>
                <DatePicker
                  value={singleDate ? new Date(`${singleDate}T00:00:00`) : undefined}
                  onChange={(date) => {
                    if (date) {
                      const y = date.getFullYear()
                      const m = String(date.getMonth() + 1).padStart(2, '0')
                      const d = String(date.getDate()).padStart(2, '0')
                      setSingleDate(`${y}-${m}-${d}`)
                    }
                  }}
                  format="medium"
                  className="w-full h-8 text-xs px-2.5"
                />
              </div>
            )}

            {selectionMode === 'weekly' && (
              <div className="flex flex-col gap-2 min-w-0">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground tracking-wide uppercase">
                    Select Range (Max 7 Days)
                  </label>
                  <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded font-semibold">
                    Max 7 days
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 min-w-0">
                  <div className="min-w-0 flex flex-col">
                    <span className="text-[10px] text-muted-foreground block mb-1">From</span>
                    <DatePicker
                      value={weeklyRange.start ? new Date(`${weeklyRange.start}T00:00:00`) : undefined}
                      onChange={(date) => {
                        if (date) {
                          const y = date.getFullYear()
                          const m = String(date.getMonth() + 1).padStart(2, '0')
                          const d = String(date.getDate()).padStart(2, '0')
                          handleWeeklyChange('start', `${y}-${m}-${d}`)
                        }
                      }}
                      format="medium"
                      className="w-full h-8 text-xs px-2"
                    />
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <span className="text-[10px] text-muted-foreground block mb-1">To</span>
                    <DatePicker
                      value={weeklyRange.end ? new Date(`${weeklyRange.end}T00:00:00`) : undefined}
                      onChange={(date) => {
                        if (date) {
                          const y = date.getFullYear()
                          const m = String(date.getMonth() + 1).padStart(2, '0')
                          const d = String(date.getDate()).padStart(2, '0')
                          handleWeeklyChange('end', `${y}-${m}-${d}`)
                        }
                      }}
                      format="medium"
                      className="w-full h-8 text-xs px-2"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Category Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-foreground tracking-wide uppercase">
              2. Select Category
            </label>
            <div className="border border-border rounded-xl p-3 h-[320px] flex flex-col gap-2.5 bg-background">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search category..."
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  className="h-7.5 pl-8 text-xs bg-muted/20"
                />
              </div>

              <div className="border-b border-border pb-2 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                  <Checkbox
                    checked={isAllCategoriesSelected}
                    onCheckedChange={(checked) => handleSelectAllCategories(!!checked)}
                  />
                  <span>Select All Categories</span>
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {selectedCategory.length} / {modalCategories.length}
                </span>
              </div>

              <div className="overflow-y-auto flex-1 flex flex-col gap-1 pr-1">
                {modalCategories.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    No categories found
                  </div>
                ) : (
                  modalCategories.map((c) => {
                    const isChecked = selectedCategory.includes(String(c.employee_category_id))
                    return (
                      <label
                        key={c.employee_category_id}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors hover:bg-muted/50',
                          isChecked && 'bg-primary/5 text-primary font-medium',
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            const val = String(c.employee_category_id)
                            setSelectedCategory((prev) =>
                              checked ? [...prev, val] : prev.filter((id) => id !== val),
                            )
                          }}
                        />
                        <span>{c.employee_category_name}</span>
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Employee Selection */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground tracking-wide uppercase">
                3. Select Employee
              </label>
              {selectedEmployee.length > 0 && (
                <span className="text-xs font-bold text-primary">
                  {selectedEmployee.length} Selected
                </span>
              )}
            </div>

            <div className="border border-border rounded-xl p-3 h-[320px] flex flex-col gap-2.5 bg-background">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search employee..."
                  value={employeeSearchQuery}
                  onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                  className="h-7.5 pl-8 text-xs bg-muted/20"
                />
              </div>

              <div className="border-b border-border pb-2 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                  <Checkbox
                    checked={isAllEmployeesSelected}
                    onCheckedChange={(checked) => handleSelectAllEmployees(!!checked)}
                  />
                  <span>Select All ({activeEmployeeList.length})</span>
                </label>
                {usersLoading && (
                  <Loader2 className="size-3 animate-spin text-muted-foreground" />
                )}
              </div>

              <div className="overflow-y-auto flex-1 flex flex-col gap-1 pr-1">
                {usersLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span>Loading employees...</span>
                  </div>
                ) : activeEmployeeList.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    No employees found
                  </div>
                ) : (
                  activeEmployeeList.map((emp) => {
                    const isChecked = selectedEmployee.includes(String(emp.id))
                    const status = String(emp.status || emp.emp_status || '').toLowerCase().trim()
                    const isInactive =
                      status === 'archived' ||
                      status === 'deleted' ||
                      status === 'suspended' ||
                      status === 'inactive'

                    return (
                      <label
                        key={emp.id}
                        className={cn(
                          'flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors hover:bg-muted/50',
                          isChecked && 'bg-primary/5 text-primary font-medium',
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const val = String(emp.id)
                              setSelectedEmployee((prev) =>
                                checked
                                  ? [...prev, val]
                                  : prev.filter((id) => id !== val),
                              )
                            }}
                          />
                          <span className="truncate">
                            {emp.first_name || ''} {emp.last_name || ''}
                          </span>
                        </div>
                        {isInactive && (
                          <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200">
                            Inactive
                          </Badge>
                        )}
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isGenerating}
            className="cursor-pointer text-xs"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || selectedEmployee.length === 0}
            className="cursor-pointer text-xs font-semibold"
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-3.5 mr-2 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="size-3.5 mr-2" />
                <span>
                  {selectionMode === 'weekly'
                    ? 'Generate Weekly Payments Sheet (Excel)'
                    : selectionMode === 'singleDate'
                      ? 'Generate Daily Earnings Sheet (Excel)'
                      : 'Generate Payslip Report (Excel)'}
                </span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
