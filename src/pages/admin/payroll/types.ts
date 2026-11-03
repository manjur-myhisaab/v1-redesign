export interface EmployeeCategory {
  employee_category_id: number | string
  employee_category_name: string
}

export interface EmployeeInfo {
  id: string
  first_name?: string
  last_name?: string
  name?: string
  avatar?: string
  status?: string
  emp_status?: string
  employee_code?: string
  title?: string
  designation?: string
  department_name?: string
  email?: string
  phone?: string
  doj?: string
  pan_number?: string
  uan?: string
  esi_no?: string
  pf_no?: string
  gender?: string
  date_created?: string
  inactive_date?: string
  role?: any
  payroll_template_id?: any
  employee_category_id?: EmployeeCategory | string | number
  other_category_ids?: any[]
  week_off_payment?: boolean
  week_off_as_overtime?: boolean
  holiday_extra_payment?: boolean
  holiday_as_overtime?: boolean
}

export interface SalaryInfo {
  pay_type: string
  ctc?: number
  basic_salary?: number
  daily_salary?: number
  hourly_salary?: number
  regular_earnings?: number
  total_benefits?: number
  total_other_benefits?: number
  total_deductions?: number
  total_loan_amount?: number
  total_payments_made?: number
  total_incentive?: number
  total_present_incentive?: number
  total_week_off_earnings?: number
  total_week_off_overtime?: {
    hours_worked?: number
    hourly_rate?: number
    total_amount?: number
  }
  total_holiday_earnings?: number
  total_holiday_overtime?: {
    hours_worked?: number
    hourly_rate?: number
    total_amount?: number
  }
  net_payable: number
  total_days?: number
  present_days?: number
  present_week_offs?: number
  present_holidays?: number
  absent_days?: number
  half_days?: number
  leave_days?: number
  holidays?: number
  week_offs?: number
  payable_days?: number
  total_ot?: {
    hours_worked: number
    hourly_rate: number
    total_amount: number
  }
  total_hourly_data?: {
    hours_worked: number
    total_amount: number
  }
  hourly_rates?: Record<string, number>
  over_time_data?: Record<string, number>
  benefits?: Array<{
    payroll_head_id?: number
    payroll_head_name: string
    value: number
  }>
  deductions?: Array<{
    payroll_head_id?: number
    payroll_head_name: string
    value: number
  }>
  loans_emi?: Array<{
    loan_title: string
    is_emi?: boolean
    emi_amount?: number
    loan_amount?: number
  }>
  payments_made?: Array<{
    remarks?: string
    date?: string
    amount: number
  }>
  incentives?: Array<{
    remarks?: string
    incentive_date?: string
    incentive_amount: number
  }>
  present_incentives?: Array<{
    date?: string
    amount: number
    shift?: {
      shift_name?: string
      shift_from?: string
      shift_to?: string
    }
  }>
  pay_cycle_enabled?: boolean
  pay_cycle_from?: number
  pay_cycle_to?: number
}

export interface EmployeeSalaryResult {
  employee: EmployeeInfo
  salary: SalaryInfo
  status?: string
}

export interface PayrollTemplate {
  payroll_template_id: number
  payroll_template_name: string
  payroll_template_description?: string
}

export interface PayrollHead {
  payroll_head_id: number
  payroll_type: 'benefit' | 'deduction'
  payroll_head_name: string
  payroll_value: string | number
  payroll_value_type: 'fixed' | 'percentage'
  payroll_head_description?: string | null
  firm_id?: number
  payroll_template_id?: number | null
  payroll_head_attn?: 'flat_rate' | 'on_attendance' | null
  payroll_head_max_limit?: string | number | null
}
