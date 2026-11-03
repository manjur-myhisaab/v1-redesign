import React, { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileSpreadsheet,
  Calendar,
  Search,
  ArrowUpDown,
  RefreshCw,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  AlertCircle,
  Coins,
} from 'lucide-react'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import rdk, { ATTENDANCE_SERVER_URL, customEndpoint, readItems } from '@/services/server'
import { useAuth } from '@/context/auth/AuthContext'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import PayslipReportModal from './components/PayslipReportModal'
import type { EmployeeSalaryResult, PayrollTemplate, EmployeeCategory } from './types'

function ColumnResizer({
  isResizing,
  onMouseDown,
}: {
  isResizing: boolean
  onMouseDown: (e: React.MouseEvent) => void
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        'absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-20',
        isResizing && 'bg-primary w-1',
      )}
    />
  )
}

const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount)
}

const getEmployeeRoleId = (emp: any) => {
  if (!emp) return null
  if (typeof emp.role === 'object' && emp.role !== null) return emp.role.id || emp.role.role_id
  return emp.role
}

export default function PayslipList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const shell = useShell()
  const firstTabActive = shell?.firstTabActive ?? false
  const queryClient = useQueryClient()

  // Month & Year state
  const currentDate = new Date()
  const initialMonth = String(currentDate.getMonth() + 1).padStart(2, '0')
  const initialYear = String(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [datePopoverOpen, setDatePopoverOpen] = useState(false)

  // Filter & Pagination state
  const [search, setSearch] = useState('')
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<number | string>('all')
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [sortSelected, setSortSelected] = useState<string>('name asc')
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false)

  // Report Modal state
  const [reportModalOpen, setReportModalOpen] = useState(false)

  const months = useMemo(
    () => [
      { label: 'January', value: '01' },
      { label: 'February', value: '02' },
      { label: 'March', value: '03' },
      { label: 'April', value: '04' },
      { label: 'May', value: '05' },
      { label: 'June', value: '06' },
      { label: 'July', value: '07' },
      { label: 'August', value: '08' },
      { label: 'September', value: '09' },
      { label: 'October', value: '10' },
      { label: 'November', value: '11' },
      { label: 'December', value: '12' },
    ],
    [],
  )

  const years = useMemo(() => {
    const curY = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, i) => ({
      label: String(curY - i),
      value: String(curY - i),
    }))
  }, [])

  const displayMonthName = months.find((m) => m.value === selectedMonth)?.label || ''

  // Allowed Categories & Roles
  const allowedCategoryIds = useMemo(() => {
    return [
      user?.employee_category_id?.employee_category_id,
      ...(user?.other_category_ids?.map((cat: any) => cat.employee_category_employee_category_id) ||
        []),
    ]
      .filter(Boolean)
      .map(String)
  }, [user])

  const isRestrictedUser = !(
    user?.is_admin === true ||
    (user?.role === 'bb64d3fd-5fde-4493-9cb7-bf6be2031d82' && user?.is_admin === true)
  )

  const allowedRoles = useMemo(() => {
    if (
      user?.is_admin === true ||
      (user?.role === 'bb64d3fd-5fde-4493-9cb7-bf6be2031d82' && user?.is_admin === true)
    ) {
      return [
        '69a38aea-61ab-4d48-8d3d-1b3a9f78360a',
        '8734320f-991f-479f-bba8-9d4af261856e',
        'bb64d3fd-5fde-4493-9cb7-bf6be2031d82',
      ]
    }
    if (user?.role === 'bb64d3fd-5fde-4493-9cb7-bf6be2031d82' && !user?.is_admin) {
      return [
        '69a38aea-61ab-4d48-8d3d-1b3a9f78360a',
        '8734320f-991f-479f-bba8-9d4af261856e',
      ]
    }
    if (user?.role === '8734320f-991f-479f-bba8-9d4af261856e' && user?.can_view_manager === true) {
      return [
        '69a38aea-61ab-4d48-8d3d-1b3a9f78360a',
        '8734320f-991f-479f-bba8-9d4af261856e',
      ]
    }
    return ['69a38aea-61ab-4d48-8d3d-1b3a9f78360a']
  }, [user])

  const allowedRolesForModal = useMemo(() => {
    if (user?.is_admin === true || user?.role === 'bb64d3fd-5fde-4493-9cb7-bf6be2031d82') {
      return [
        '69a38aea-61ab-4d48-8d3d-1b3a9f78360a',
        '8734320f-991f-479f-bba8-9d4af261856e',
      ]
    }
    if (user?.role === '8734320f-991f-479f-bba8-9d4af261856e' && user?.can_view_manager === true) {
      return [
        '69a38aea-61ab-4d48-8d3d-1b3a9f78360a',
        '8734320f-991f-479f-bba8-9d4af261856e',
      ]
    }
    return ['69a38aea-61ab-4d48-8d3d-1b3a9f78360a']
  }, [user])

  // Queries
  const firmId = (user as any)?.firm_id?.firm_id || (user as any)?.firm_id

  // 1. All users of firm (for modals and templates)
  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['all_users_for_payslip_report', firmId],
    queryFn: async () => {
      const response: any = await rdk.request(
        customEndpoint({
          path: 'users',
          method: 'GET',
          params: {
            limit: -1,
            fields: ['*', 'employee_category_id.*', 'other_category_ids.*'],
          },
        }),
      )
      const data = response?.data || response || []
      return Array.isArray(data) ? data : []
    },
    enabled: !!firmId,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  })

  // 2. Categories
  const { data: categoryList = [] } = useQuery<EmployeeCategory[]>({
    queryKey: ['employee_categories_for_payroll'],
    queryFn: async () => {
      const res: any = await rdk.request(readItems('employee_category', { limit: -1 }))
      if (Array.isArray(res)) return res
      if (Array.isArray(res?.data)) return res.data
      return []
    },
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  })

  // 3. Payroll Templates
  const { data: payrollTemplates = [] } = useQuery<PayrollTemplate[]>({
    queryKey: ['payroll_templates_payroll_list'],
    queryFn: async () => {
      const res: any = await rdk.request(
        readItems('payroll_templates', { limit: -1, sort: ['payroll_template_name'] }),
      )
      if (Array.isArray(res)) return res
      if (Array.isArray(res?.data)) return res.data
      return []
    },
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  })

  // 4. Main Salary Query
  const {
    data: allEmpSalaryData,
    isLoading: empWithSalaryLoading,
    isFetching: fetchingSalary,
    refetch: refetchSalary,
  } = useQuery({
    queryKey: ['all-employee-salary', selectedMonth, selectedYear, firmId],
    queryFn: async () => {
      if (!firmId) return { results: [] }
      const res: any = await rdk.request(
        customEndpoint({
          path: `api/all_employee_salary/${selectedYear}-${selectedMonth}/${firmId}`,
          method: 'GET',
        }),
      )
      return res || { results: [] }
    },
    enabled: !!firmId && !!selectedMonth && !!selectedYear,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
  })

  const isArchivedDateExist = useCallback(
    (date?: string) => {
      if (!date) return false
      const inDate = new Date(date)
      if (isNaN(inDate.getTime())) return false
      const inMonth = String(inDate.getMonth() + 1).padStart(2, '0')
      const inYear = String(inDate.getFullYear())
      return inMonth === selectedMonth && inYear === selectedYear
    },
    [selectedMonth, selectedYear],
  )

  const activeEmpSalaries = useMemo(() => {
    const list: EmployeeSalaryResult[] = allEmpSalaryData?.results || []
    return list.filter((item) => {
      const emp = item.employee
      if (!emp) return false

      const status = String(emp.status || emp.emp_status || '').toLowerCase().trim()
      const isInactive =
        status === 'archived' ||
        status === 'deleted' ||
        status === 'suspended' ||
        status === 'inactive'

      if (isInactive && !isArchivedDateExist(emp.inactive_date)) return false

      const roleId = getEmployeeRoleId(emp)
      const hasRoleAccess = !roleId || allowedRoles.includes(String(roleId))
      if (!hasRoleAccess) return false

      if (isRestrictedUser && allowedCategoryIds.length > 0) {
        const empCatId =
          (emp.employee_category_id as any)?.employee_category_id || emp.employee_category_id
        if (empCatId && !allowedCategoryIds.includes(String(empCatId))) return false
      }

      return true
    })
  }, [allEmpSalaryData, isArchivedDateExist, allowedRoles, isRestrictedUser, allowedCategoryIds])

  // Filtered & Sorted Data
  const filteredData = useMemo(() => {
    let result = [...activeEmpSalaries]

    if (selectedCategoryTab !== 'all') {
      result = result.filter((item) => {
        const catId =
          (item.employee?.employee_category_id as any)?.employee_category_id ||
          item.employee?.employee_category_id
        return String(catId) === String(selectedCategoryTab)
      })
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter((item) => {
        const first = (item.employee?.first_name || '').toLowerCase()
        const last = (item.employee?.last_name || '').toLowerCase()
        const code = (item.employee?.employee_code || '').toLowerCase()
        const title = (item.employee?.title || '').toLowerCase()
        return (
          first.includes(q) ||
          last.includes(q) ||
          `${first} ${last}`.includes(q) ||
          code.includes(q) ||
          title.includes(q)
        )
      })
    }

    result.sort((a, b) => {
      if (sortSelected === 'name asc') {
        const nameA = `${a.employee?.first_name || ''} ${a.employee?.last_name || ''}`.trim()
        const nameB = `${b.employee?.first_name || ''} ${b.employee?.last_name || ''}`.trim()
        return nameA.localeCompare(nameB)
      }
      if (sortSelected === 'name desc') {
        const nameA = `${a.employee?.first_name || ''} ${a.employee?.last_name || ''}`.trim()
        const nameB = `${b.employee?.first_name || ''} ${b.employee?.last_name || ''}`.trim()
        return nameB.localeCompare(nameA)
      }
      if (sortSelected === 'netPay desc') {
        return (b.salary?.net_payable || 0) - (a.salary?.net_payable || 0)
      }
      if (sortSelected === 'netPay asc') {
        return (a.salary?.net_payable || 0) - (b.salary?.net_payable || 0)
      }
      if (sortSelected === 'ctc desc') {
        return (b.salary?.ctc || 0) - (a.salary?.ctc || 0)
      }
      return 0
    })

    return result
  }, [activeEmpSalaries, selectedCategoryTab, search, sortSelected])

  // Pagination
  const totalItems = filteredData.length
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const paginatedData = useMemo(() => {
    const start = (page - 1) * itemsPerPage
    return filteredData.slice(start, start + itemsPerPage)
  }, [filteredData, page, itemsPerPage])

  // Selection handlers
  const handleSelectAllRows = (checked: boolean) => {
    if (checked) {
      setSelectedRowIds(filteredData.map((d) => String(d.employee.id)))
    } else {
      setSelectedRowIds([])
    }
  }

  const handleRowCheckbox = (id: string, checked: boolean) => {
    setSelectedRowIds((prev) => (checked ? [...prev, id] : prev.filter((i) => i !== id)))
  }

  // Assign template mutation
  const assignTemplateMutation = useMutation({
    mutationFn: async ({ employeeIds, templateId }: { employeeIds: string[]; templateId: number }) => {
      const promises = employeeIds.map((id) =>
        rdk.request(
          customEndpoint({
            path: `users/${id}`,
            method: 'PATCH',
            body: JSON.stringify({
              payroll_template_id: templateId,
            }),
          }),
        ),
      )
      return await Promise.all(promises)
    },
    onSuccess: () => {
      toast.success('Payroll template assigned successfully!')
      setSelectedRowIds([])
      queryClient.invalidateQueries({ queryKey: ['all-employee-salary'] })
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to assign payroll template')
    },
  })

  // Resizable Columns configuration
  const INITIAL_COL_WIDTHS = {
    employee: 240,
    status: 95,
    empCode: 110,
    designation: 140,
    doj: 110,
    payType: 95,
    template: 150,
    rate: 120,
    totalHours: 120,
    monthlyCtc: 120,
    basicPay: 110,
    grossEarnings: 120,
    totalBenefits: 110,
    totalDeductions: 110,
    netPayable: 130,
  }

  const { colWidths, isResizing, startResizing } = useResizableColumns(INITIAL_COL_WIDTHS, {
    storageKey: 'payslip_list_table_v2',
    minWidth: 70,
  })

  const isAllSelected = filteredData.length > 0 && selectedRowIds.length === filteredData.length

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel
        className={cn(
          'flex min-w-0 flex-1 flex-col h-full overflow-hidden',
          firstTabActive && 'rounded-tl-none',
        )}
      >
        {/* 1. Header Bar matching Clients / Tasks design */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5 bg-background/50">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Coins className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-foreground">
                  Payslip List
                </h1>
                <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-medium">
                  {filteredData.length} Total
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                View monthly employee attendance, calculations, assign templates, and export sheets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Month & Year Picker Popover with shadcn Select */}
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 cursor-pointer text-xs font-medium border-border hover:bg-muted"
                >
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <span>
                    Month: {displayMonthName} {selectedYear}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-3.5 shadow-xl space-y-3">
                <div className="text-xs font-bold text-foreground">Select Month &amp; Year</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">Month</span>
                    <Select
                      value={selectedMonth}
                      onValueChange={(val) => {
                        setSelectedMonth(val)
                        setPage(1)
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {months.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">Year</span>
                    <Select
                      value={selectedYear}
                      onValueChange={(val) => {
                        setSelectedYear(val)
                        setPage(1)
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
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

                <Button
                  size="sm"
                  onClick={() => setDatePopoverOpen(false)}
                  className="w-full h-7.5 text-xs font-medium cursor-pointer"
                >
                  Apply
                </Button>
              </PopoverContent>
            </Popover>

            {/* Generate Payslip Report (Excel) Button */}
            <Button
              size="sm"
              onClick={() => setReportModalOpen(true)}
              className="h-8 gap-1.5 cursor-pointer text-xs font-medium shadow-xs"
            >
              <FileSpreadsheet className="size-3.5" />
              <span>Generate Payslip Report (Excel)</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetchSalary()}
              className="size-8 cursor-pointer text-muted-foreground hover:text-foreground rounded-lg"
              title="Refresh list"
            >
              <RefreshCw className={cn('size-3.5', fetchingSalary && 'animate-spin text-primary')} />
            </Button>
          </div>
        </div>

        {/* 2. Bulk Action Banner (matching Tasks.tsx / Clients.tsx) */}
        {selectedRowIds.length > 0 && (
          <div className="flex shrink-0 items-center justify-between border-b border-primary/20 bg-primary/5 px-5 py-2 duration-150 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium text-foreground">
                <strong className="font-semibold text-primary">{selectedRowIds.length}</strong>{' '}
                employee{selectedRowIds.length > 1 ? 's' : ''} selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Assign Template:</span>
              <Select
                onValueChange={(val) => {
                  if (val) {
                    assignTemplateMutation.mutate({
                      employeeIds: selectedRowIds,
                      templateId: Number(val),
                    })
                  }
                }}
              >
                <SelectTrigger className="h-7.5 w-52 text-xs bg-background">
                  <SelectValue placeholder="Choose template..." />
                </SelectTrigger>
                <SelectContent>
                  {payrollTemplates.map((t) => (
                    <SelectItem key={t.payroll_template_id} value={String(t.payroll_template_id)}>
                      {t.payroll_template_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRowIds([])}
                className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* 3. Toolbar: Category Chips & Search/Sort */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-2.5 bg-card/60 shrink-0">
          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full sm:max-w-[60%]">
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryTab('all')
                setPage(1)
              }}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors whitespace-nowrap',
                selectedCategoryTab === 'all'
                  ? 'bg-foreground text-background font-semibold shadow-2xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              All
            </button>
            {categoryList.map((cat) => {
              const isSelected = String(selectedCategoryTab) === String(cat.employee_category_id)
              return (
                <button
                  key={cat.employee_category_id}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryTab(cat.employee_category_id)
                    setPage(1)
                  }}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors whitespace-nowrap',
                    isSelected
                      ? 'bg-foreground text-background font-semibold shadow-2xs'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {cat.employee_category_name}
                </button>
              )
            })}
          </div>

          {/* Search & Sort */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-[200px] sm:w-60">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employee name or code..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
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
                  Sort Employees By
                </div>
                {[
                  { key: 'name asc', label: 'Employee Name: A to Z' },
                  { key: 'name desc', label: 'Employee Name: Z to A' },
                  { key: 'netPay desc', label: 'Net Payable: High to Low' },
                  { key: 'netPay asc', label: 'Net Payable: Low to High' },
                  { key: 'ctc desc', label: 'Monthly CTC: High to Low' },
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
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check className="size-3.5 text-primary" />}
                    </button>
                  )
                })}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* 4. Main Spreadsheet Grid Table (matching Tasks & Clients border and sticky styling) */}
        <div className="flex-1 min-h-0 overflow-auto bg-card">
          <table className="w-full border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-20 bg-card shadow-2xs">
              <tr className="text-muted-foreground font-semibold">
                {/* Sticky Checkbox Column */}
                <th className="sticky left-0 top-0 z-30 bg-card py-2.5 px-3 w-10 text-center border-t border-b border-l border-r border-gray-200 dark:border-border shadow-[1px_0_0_0_rgba(0,0,0,0.06)]">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={(checked) => handleSelectAllRows(Boolean(checked))}
                      aria-label="Select all"
                    />
                  </div>
                </th>

                {/* Sticky Employee Name & Avatar */}
                <th
                  style={{ width: colWidths.employee, minWidth: colWidths.employee }}
                  className="sticky left-10 top-0 z-30 bg-card py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border select-none shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.4)]"
                >
                  <span>EMPLOYEE</span>
                  <ColumnResizer
                    isResizing={isResizing === 'employee'}
                    onMouseDown={(e) => startResizing('employee', e)}
                  />
                </th>

                <th
                  style={{ width: colWidths.status, minWidth: colWidths.status }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border select-none"
                >
                  <span>STATUS</span>
                  <ColumnResizer
                    isResizing={isResizing === 'status'}
                    onMouseDown={(e) => startResizing('status', e)}
                  />
                </th>

                <th
                  style={{ width: colWidths.empCode, minWidth: colWidths.empCode }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border select-none"
                >
                  <span>EMP ID</span>
                  <ColumnResizer
                    isResizing={isResizing === 'empCode'}
                    onMouseDown={(e) => startResizing('empCode', e)}
                  />
                </th>

                <th
                  style={{ width: colWidths.designation, minWidth: colWidths.designation }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border select-none"
                >
                  <span>DESIGNATION</span>
                  <ColumnResizer
                    isResizing={isResizing === 'designation'}
                    onMouseDown={(e) => startResizing('designation', e)}
                  />
                </th>

                <th
                  style={{ width: colWidths.doj, minWidth: colWidths.doj }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border select-none"
                >
                  <span>DOJ</span>
                  <ColumnResizer
                    isResizing={isResizing === 'doj'}
                    onMouseDown={(e) => startResizing('doj', e)}
                  />
                </th>

                <th
                  style={{ width: colWidths.payType, minWidth: colWidths.payType }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border select-none"
                >
                  <span>PAY TYPE</span>
                  <ColumnResizer
                    isResizing={isResizing === 'payType'}
                    onMouseDown={(e) => startResizing('payType', e)}
                  />
                </th>

                <th
                  style={{ width: colWidths.template, minWidth: colWidths.template }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border select-none"
                >
                  <span>TEMPLATE</span>
                  <ColumnResizer
                    isResizing={isResizing === 'template'}
                    onMouseDown={(e) => startResizing('template', e)}
                  />
                </th>

                <th
                  style={{ width: colWidths.rate, minWidth: colWidths.rate }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border select-none"
                >
                  <span>RATE</span>
                  <ColumnResizer
                    isResizing={isResizing === 'rate'}
                    onMouseDown={(e) => startResizing('rate', e)}
                  />
                </th>

                <th
                  style={{ width: colWidths.totalHours, minWidth: colWidths.totalHours }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border select-none"
                >
                  <span>HOURS WORKED</span>
                  <ColumnResizer
                    isResizing={isResizing === 'totalHours'}
                    onMouseDown={(e) => startResizing('totalHours', e)}
                  />
                </th>

                <th
                  style={{ width: colWidths.monthlyCtc, minWidth: colWidths.monthlyCtc }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border select-none text-right"
                >
                  <span>MONTHLY CTC</span>
                  <ColumnResizer
                    isResizing={isResizing === 'monthlyCtc'}
                    onMouseDown={(e) => startResizing('monthlyCtc', e)}
                  />
                </th>

                <th
                  style={{ width: colWidths.basicPay, minWidth: colWidths.basicPay }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border select-none text-right"
                >
                  <span>BASIC PAY</span>
                  <ColumnResizer
                    isResizing={isResizing === 'basicPay'}
                    onMouseDown={(e) => startResizing('basicPay', e)}
                  />
                </th>

                <th
                  style={{ width: colWidths.grossEarnings, minWidth: colWidths.grossEarnings }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border select-none text-right"
                >
                  <span>GROSS EARNINGS</span>
                  <ColumnResizer
                    isResizing={isResizing === 'grossEarnings'}
                    onMouseDown={(e) => startResizing('grossEarnings', e)}
                  />
                </th>

                <th
                  style={{ width: colWidths.totalBenefits, minWidth: colWidths.totalBenefits }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border select-none text-right"
                >
                  <span>BENEFITS</span>
                  <ColumnResizer
                    isResizing={isResizing === 'totalBenefits'}
                    onMouseDown={(e) => startResizing('totalBenefits', e)}
                  />
                </th>

                <th
                  style={{ width: colWidths.totalDeductions, minWidth: colWidths.totalDeductions }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border select-none text-right"
                >
                  <span>DEDUCTIONS</span>
                  <ColumnResizer
                    isResizing={isResizing === 'totalDeductions'}
                    onMouseDown={(e) => startResizing('totalDeductions', e)}
                  />
                </th>

                <th
                  style={{ width: colWidths.netPayable, minWidth: colWidths.netPayable }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border select-none text-right"
                >
                  <span>NET PAYABLE</span>
                  <ColumnResizer
                    isResizing={isResizing === 'netPayable'}
                    onMouseDown={(e) => startResizing('netPayable', e)}
                  />
                </th>
              </tr>
            </thead>

            <tbody>
              {empWithSalaryLoading ? (
                <tr>
                  <td
                    colSpan={16}
                    className="py-16 text-center text-muted-foreground border-b border-l border-r border-gray-200 dark:border-border"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="size-6 animate-spin text-primary" />
                      <span className="text-sm font-medium">
                        Loading payslips for {displayMonthName} {selectedYear}...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={16}
                    className="py-16 text-center text-muted-foreground border-b border-l border-r border-gray-200 dark:border-border"
                  >
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <AlertCircle className="size-6 text-muted-foreground/60" />
                      <span className="text-sm font-medium text-foreground">
                        No payslip records found
                      </span>
                      <span className="text-xs">
                        No payslip data found for {displayMonthName} {selectedYear}.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => {
                  const emp = item.employee
                  const sal = item.salary
                  const isSelected = selectedRowIds.includes(String(emp.id))
                  const status = String(emp.status || emp.emp_status || '').toLowerCase()
                  const isActive = status === 'active'

                  const templateName = (() => {
                    const t = emp.payroll_template_id
                    if (!t) return '...'
                    if (typeof t === 'object') return t.payroll_template_name || '...'
                    const match = payrollTemplates.find(
                      (tmp) => Number(tmp.payroll_template_id) === Number(t),
                    )
                    return match ? match.payroll_template_name : '...'
                  })()

                  const rateDisplay = (() => {
                    const pType = String(sal.pay_type || '').toLowerCase()
                    if (pType === 'hourly') {
                      return sal.hourly_salary ? `${formatCurrency(sal.hourly_salary)}/hr` : '-'
                    }
                    if (pType === 'daily') {
                      return sal.daily_salary ? `${formatCurrency(sal.daily_salary)}/day` : '-'
                    }
                    if (pType === 'monthly') {
                      return sal.daily_salary ? `${formatCurrency(sal.daily_salary)}/day` : '-'
                    }
                    return '-'
                  })()

                  const hoursDisplay =
                    sal.total_hourly_data &&
                    typeof sal.total_hourly_data.hours_worked === 'number' &&
                    sal.total_hourly_data.hours_worked > 0
                      ? `${sal.total_hourly_data.hours_worked.toFixed(2)} hrs`
                      : '-'

                  return (
                    <tr
                      key={emp.id}
                      onClick={() => navigate(`/admin/payroll/${emp.id}`)}
                      className={cn(
                        'hover:bg-muted/40 transition-colors cursor-pointer group',
                        isSelected && 'bg-primary/5',
                      )}
                    >
                      {/* Checkbox */}
                      <td
                        onClick={(e) => e.stopPropagation()}
                        className="sticky left-0 z-10 bg-card group-hover:bg-muted/50 py-2.5 px-3 text-center border-b border-l border-r border-gray-200 dark:border-border shadow-[1px_0_0_0_rgba(0,0,0,0.06)]"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleRowCheckbox(String(emp.id), Boolean(checked))}
                          aria-label={`Select ${emp.first_name}`}
                        />
                      </td>

                      {/* Frozen Employee Column */}
                      <td className="sticky left-10 z-10 bg-card group-hover:bg-muted/50 py-2.5 px-3 border-b border-r border-gray-200 dark:border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.4)]">
                        <div className="flex items-center gap-2.5">
                          <div className="size-7 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0 border border-border">
                            {emp.avatar ? (
                              <img
                                src={`${ATTENDANCE_SERVER_URL}/assets/${emp.avatar}`}
                                alt=""
                                className="size-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                {(emp.first_name || 'U')[0]}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground truncate block">
                              {emp.first_name || ''} {emp.last_name || ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-medium px-2 py-0.5 rounded-full capitalize',
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400',
                          )}
                        >
                          {isActive ? 'active' : status || 'archived'}
                        </Badge>
                      </td>

                      {/* Emp Code */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border font-mono text-[11px] text-muted-foreground">
                        {emp.employee_code || '-'}
                      </td>

                      {/* Designation */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border truncate max-w-[140px] text-muted-foreground">
                        {emp.title || '-'}
                      </td>

                      {/* DOJ */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border text-muted-foreground whitespace-nowrap">
                        {emp.doj || '-'}
                      </td>

                      {/* Pay Type */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border capitalize text-foreground font-medium">
                        {sal.pay_type || '-'}
                      </td>

                      {/* Payroll Template */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border truncate max-w-[150px] text-muted-foreground">
                        {templateName}
                      </td>

                      {/* Rate */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border text-muted-foreground whitespace-nowrap">
                        {rateDisplay}
                      </td>

                      {/* Total Hours Worked */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border text-muted-foreground whitespace-nowrap">
                        {hoursDisplay}
                      </td>

                      {/* Monthly CTC */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border text-right text-muted-foreground font-medium">
                        {sal.pay_type?.toLowerCase() === 'hourly' ? '-' : formatCurrency(sal.ctc)}
                      </td>

                      {/* Basic Pay */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border text-right text-muted-foreground font-medium">
                        {sal.pay_type?.toLowerCase() === 'hourly'
                          ? '-'
                          : formatCurrency(sal.basic_salary)}
                      </td>

                      {/* Gross Earnings */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(sal.regular_earnings)}
                      </td>

                      {/* Total Benefits */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {sal.total_benefits ? `+ ${formatCurrency(sal.total_benefits)}` : '-'}
                      </td>

                      {/* Total Deductions */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border text-right font-medium text-rose-600 dark:text-rose-400">
                        {sal.total_deductions ? `- ${formatCurrency(sal.total_deductions)}` : '-'}
                      </td>

                      {/* Net Payable */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border text-right font-bold text-foreground">
                        {formatCurrency(sal.net_payable)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Sticky Bottom Pagination (matching Tasks.tsx / Clients.tsx) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-2.5 bg-card text-xs text-muted-foreground shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Show</span>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(val) => {
                setItemsPerPage(Number(val))
                setPage(1)
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
              per page • {filteredData.length} records
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="size-7 cursor-pointer"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="size-7 cursor-pointer"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* 6. Payslip Report Export Modal */}
        <PayslipReportModal
          open={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          user={user}
          allUsers={allUsers}
          usersLoading={usersLoading}
          categoryList={categoryList}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          months={months}
          years={years}
          allEmpSalaryResults={allEmpSalaryData?.results || []}
          isRestrictedUser={isRestrictedUser}
          allowedCategoryIds={allowedCategoryIds}
          allowedRolesForModal={allowedRolesForModal}
        />
      </Panel>
    </div>
  )
}
