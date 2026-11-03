import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Save,
  FileText,
  Phone,
  Mail,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Loader2,
  User,
  Building,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import Panel from '@/components/admin/Panel'
import { useShell } from '@/components/admin/shell-context'
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
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import rdk, {
  ATTENDANCE_SERVER_URL,
  customEndpoint,
  readItems,
} from '@/services/server'
import { useAuth } from '@/context/auth/AuthContext'
import { generatePayslip } from './utils/generatePayslip'
import type { PayrollTemplate, PayrollHead } from './types'

const formatCurrency = (amount: number | string | null | undefined): string => {
  if (amount === null || amount === undefined) return '₹0.00'
  const num = Number(amount)
  if (isNaN(num)) return '₹0.00'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(num)
}

const extractPhoneNumber = (email?: string) => {
  if (!email) return ''
  return email.replace('91', '').split('@')[0]
}

const formatDateOnly = (dateString?: string) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export default function EmployeeSalaryConfig() {
  const { userid, id } = useParams()
  const employeeId = userid || id
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const shell = useShell()
  const firstTabActive = shell?.firstTabActive ?? false

  const [saving, setSaving] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  // Month & Year state
  const currentDate = new Date()
  const prevMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
  const [selectedMonth, setSelectedMonth] = useState(
    String(prevMonthDate.getMonth() + 1).padStart(2, '0'),
  )
  const [selectedYear, setSelectedYear] = useState(String(prevMonthDate.getFullYear()))

  // Form states
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [payType, setPayType] = useState<string>('Monthly')
  const [salaryAmount, setSalaryAmount] = useState<number | string>(0)
  const [salaryDecimal, setSalaryDecimal] = useState<number | string>(0)

  // Accordions for Benefits & Deductions
  const [openBenefits, setOpenBenefits] = useState(true)
  const [openDeductions, setOpenDeductions] = useState(true)
  const [selectedBenefits, setSelectedBenefits] = useState<number[]>([])
  const [selectedDeductions, setSelectedDeductions] = useState<number[]>([])

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

  // 1. Fetch Employee Details
  const { data: empData } = useQuery({
    queryKey: ['empDetails', employeeId],
    queryFn: async () => {
      if (!employeeId) return null
      const res: any = await rdk.request(
        customEndpoint({
          path: `users/${employeeId}`,
          method: 'GET',
          params: {
            fields: [
              '*',
              'employee_category_id.*',
              'payroll_template_id',
              'salary_per_month',
              'salary_per_month_after_decimal',
              'pay_type',
              'payroll_heads.payroll_heads_payroll_head_id.*',
            ],
          },
        }),
      )
      return res?.data || res || null
    },
    enabled: !!employeeId,
  })

  // 2. Fetch Payroll Templates
  const { data: payrollTemplatesData, isLoading: loadingTemplates } = useQuery<PayrollTemplate[]>({
    queryKey: ['payroll_templates_for_config'],
    queryFn: async () => {
      const res: any = await rdk.request(
        readItems('payroll_templates', {
          fields: ['*'],
          sort: ['payroll_template_name'],
          limit: -1,
        }),
      )
      if (Array.isArray(res)) return res
      if (Array.isArray(res?.data)) return res.data
      return []
    },
  })
  const payrollTemplates = useMemo(() => payrollTemplatesData || [], [payrollTemplatesData])

  // 3. Fetch All Benefits
  const { data: allBenefitsData } = useQuery<PayrollHead[]>({
    queryKey: ['all-benefits-heads'],
    queryFn: async () => {
      const res: any = await rdk.request(
        readItems('payroll_heads', {
          filter: { payroll_type: { _eq: 'benefit' } },
          limit: -1,
        }),
      )
      if (Array.isArray(res)) return res
      if (Array.isArray(res?.data)) return res.data
      return []
    },
  })
  const allBenefits = useMemo(() => allBenefitsData || [], [allBenefitsData])

  // 4. Fetch All Deductions
  const { data: allDeductionsData } = useQuery<PayrollHead[]>({
    queryKey: ['all-deductions-heads'],
    queryFn: async () => {
      const res: any = await rdk.request(
        readItems('payroll_heads', {
          filter: { payroll_type: { _eq: 'deduction' } },
          limit: -1,
        }),
      )
      if (Array.isArray(res)) return res
      if (Array.isArray(res?.data)) return res.data
      return []
    },
  })
  const allDeductions = useMemo(() => allDeductionsData || [], [allDeductionsData])

  // 5. Fetch Template's Default Heads when selectedTemplateId changes
  const { data: templatePayrollHeadsData } = useQuery({
    queryKey: ['templatePayrollHeads', selectedTemplateId],
    queryFn: async () => {
      if (!selectedTemplateId) return []
      const res: any = await rdk.request(
        readItems('payroll_heads', {
          filter: { payroll_template_id: { _eq: +selectedTemplateId } },
          limit: -1,
        }),
      )
      if (Array.isArray(res)) return res
      if (Array.isArray(res?.data)) return res.data
      return []
    },
    enabled: !!selectedTemplateId,
  })
  const templatePayrollHeads = useMemo(
    () => templatePayrollHeadsData || [],
    [templatePayrollHeadsData],
  )

  // 6. Fetch Calculated Salary for selected Month & Year
  const firmId = (user as any)?.firm_id?.firm_id || (user as any)?.firm_id
  const {
    data: userSalary,
    isLoading: salaryLoading,
  } = useQuery({
    queryKey: ['user-salary', selectedMonth, selectedYear, employeeId, firmId],
    queryFn: async () => {
      if (!employeeId || !firmId) return null
      const res: any = await rdk.request(
        customEndpoint({
          path: `api/employee_salary/${selectedYear}-${selectedMonth}/${employeeId}/${firmId}`,
          method: 'GET',
        }),
      )
      return res || null
    },
    enabled: !!employeeId && !!firmId && !!selectedMonth && !!selectedYear,
  })

  // Sync Form Defaults on employee fetch (only when employee ID changes or first loads)
  useEffect(() => {
    if (empData) {
      setSelectedTemplateId(
        empData.payroll_template_id ? String(empData.payroll_template_id) : '',
      )
      setSalaryAmount(empData.salary_per_month ?? 0)
      setSalaryDecimal(empData.salary_per_month_after_decimal ?? 0)
      setPayType(empData.pay_type || 'Monthly')
    }
  }, [empData?.id])

  // Sync Benefits and Deductions according to v1 Core Logic
  useEffect(() => {
    if (!empData || allBenefits.length === 0 || allDeductions.length === 0) return

    const employeeHeadIds: number[] =
      empData.payroll_heads
        ?.map((item: any) => item.payroll_heads_payroll_head_id?.payroll_head_id)
        .filter((hId: any) => hId !== undefined && hId !== null) || []

    const templateHeadIds: number[] =
      templatePayrollHeads?.map((item: any) => item.payroll_head_id) || []

    const isTemplateUnchanged = String(empData.payroll_template_id) === selectedTemplateId
    const initialSelectionIds = isTemplateUnchanged ? employeeHeadIds : templateHeadIds

    const allBenefitIds = new Set(allBenefits.map((b) => b.payroll_head_id))
    const allDeductionIds = new Set(allDeductions.map((d) => d.payroll_head_id))

    const newBenefits = initialSelectionIds.filter((hId: number) => allBenefitIds.has(hId))
    const newDeductions = initialSelectionIds.filter((hId: number) => allDeductionIds.has(hId))

    setSelectedBenefits((prev) => {
      if (
        prev.length === newBenefits.length &&
        prev.every((id) => newBenefits.includes(id))
      ) {
        return prev
      }
      return newBenefits
    })

    setSelectedDeductions((prev) => {
      if (
        prev.length === newDeductions.length &&
        prev.every((id) => newDeductions.includes(id))
      ) {
        return prev
      }
      return newDeductions
    })
  }, [
    empData?.id,
    empData?.payroll_template_id,
    allBenefits,
    allDeductions,
    templatePayrollHeads,
    selectedTemplateId,
  ])

  // Save changes handler
  const handleSaveChanges = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!employeeId) return

    setSaving(true)
    const toastId = toast.loading('Saving salary configuration...')

    try {
      const allSelectedHeadIds = [...selectedBenefits, ...selectedDeductions]
      const payrollHeadsPayload = allSelectedHeadIds.map((hId) => ({
        payroll_heads_payroll_head_id: {
          payroll_head_id: hId,
        },
      }))

      const updatePayload = {
        payroll_template_id: selectedTemplateId ? +selectedTemplateId : null,
        pay_type: payType,
        salary_per_month: Number(salaryAmount),
        salary_per_month_after_decimal: Number(salaryDecimal),
        payroll_heads: payrollHeadsPayload,
      }

      await rdk.request(
        customEndpoint({
          path: `users/${employeeId}`,
          method: 'PATCH',
          body: JSON.stringify(updatePayload),
        }),
      )

      toast.success('Changes saved successfully!', { id: toastId })
      queryClient.invalidateQueries({ queryKey: ['empDetails', employeeId] })
      queryClient.invalidateQueries({
        queryKey: ['user-salary', selectedMonth, selectedYear, employeeId],
      })
      queryClient.invalidateQueries({ queryKey: ['all-employee-salary'] })
    } catch (err: any) {
      console.error('Save error:', err)
      toast.error(err?.message || 'Failed to save changes.', { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  // Generate Payslip PDF trigger
  const handleGeneratePayslip = () => {
    if (!userSalary) {
      toast.error('No salary details available for this month')
      return
    }

    const staffSummary = {
      name: `${empData?.first_name || ''} ${empData?.last_name || ''}`.trim() || 'Employee',
      designation: empData?.title || '-',
      employee_code: empData?.employee_code || '-',
      doj: empData?.doj ? formatDateOnly(empData.doj) : '-',
      pan: empData?.pan_number || '-',
      esi_no: empData?.esi_no || '-',
      pf_no: empData?.pf_no || '-',
      uan: empData?.uan || '-',
      week_off_payment: empData?.week_off_payment,
      week_off_as_overtime: empData?.week_off_as_overtime,
      holiday_extra_payment: empData?.holiday_extra_payment,
      holiday_as_overtime: empData?.holiday_as_overtime,
    }

    generatePayslip(
      userSalary,
      selectedMonth,
      selectedYear,
      user,
      staffSummary,
      () => setGeneratingPdf(true),
      () => setGeneratingPdf(false),
    )
  }

  const isWeekOffPaymentEnabled = empData?.week_off_payment || userSalary?.week_off_payment
  const isWeekOffAsOvertimeEnabled = empData?.week_off_as_overtime || userSalary?.week_off_as_overtime
  const isHolidayPaymentEnabled =
    empData?.holiday_extra_payment ||
    userSalary?.holiday_extra_payment ||
    userSalary?.total_holiday_earnings > 0
  const isHolidayAsOvertimeEnabled =
    empData?.holiday_as_overtime ||
    userSalary?.holiday_as_overtime ||
    userSalary?.total_holiday_overtime?.total_amount > 0

  return (
    <Panel
      className={cn(
        'flex min-w-0 flex-1 flex-col h-full overflow-hidden',
        firstTabActive && 'rounded-tl-none',
      )}
    >
      {/* 1. Header with Back button & Save Changes */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/payroll')}
            className="size-8 cursor-pointer rounded-lg text-muted-foreground hover:text-foreground"
            title="Back to Payslip List"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Employee Salary Configuration
            </h1>
            <p className="text-xs text-muted-foreground">
              Configure payroll heads, salary rates, view attendance breakdown, and generate payslips.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => handleSaveChanges()}
            disabled={saving || !employeeId}
            className="h-8 gap-2 cursor-pointer text-xs font-semibold shadow-xs"
          >
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 2. Main Two-Column Layout */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 max-w-7xl mx-auto">
          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-5">
            {/* Employee Profile Card */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col gap-4">
              <div className="flex items-center gap-3.5">
                <div className="size-14 rounded-2xl bg-muted flex items-center justify-center overflow-hidden shrink-0 border border-border">
                  {empData?.avatar ? (
                    <img
                      src={`${ATTENDANCE_SERVER_URL}/assets/${empData.avatar}`}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-bold text-muted-foreground uppercase">
                      {(empData?.first_name || 'U')[0]}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-foreground truncate">
                    {`${empData?.first_name || ''} ${empData?.last_name || ''}`.trim() ||
                      'Employee Details'}
                  </h2>
                  <p className="text-xs text-muted-foreground truncate">
                    {empData?.title || 'No Designation Assigned'}
                  </p>
                </div>
              </div>

              {/* Core Attributes */}
              <div className="border border-dashed border-border rounded-xl p-3 flex flex-col gap-2 text-xs bg-muted/10">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <User className="size-3.5" />
                    <span>Employee Code:</span>
                  </span>
                  <span className="font-semibold text-foreground">
                    {empData?.employee_code || '-'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Briefcase className="size-3.5" />
                    <span>Designation:</span>
                  </span>
                  <span className="font-semibold text-foreground">{empData?.title || '-'}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Building className="size-3.5" />
                    <span>Department:</span>
                  </span>
                  <span className="font-semibold text-foreground">
                    {empData?.employee_category_id?.employee_category_name ||
                      empData?.department_name ||
                      '-'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Phone className="size-3.5" />
                    <span>Phone:</span>
                  </span>
                  <span className="font-semibold text-foreground">
                    {extractPhoneNumber(empData?.email) || '-'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Mail className="size-3.5" />
                    <span>Email:</span>
                  </span>
                  <span className="font-semibold text-foreground truncate max-w-[180px]">
                    {empData?.email || '-'}
                  </span>
                </div>
              </div>

              {/* Statutory & Joining Details */}
              <div className="border border-dashed border-border rounded-xl p-3 flex flex-col gap-2 text-xs bg-muted/10">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Date of Joining:</span>
                  <span className="font-semibold text-foreground">
                    {empData?.doj ? formatDateOnly(empData.doj) : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">PAN No:</span>
                  <span className="font-semibold text-foreground">
                    {empData?.pan_number || '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">UAN:</span>
                  <span className="font-semibold text-foreground">{empData?.uan || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">ESIC No:</span>
                  <span className="font-semibold text-foreground">{empData?.esi_no || '-'}</span>
                </div>
              </div>
            </div>

            {/* Attendance Summary Card */}
            {userSalary && (
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col gap-3">
                <div className="border border-dashed border-border p-2.5 rounded-xl bg-muted/20">
                  <h3 className="text-sm font-bold text-foreground">Attendance Summary</h3>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between p-2 rounded-lg bg-muted/20">
                    <span className="text-muted-foreground">Total Days:</span>
                    <span className="font-bold text-foreground">{userSalary.total_days ?? 0}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-muted/20">
                    <span className="text-muted-foreground">Present Days:</span>
                    <span className="font-bold text-foreground">
                      {(userSalary.present_days || 0) - (userSalary.half_days || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-muted/20">
                    <span className="text-muted-foreground">In Week Offs:</span>
                    <span className="font-bold text-foreground">
                      {userSalary.present_week_offs ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-muted/20">
                    <span className="text-muted-foreground">In Holidays:</span>
                    <span className="font-bold text-foreground">
                      {userSalary.present_holidays ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-muted/20">
                    <span className="text-muted-foreground">Absent Days:</span>
                    <span className="font-bold text-rose-600">
                      {userSalary.absent_days ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-muted/20">
                    <span className="text-muted-foreground">Half Days:</span>
                    <span className="font-bold text-foreground">{userSalary.half_days ?? 0}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-muted/20">
                    <span className="text-muted-foreground">Leave Days:</span>
                    <span className="font-bold text-foreground">{userSalary.leave_days ?? 0}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-muted/20">
                    <span className="text-muted-foreground">Holidays:</span>
                    <span className="font-bold text-foreground">{userSalary.holidays ?? 0}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-muted/20">
                    <span className="text-muted-foreground">Week Off:</span>
                    <span className="font-bold text-foreground">{userSalary.week_offs ?? 0}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-800">
                    <span>Payable Days:</span>
                    <span>{userSalary.payable_days ?? 0}</span>
                  </div>
                  {userSalary?.total_ot?.hours_worked > 0 && (
                    <div className="col-span-2 flex justify-between p-2 rounded-lg bg-muted/20">
                      <span className="text-muted-foreground">OT Hours:</span>
                      <span className="font-bold text-foreground">
                        {userSalary.total_ot.hours_worked.toFixed(2)} hrs
                      </span>
                    </div>
                  )}
                  {userSalary?.total_hourly_data?.hours_worked > 0 && (
                    <div className="col-span-2 flex justify-between p-2 rounded-lg bg-muted/20">
                      <span className="text-muted-foreground">Hours Worked:</span>
                      <span className="font-bold text-foreground">
                        {userSalary.total_hourly_data.hours_worked.toFixed(2)} hrs
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Hourly Insights Table (if applicable) */}
            {userSalary?.hourly_rates &&
              Object.keys(userSalary.hourly_rates).length > 0 &&
              (userSalary?.pay_type?.toLowerCase() === 'hourly') && (
                <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col gap-3">
                  <div className="border border-dashed border-border p-2.5 rounded-xl bg-muted/20">
                    <h3 className="text-sm font-bold text-foreground">Hourly Payments Insights</h3>
                  </div>
                  <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-muted text-muted-foreground font-semibold">
                        <tr>
                          <th className="p-2 border-b border-border">Date</th>
                          <th className="p-2 border-b border-border">Hours</th>
                          <th className="p-2 border-b border-border text-right">Daily Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {Object.entries(userSalary.hourly_rates).map(([date, hours]: any) => {
                          const rate = userSalary.hourly_salary || 0
                          const dailyTotal = hours * rate
                          return (
                            <tr key={date} className="hover:bg-muted/30">
                              <td className="p-2 text-muted-foreground">{date}</td>
                              <td className="p-2 font-medium">{hours} hrs</td>
                              <td className="p-2 text-right font-bold text-foreground">
                                {formatCurrency(dailyTotal)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            {/* Overtime Insights Table (if applicable) */}
            {userSalary?.over_time_data && Object.keys(userSalary.over_time_data).length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col gap-3">
                <div className="border border-dashed border-border p-2.5 rounded-xl bg-muted/20">
                  <h3 className="text-sm font-bold text-foreground">Overtime Payments Insights</h3>
                </div>
                <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-muted text-muted-foreground font-semibold">
                      <tr>
                        <th className="p-2 border-b border-border">Date</th>
                        <th className="p-2 border-b border-border">Hours</th>
                        <th className="p-2 border-b border-border text-right">Daily Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {Object.entries(userSalary.over_time_data).map(([date, hours]: any) => {
                        const rate = userSalary?.total_ot?.hourly_rate || 0
                        const dailyTotal = hours * rate
                        return (
                          <tr key={date} className="hover:bg-muted/30">
                            <td className="p-2 text-muted-foreground">{date}</td>
                            <td className="p-2 font-medium">{hours} hrs</td>
                            <td className="p-2 text-right font-bold text-foreground">
                              {formatCurrency(dailyTotal)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN: Configuration Form & Calculations ── */}
          <div className="flex flex-col gap-6">
            {/* Form Settings Card */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col gap-4">
              <form onSubmit={handleSaveChanges} className="flex flex-col gap-4">
                {/* Payroll Template Selector */}
                <div>
                  <label className="text-xs font-bold text-foreground mb-1.5 block">
                    Payroll Template
                  </label>
                  <Select
                    value={selectedTemplateId || '__none__'}
                    onValueChange={(val) => setSelectedTemplateId(val === '__none__' ? '' : val)}
                    disabled={loadingTemplates}
                  >
                    <SelectTrigger className="w-full h-9 text-xs bg-background">
                      <SelectValue placeholder="No template assigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No template assigned</SelectItem>
                      {payrollTemplates.map((t) => (
                        <SelectItem key={t.payroll_template_id} value={String(t.payroll_template_id)}>
                          {t.payroll_template_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Month & Year Selectors */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-foreground mb-1.5 block">Month</label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
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
                  </div>
                  <div>
                    <label className="text-xs font-bold text-foreground mb-1.5 block">Year</label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
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

                {/* Pay Type & Salary Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="text-xs font-bold text-foreground mb-1.5 block">Pay Type</label>
                    <Select value={payType} onValueChange={setPayType}>
                      <SelectTrigger className="w-full h-9 text-xs bg-background">
                        <SelectValue placeholder="Select pay type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                        <SelectItem value="Daily">Daily</SelectItem>
                        <SelectItem value="Hourly">Hourly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground mb-1.5 block">
                      {payType} Salary
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                        ₹
                      </span>
                      <Input
                        type="number"
                        min="0"
                        value={salaryAmount}
                        onChange={(e) => setSalaryAmount(e.target.value)}
                        className="pl-7 h-9 text-xs rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground mb-1.5 block">Decimal</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                        .
                      </span>
                      <Input
                        type="number"
                        min="0"
                        max="99"
                        value={salaryDecimal}
                        onChange={(e) => setSalaryDecimal(e.target.value)}
                        className="pl-6 h-9 text-xs rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </form>

              {/* Benefits Collapsible Accordion */}
              <div className="border border-border rounded-xl overflow-hidden mt-1">
                <button
                  type="button"
                  onClick={() => setOpenBenefits((prev) => !prev)}
                  className="w-full flex items-center justify-between p-3 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors text-xs font-bold text-foreground"
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-emerald-600" />
                    <span>Benefits ({selectedBenefits.length} selected)</span>
                  </div>
                  {openBenefits ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>

                {openBenefits && (
                  <div className="p-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                    {allBenefits.length === 0 ? (
                      <span className="text-xs text-muted-foreground col-span-2 py-2">
                        No benefit heads found.
                      </span>
                    ) : (
                      allBenefits.map((b) => {
                        const isChecked = selectedBenefits.includes(b.payroll_head_id)
                        return (
                          <label
                            key={b.payroll_head_id}
                            className={cn(
                              'flex items-start gap-2 p-2 rounded-lg border border-border text-xs cursor-pointer transition-colors hover:bg-muted/40',
                              isChecked && 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800',
                            )}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                const id = b.payroll_head_id
                                setSelectedBenefits((prev) =>
                                  checked ? [...prev, id] : prev.filter((i) => i !== id),
                                )
                              }}
                              className="mt-0.5 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <span className="font-semibold text-foreground block truncate">
                                {b.payroll_head_name}
                              </span>
                              <span className="text-[10px] text-muted-foreground block">
                                {b.payroll_value_type === 'fixed'
                                  ? `₹${b.payroll_value} Fixed Amount`
                                  : `${b.payroll_value}% of basic salary`}
                              </span>
                            </div>
                          </label>
                        )
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Deductions Collapsible Accordion */}
              <div className="border border-border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenDeductions((prev) => !prev)}
                  className="w-full flex items-center justify-between p-3 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors text-xs font-bold text-foreground"
                >
                  <div className="flex items-center gap-2">
                    <TrendingDown className="size-4 text-rose-600" />
                    <span>Deductions ({selectedDeductions.length} selected)</span>
                  </div>
                  {openDeductions ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>

                {openDeductions && (
                  <div className="p-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                    {allDeductions.length === 0 ? (
                      <span className="text-xs text-muted-foreground col-span-2 py-2">
                        No deduction heads found.
                      </span>
                    ) : (
                      allDeductions.map((d) => {
                        const isChecked = selectedDeductions.includes(d.payroll_head_id)
                        return (
                          <label
                            key={d.payroll_head_id}
                            className={cn(
                              'flex items-start gap-2 p-2 rounded-lg border border-border text-xs cursor-pointer transition-colors hover:bg-muted/40',
                              isChecked && 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800',
                            )}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                const id = d.payroll_head_id
                                setSelectedDeductions((prev) =>
                                  checked ? [...prev, id] : prev.filter((i) => i !== id),
                                )
                              }}
                              className="mt-0.5 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <span className="font-semibold text-foreground block truncate">
                                {d.payroll_head_name}
                              </span>
                              <span className="text-[10px] text-muted-foreground block">
                                {d.payroll_value_type === 'fixed'
                                  ? `₹${d.payroll_value} Fixed Amount`
                                  : `${d.payroll_value}% of basic salary`}
                              </span>
                            </div>
                          </label>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Salary Calculation & Breakdown Card */}
            {userSalary ? (
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col gap-5">
                {/* Salary Info Header & Generate Payslip Button */}
                <div className="flex items-center justify-between border border-dashed border-border p-3 rounded-xl bg-muted/20">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Salary Info</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Calculation breakdown for {months.find((m) => m.value === selectedMonth)?.label}{' '}
                      {selectedYear}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    onClick={handleGeneratePayslip}
                    disabled={generatingPdf}
                    className="h-8 gap-2 cursor-pointer text-xs font-semibold"
                  >
                    {generatingPdf ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="size-3.5" />
                        <span>Generate Payslip</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Summary Rate info */}
                {userSalary.pay_type?.toLowerCase() === 'hourly' ? (
                  <div className="grid grid-cols-2 gap-3 text-xs bg-muted/10 p-3 rounded-xl border border-border">
                    <div>
                      <span className="text-muted-foreground block">Pay Type</span>
                      <span className="font-bold text-foreground">{userSalary.pay_type}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Hourly Rate</span>
                      <span className="font-bold text-foreground">
                        {formatCurrency(userSalary.hourly_salary)}/hr
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-muted/10 p-3 rounded-xl border border-border">
                    <div>
                      <span className="text-muted-foreground block">Pay Type</span>
                      <span className="font-bold text-foreground">{userSalary.pay_type}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Monthly CTC</span>
                      <span className="font-bold text-foreground">{formatCurrency(userSalary.ctc)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Basic Salary</span>
                      <span className="font-bold text-foreground">
                        {formatCurrency(userSalary.basic_salary)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Daily Rate</span>
                      <span className="font-bold text-foreground">
                        {userSalary.daily_salary ? formatCurrency(userSalary.daily_salary) : '-'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Applied Benefits & Applied Deductions Subcards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Applied Benefits */}
                  <div className="border border-border rounded-xl p-4 flex flex-col gap-2.5 bg-muted/5">
                    <h4 className="text-xs font-bold text-foreground border-b border-border pb-1.5 flex items-center justify-between">
                      <span>Benefits Applied</span>
                      <span className="text-emerald-600 font-semibold">
                        {userSalary.benefits?.length || 0}
                      </span>
                    </h4>
                    {userSalary.benefits && userSalary.benefits.length > 0 ? (
                      <div className="flex flex-col gap-1.5 text-xs">
                        {userSalary.benefits.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center py-0.5">
                            <span className="text-muted-foreground truncate mr-2">
                              {item.payroll_head_name}
                            </span>
                            <span className="font-semibold text-emerald-600 whitespace-nowrap">
                              + {formatCurrency(item.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground py-2">No Benefits Applied</span>
                    )}
                  </div>

                  {/* Applied Deductions */}
                  <div className="border border-border rounded-xl p-4 flex flex-col gap-2.5 bg-muted/5">
                    <h4 className="text-xs font-bold text-foreground border-b border-border pb-1.5 flex items-center justify-between">
                      <span>Deductions Applied</span>
                      <span className="text-rose-600 font-semibold">
                        {userSalary.deductions?.length || 0}
                      </span>
                    </h4>
                    {userSalary.deductions && userSalary.deductions.length > 0 ? (
                      <div className="flex flex-col gap-1.5 text-xs">
                        {userSalary.deductions.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center py-0.5">
                            <span className="text-muted-foreground truncate mr-2">
                              {item.payroll_head_name}
                            </span>
                            <span className="font-semibold text-rose-600 whitespace-nowrap">
                              - {formatCurrency(item.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground py-2">
                        No Deductions Applied
                      </span>
                    )}
                  </div>
                </div>

                {/* Additional Heads: Loan EMI & Advances & Incentives */}
                {((userSalary.loans_emi && userSalary.loans_emi.length > 0) ||
                  (userSalary.payments_made && userSalary.payments_made.length > 0) ||
                  (userSalary.incentives && userSalary.incentives.length > 0)) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    {/* Loans */}
                    {userSalary.loans_emi && userSalary.loans_emi.length > 0 && (
                      <div className="border border-border rounded-xl p-3 bg-muted/5">
                        <span className="font-bold text-foreground block mb-1.5">Loan / EMI</span>
                        {userSalary.loans_emi.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between py-0.5">
                            <span className="text-muted-foreground truncate">
                              {item.is_emi ? `${item.loan_title} (EMI)` : item.loan_title}
                            </span>
                            <span className="font-semibold text-rose-600">
                              -{' '}
                              {formatCurrency(
                                item.is_emi ? item.emi_amount : item.loan_amount,
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Advances */}
                    {userSalary.payments_made && userSalary.payments_made.length > 0 && (
                      <div className="border border-border rounded-xl p-3 bg-muted/5">
                        <span className="font-bold text-foreground block mb-1.5">
                          Advance Payments
                        </span>
                        {userSalary.payments_made.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between py-0.5">
                            <span className="text-muted-foreground truncate">{item.remarks}</span>
                            <span className="font-semibold text-rose-600">
                              - {formatCurrency(item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Incentives */}
                    {userSalary.incentives && userSalary.incentives.length > 0 && (
                      <div className="border border-border rounded-xl p-3 bg-muted/5">
                        <span className="font-bold text-foreground block mb-1.5">Incentives</span>
                        {userSalary.incentives.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between py-0.5">
                            <span className="text-muted-foreground truncate">
                              {item.remarks || item.incentive_date}
                            </span>
                            <span className="font-semibold text-emerald-600">
                              + {formatCurrency(item.incentive_amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Calculations Formula Breakdown */}
                <div className="border border-border rounded-xl p-4 flex flex-col gap-2.5 text-xs bg-muted/5">
                  <h4 className="font-bold text-foreground border-b border-border pb-1.5">
                    Earnings &amp; Deductions Breakdown
                  </h4>

                  {/* Basic Salary */}
                  {userSalary?.pay_type?.toLowerCase() === 'hourly' ? (
                    <div className="flex justify-between items-center py-0.5">
                      <div>
                        <span className="font-medium text-foreground">Basic Salary</span>
                        <span className="text-[10px] text-muted-foreground block">
                          {userSalary?.total_hourly_data?.hours_worked?.toFixed(2)} hrs × ₹
                          {userSalary?.hourly_salary}/hr
                        </span>
                      </div>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(userSalary.total_hourly_data?.total_amount)}
                      </span>
                    </div>
                  ) : userSalary?.pay_type?.toLowerCase() === 'monthly' ? (
                    <div className="flex justify-between items-center py-0.5">
                      <div>
                        <span className="font-medium text-foreground">Basic Salary</span>
                        <span className="text-[10px] text-muted-foreground block">
                          {userSalary?.payable_days} days × ₹
                          {(
                            (userSalary?.basic_salary || 0) / (userSalary?.total_days || 1)
                          ).toFixed(2)}
                          /day
                        </span>
                      </div>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(
                          userSalary?.payable_days *
                            ((userSalary?.basic_salary || 0) / (userSalary?.total_days || 1)),
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center py-0.5">
                      <div>
                        <span className="font-medium text-foreground">Basic Salary</span>
                        <span className="text-[10px] text-muted-foreground block">
                          {userSalary?.payable_days} days × ₹{userSalary?.daily_salary}/day
                        </span>
                      </div>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(userSalary.regular_earnings)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-muted-foreground">Total Benefits:</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(
                        (userSalary?.total_other_benefits || 0) + (userSalary?.total_benefits || 0),
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-muted-foreground">Gross Earnings:</span>
                    <span className="font-semibold text-emerald-600">
                      + {formatCurrency(userSalary.regular_earnings)}
                    </span>
                  </div>

                  {userSalary.total_ot?.total_amount > 0 && (
                    <div className="flex justify-between items-center py-0.5">
                      <div>
                        <span className="text-muted-foreground">Overtime Earnings</span>
                        <span className="text-[10px] text-muted-foreground block">
                          {userSalary.total_ot.hours_worked.toFixed(2)} hrs × ₹
                          {userSalary.total_ot.hourly_rate}/hr
                        </span>
                      </div>
                      <span className="font-semibold text-emerald-600">
                        + {formatCurrency(userSalary.total_ot.total_amount)}
                      </span>
                    </div>
                  )}

                  {userSalary.total_present_incentive > 0 && (
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-muted-foreground">Present Incentive:</span>
                      <span className="font-semibold text-emerald-600">
                        + {formatCurrency(userSalary.total_present_incentive)}
                      </span>
                    </div>
                  )}

                  {userSalary.total_incentive > 0 && (
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-muted-foreground">Total Incentives:</span>
                      <span className="font-semibold text-emerald-600">
                        + {formatCurrency(userSalary.total_incentive)}
                      </span>
                    </div>
                  )}

                  {isWeekOffPaymentEnabled && (
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-muted-foreground">Week Off Earnings:</span>
                      <span className="font-semibold text-emerald-600">
                        + {formatCurrency(userSalary.total_week_off_earnings)}
                      </span>
                    </div>
                  )}

                  {isWeekOffAsOvertimeEnabled && (
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-muted-foreground">Week Off Overtime:</span>
                      <span className="font-semibold text-emerald-600">
                        + {formatCurrency(userSalary.total_week_off_overtime?.total_amount)}
                      </span>
                    </div>
                  )}

                  {isHolidayPaymentEnabled && (
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-muted-foreground">Holiday Earnings:</span>
                      <span className="font-semibold text-emerald-600">
                        + {formatCurrency(userSalary.total_holiday_earnings)}
                      </span>
                    </div>
                  )}

                  {isHolidayAsOvertimeEnabled && (
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-muted-foreground">Holiday Overtime:</span>
                      <span className="font-semibold text-emerald-600">
                        + {formatCurrency(userSalary.total_holiday_overtime?.total_amount)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-muted-foreground">Total Deductions:</span>
                    <span className="font-semibold text-rose-600">
                      - {formatCurrency(userSalary.total_deductions)}
                    </span>
                  </div>

                  {userSalary.total_loan_amount > 0 && (
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-muted-foreground">Total Loan/EMI:</span>
                      <span className="font-semibold text-rose-600">
                        - {formatCurrency(userSalary.total_loan_amount)}
                      </span>
                    </div>
                  )}

                  {userSalary.total_payments_made > 0 && (
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-muted-foreground">Total Advances Made:</span>
                      <span className="font-semibold text-rose-600">
                        - {formatCurrency(userSalary.total_payments_made)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Big Net Payable Banner */}
                <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center shadow-xs">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                    Net Payable
                  </span>
                  <h2 className="text-3xl font-extrabold text-emerald-800 dark:text-emerald-300">
                    {formatCurrency(userSalary.net_payable)}
                  </h2>
                </div>
              </div>
            ) : salaryLoading ? (
              <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-2xl flex flex-col items-center justify-center gap-2">
                <Loader2 className="size-6 animate-spin text-primary" />
                <span className="text-xs">Calculating salary &amp; attendance breakdown...</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Panel>
  )
}
