import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Printer,
  Calendar,
  Wallet,
  ShieldCheck,
  Gift,
  Loader2,
  Check,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Panel from '@/components/admin/Panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmployeeAvatar } from '@/lib/people'
import { useAuth } from '@/context/auth/AuthContext'
import rdk, {
  readItem,
  readItems,
  updateItem,
  customEndpoint,
} from '@/services/server'

interface EmployeeData {
  id: string
  first_name: string
  last_name: string
  employee_code?: string
  title?: string
  email?: string
  phone?: string
  salary_per_month?: number
  pay_type?: string
  payroll_template_id?: any
  employee_category_id?: {
    employee_category_name: string
  }
}

interface PayrollTemplate {
  payroll_template_id: string
  payroll_template_name: string
  basic_salary_percentage?: number
  basic_salary_fixed?: number
  basic_salary_type?: string
}

export default function EmployeePayslipDetails() {
  const { userid, id } = useParams()
  const employeeId = userid || id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const printableRef = useRef<HTMLDivElement>(null)

  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(
    String(currentDate.getMonth() + 1).padStart(2, '0'),
  )
  const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()))

  // Salary form state
  const [payType, setPayType] = useState('Monthly')
  const [templateId, setTemplateId] = useState<string>('')
  const [monthlyCTC, setMonthlyCTC] = useState<number | ''>('')
  const [isSaving, setIsSaving] = useState(false)

  // 1. Fetch Employee
  const { data: employee, isLoading: loadingEmployee } = useQuery<EmployeeData | null>({
    queryKey: ['employee_payslip_detail', employeeId],
    queryFn: async () => {
      if (!employeeId) return null
      const res = await rdk.request(
        readItem('employees', employeeId, {
          fields: ['*', 'employee_category_id.*'],
        }),
      )
      return (res as EmployeeData) || null
    },
    enabled: !!employeeId,
  })

  // 2. Fetch Payroll Templates
  const { data: templates = [] } = useQuery<PayrollTemplate[]>({
    queryKey: ['payroll_templates_list'],
    queryFn: async () => {
      const res = await rdk.request(
        readItems('payroll_templates', {
          sort: ['payroll_template_name'],
          limit: -1,
        }),
      )
      return Array.isArray(res) ? (res as PayrollTemplate[]) : []
    },
  })

  // 3. Fetch salary computation for the month
  const u = user as any
  const firmId = typeof u?.firm_id === 'object' ? u.firm_id?.firm_id : u?.firm_id
  useQuery({
    queryKey: ['employee_salary_month', employeeId, selectedYear, selectedMonth, firmId],
    queryFn: async () => {
      if (!employeeId || !firmId) return null
      try {
        const res = await rdk.request(
          customEndpoint({
            path: `api/employee_salary/${selectedYear}-${selectedMonth}/${employeeId}/${firmId}`,
            method: 'GET',
          }),
        )
        return res
      } catch {
        return null
      }
    },
    enabled: !!employeeId && !!firmId,
  })

  // Initialize form
  useEffect(() => {
    if (employee) {
      setPayType(employee.pay_type || 'Monthly')
      setMonthlyCTC(employee.salary_per_month ?? '')
      const tId =
        typeof employee.payroll_template_id === 'object'
          ? employee.payroll_template_id?.payroll_template_id
          : employee.payroll_template_id
      setTemplateId(tId ? String(tId) : '')
    }
  }, [employee])

  // Calculated breakdown
  const ctc = Number(monthlyCTC) || 0
  const activeTemplate = templates.find((t) => String(t.payroll_template_id) === templateId)

  const basicSalary = useMemo(() => {
    if (!activeTemplate || ctc <= 0) return Math.round(ctc * 0.5)
    if (activeTemplate.basic_salary_type === 'fixed' && activeTemplate.basic_salary_fixed) {
      return activeTemplate.basic_salary_fixed
    }
    const pct = activeTemplate.basic_salary_percentage || 50
    return Math.round((ctc * pct) / 100)
  }, [ctc, activeTemplate])

  const hra = useMemo(() => Math.round(basicSalary * 0.4), [basicSalary])
  const specialAllowance = useMemo(() => Math.max(0, ctc - basicSalary - hra), [ctc, basicSalary, hra])
  const grossSalary = basicSalary + hra + specialAllowance

  // Standard deductions approximation (PF 12% of basic capped at 1800, PT 200)
  const pfDeduction = useMemo(() => Math.min(1800, Math.round(basicSalary * 0.12)), [basicSalary])
  const ptDeduction = ctc > 15000 ? 200 : 0
  const totalDeductions = pfDeduction + ptDeduction
  const netPay = Math.max(0, grossSalary - totalDeductions)

  const handleSaveSalary = async () => {
    if (!employeeId) return
    setIsSaving(true)
    try {
      await rdk.request(
        updateItem('employees', employeeId, {
          salary_per_month: Number(monthlyCTC) || 0,
          pay_type: payType,
          payroll_template_id: templateId ? Number(templateId) : null,
        }),
      )
      toast.success('Employee salary details updated')
      queryClient.invalidateQueries({ queryKey: ['employee_payslip_detail', employeeId] })
    } catch (err: any) {
      toast.error(err.message || 'Failed to update salary details')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePrint = () => {
    if (!printableRef.current) return
    const printWindow = window.open('', '_blank', 'height=650,width=850')
    if (!printWindow) return
    printWindow.document.write('<html><head><title>Payslip</title>')
    printWindow.document.write(
      '<style>body { font-family: sans-serif; padding: 20px; color: #111; } table { width: 100%; border-collapse: collapse; margin-top: 15px; } th, td { border: 1px solid #ddd; padding: 8px 12px; font-size: 13px; } th { background-color: #f8f9fa; text-align: left; } .text-right { text-align: right; } .header { margin-bottom: 20px; } .title { font-size: 20px; font-weight: bold; } .subtitle { font-size: 13px; color: #666; }</style>',
    )
    printWindow.document.write('</head><body>')
    printWindow.document.write(printableRef.current.innerHTML)
    printWindow.document.write('</body></html>')
    printWindow.document.close()
    printWindow.print()
  }

  if (loadingEmployee) {
    return (
      <Panel className="p-6 flex-1 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </Panel>
    )
  }

  const employeeName = `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim() || 'Employee'

  return (
    <Panel className="p-4 md:p-6 flex-1 flex flex-col gap-5 overflow-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/payroll')}
            className="size-8 cursor-pointer"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-3">
            <EmployeeAvatar employeeId={employee?.id || ''} name={employeeName} className="size-10" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">{employeeName}</h1>
                {employee?.employee_code && (
                  <Badge variant="outline" className="text-xs">
                    {employee.employee_code}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {employee?.title || 'Staff'} · {employee?.employee_category_id?.employee_category_name || 'General'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} className="gap-2 cursor-pointer">
            <Printer className="size-4" />
            <span>Print Payslip</span>
          </Button>
        </div>
      </div>

      {/* Month Picker Bar */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Select Payslip Period:</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-8 rounded border border-border bg-card px-2 text-xs"
          >
            <option value="01">January</option>
            <option value="02">February</option>
            <option value="03">March</option>
            <option value="04">April</option>
            <option value="05">May</option>
            <option value="06">June</option>
            <option value="07">July</option>
            <option value="08">August</option>
            <option value="09">September</option>
            <option value="10">October</option>
            <option value="11">November</option>
            <option value="12">December</option>
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="h-8 rounded border border-border bg-card px-2 text-xs"
          >
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>
        </div>

        <div className="text-xs text-muted-foreground">
          Net Monthly Payable:{' '}
          <strong className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
            ₹{netPay.toLocaleString('en-IN')}
          </strong>
        </div>
      </div>

      {/* 2-Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Configuration Form */}
        <div className="lg:col-span-1 rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Wallet className="size-4 text-primary" />
            Salary Settings
          </h2>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Payroll Structure / Template</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="h-9 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Standard Default Template</option>
              {templates.map((t) => (
                <option key={t.payroll_template_id} value={t.payroll_template_id}>
                  {t.payroll_template_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Payment Frequency</label>
            <select
              value={payType}
              onChange={(e) => setPayType(e.target.value)}
              className="h-9 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="Monthly">Monthly</option>
              <option value="Daily">Daily</option>
              <option value="Hourly">Hourly</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Monthly CTC (Gross Base ₹) *</label>
            <Input
              type="number"
              min="0"
              value={monthlyCTC}
              onChange={(e) =>
                setMonthlyCTC(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="e.g. 50000"
            />
          </div>

          <Button
            onClick={handleSaveSalary}
            disabled={isSaving}
            className="mt-2 w-full gap-2 cursor-pointer"
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            <span>Save Salary Structure</span>
          </Button>
        </div>

        {/* Right: Live Payslip Preview */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Printer className="size-4 text-primary" />
              Salary Breakdown & Payslip Preview
            </h2>
            <Badge variant="outline" className="text-xs">
              {selectedMonth}/{selectedYear}
            </Badge>
          </div>

          <div ref={printableRef} className="flex flex-col gap-4 text-xs">
            <div className="header border-b border-border pb-3">
              <h2 className="title text-base font-bold text-foreground">
                {user?.firm_name || 'myHisaab Payroll'}
              </h2>
              <p className="subtitle text-xs text-muted-foreground">
                Payslip for {selectedMonth}/{selectedYear} · Employee: {employeeName}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Earnings */}
              <div className="rounded border border-border p-3 flex flex-col gap-2">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-[11px] flex items-center gap-1">
                  <Gift className="size-3.5" /> Earnings & Allowances
                </span>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Basic Salary</span>
                  <span className="font-medium">₹{basicSalary.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">House Rent Allowance (HRA)</span>
                  <span className="font-medium">₹{hra.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Special Allowance</span>
                  <span className="font-medium">₹{specialAllowance.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between pt-1 font-bold">
                  <span>Gross Earnings</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    ₹{grossSalary.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Deductions */}
              <div className="rounded border border-border p-3 flex flex-col gap-2">
                <span className="font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider text-[11px] flex items-center gap-1">
                  <ShieldCheck className="size-3.5" /> Deductions
                </span>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Provident Fund (PF)</span>
                  <span className="font-medium">₹{pfDeduction.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Professional Tax (PT)</span>
                  <span className="font-medium">₹{ptDeduction.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between pt-1 font-bold">
                  <span>Total Deductions</span>
                  <span className="text-rose-600 dark:text-rose-400">
                    ₹{totalDeductions.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Net Salary Banner */}
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">
                  Net Take-Home Pay
                </p>
                <p className="text-xl font-extrabold text-foreground mt-0.5">
                  ₹{netPay.toLocaleString('en-IN')}
                </p>
              </div>
              <Badge variant="default" className="text-xs">
                Calculated Monthly
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  )
}
