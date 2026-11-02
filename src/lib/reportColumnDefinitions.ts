// src/lib/reportColumnDefinitions.ts
// Master column definitions for all report types

export interface ReportTypeInfo {
  key: string
  label: string
}

export const REPORT_TYPES: ReportTypeInfo[] = [
  { key: 'employee_master', label: 'Employee Master Sheet' },
  { key: 'attendance_daywise', label: 'Daywise Attendance Report' },
  { key: 'attendance_daywise_punchinout', label: 'Daywise Attendance (Multi Punch In/Out)' },
  { key: 'attendance_detailed', label: 'Detailed Attendance Report' },
  { key: 'overall_attendance', label: 'Overall Attendance Report' },
  { key: 'working_hours', label: 'Working Hours Report' },
  { key: 'overtime_hours', label: 'Overtime Hours Report' },
  { key: 'expense', label: 'Expense Report' },
  { key: 'incentive', label: 'Incentive Report' },
  { key: 'visits', label: 'Visits Report' },
  { key: 'tasks', label: 'Tasks Report' },
  { key: 'odometer', label: 'Odometer Report' },
  { key: 'payments', label: 'Advance Payments Report' },
]

export interface ColumnDefinition {
  key: string
  label: string
  category: string
  format: string
  defaultVisible: boolean
  defaultWidth: number
}

export interface TemplateColumnConfig extends ColumnDefinition {
  visible: boolean
  width: number
  alignment: 'left' | 'center' | 'right'
  sortOrder: number
  customLabel?: string
}

export const REPORT_COLUMNS: Record<string, ColumnDefinition[]> = {
  employee_master: [
    { key: 'sr_no', label: 'S.No', category: 'other', format: 'number', defaultVisible: true, defaultWidth: 8 },
    { key: 'employee_code', label: 'Employee Code', category: 'employee', format: 'text', defaultVisible: true, defaultWidth: 20 },
    { key: 'employee_name', label: 'Full Name', category: 'employee', format: 'text', defaultVisible: true, defaultWidth: 25 },
    { key: 'email', label: 'Email', category: 'employee', format: 'text', defaultVisible: true, defaultWidth: 25 },
    { key: 'designation', label: 'Designation', category: 'employee', format: 'text', defaultVisible: true, defaultWidth: 20 },
    { key: 'category', label: 'Category', category: 'employee', format: 'text', defaultVisible: true, defaultWidth: 20 },
    { key: 'doj', label: 'Date of Joining', category: 'employee', format: 'date', defaultVisible: true, defaultWidth: 16 },
    { key: 'status', label: 'Status', category: 'employee', format: 'text', defaultVisible: true, defaultWidth: 12 },
  ],
  attendance_daywise: [
    { key: 'serial_no', label: 'S.No', category: 'other', format: 'number', defaultVisible: true, defaultWidth: 8 },
    { key: 'employee_code', label: 'Employee ID', category: 'employee', format: 'text', defaultVisible: true, defaultWidth: 20 },
    { key: 'full_name', label: 'Name', category: 'employee', format: 'text', defaultVisible: true, defaultWidth: 25 },
    { key: 'designation', label: 'Designation', category: 'employee', format: 'text', defaultVisible: true, defaultWidth: 20 },
    { key: 'status', label: 'Status', category: 'attendance', format: 'text', defaultVisible: true, defaultWidth: 12 },
    { key: 'check_in', label: 'Check In', category: 'time', format: 'time', defaultVisible: true, defaultWidth: 12 },
    { key: 'check_out', label: 'Check Out', category: 'time', format: 'time', defaultVisible: true, defaultWidth: 12 },
    { key: 'total_hours', label: 'Total Hours', category: 'time', format: 'duration', defaultVisible: true, defaultWidth: 15 },
  ],
  working_hours: [
    { key: 'serial_no', label: 'S.No', category: 'other', format: 'number', defaultVisible: true, defaultWidth: 8 },
    { key: 'employee_code', label: 'Employee ID', category: 'employee', format: 'text', defaultVisible: true, defaultWidth: 20 },
    { key: 'full_name', label: 'Name', category: 'employee', format: 'text', defaultVisible: true, defaultWidth: 25 },
    { key: 'date', label: 'Date', category: 'time', format: 'date', defaultVisible: true, defaultWidth: 14 },
    { key: 'check_in', label: 'Check In', category: 'time', format: 'time', defaultVisible: true, defaultWidth: 12 },
    { key: 'check_out', label: 'Check Out', category: 'time', format: 'time', defaultVisible: true, defaultWidth: 12 },
    { key: 'total_hours', label: 'Total Hours', category: 'time', format: 'duration', defaultVisible: true, defaultWidth: 15 },
  ],
  expense: [
    { key: 'serial_no', label: 'S.No', category: 'other', format: 'number', defaultVisible: true, defaultWidth: 8 },
    { key: 'employee_code', label: 'Employee ID', category: 'employee', format: 'text', defaultVisible: true, defaultWidth: 20 },
    { key: 'full_name', label: 'Name', category: 'employee', format: 'text', defaultVisible: true, defaultWidth: 25 },
    { key: 'expense_date', label: 'Expense Date', category: 'finance', format: 'date', defaultVisible: true, defaultWidth: 14 },
    { key: 'expense_type', label: 'Expense Type', category: 'finance', format: 'text', defaultVisible: true, defaultWidth: 18 },
    { key: 'amount', label: 'Amount', category: 'finance', format: 'currency', defaultVisible: true, defaultWidth: 14 },
  ],
  incentive: [
    { key: 'serial_no', label: 'S.No', category: 'other', format: 'number', defaultVisible: true, defaultWidth: 8 },
    { key: 'employee_code', label: 'Employee ID', category: 'employee', format: 'text', defaultVisible: true, defaultWidth: 20 },
    { key: 'full_name', label: 'Name', category: 'employee', format: 'text', defaultVisible: true, defaultWidth: 25 },
    { key: 'incentive_date', label: 'Date', category: 'finance', format: 'date', defaultVisible: true, defaultWidth: 14 },
    { key: 'amount', label: 'Amount', category: 'finance', format: 'currency', defaultVisible: true, defaultWidth: 14 },
  ],
  visits: [
    { key: 'serial_no', label: 'S.No', category: 'other', format: 'number', defaultVisible: true, defaultWidth: 8 },
    { key: 'client_name', label: 'Client Name', category: 'work', format: 'text', defaultVisible: true, defaultWidth: 22 },
    { key: 'full_name', label: 'Employee', category: 'employee', format: 'text', defaultVisible: true, defaultWidth: 25 },
    { key: 'visit_date', label: 'Visit Date', category: 'work', format: 'date', defaultVisible: true, defaultWidth: 14 },
    { key: 'visit_geoaddress', label: 'Location', category: 'location', format: 'text', defaultVisible: true, defaultWidth: 25 },
  ],
  tasks: [
    { key: 'serial_no', label: 'S.No', category: 'other', format: 'number', defaultVisible: true, defaultWidth: 8 },
    { key: 'task_title', label: 'Task Title', category: 'work', format: 'text', defaultVisible: true, defaultWidth: 30 },
    { key: 'full_name', label: 'Assigned To', category: 'employee', format: 'text', defaultVisible: true, defaultWidth: 25 },
    { key: 'task_status', label: 'Status', category: 'work', format: 'text', defaultVisible: true, defaultWidth: 14 },
    { key: 'due_date', label: 'Due Date', category: 'work', format: 'date', defaultVisible: true, defaultWidth: 14 },
  ],
}

export const getDefaultColumns = (reportType: string): TemplateColumnConfig[] => {
  const allColumns = REPORT_COLUMNS[reportType] || REPORT_COLUMNS.attendance_daywise || []
  return allColumns
    .filter((col) => col.defaultVisible)
    .map((col, index) => ({
      ...col,
      visible: true,
      width: col.defaultWidth,
      alignment: 'center',
      sortOrder: index,
      customLabel: '',
    }))
}

export const getAllColumns = (reportType: string): ColumnDefinition[] => {
  return REPORT_COLUMNS[reportType] || REPORT_COLUMNS.attendance_daywise || []
}
