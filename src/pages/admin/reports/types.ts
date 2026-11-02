import type { LucideIcon } from 'lucide-react'

export type ReportCategory = 'attendance' | 'field' | 'finance' | 'hr'

export type DateSelectionMode = 'singleDate' | 'fixed' | 'range'

export type ReportFormat = 'pdf' | 'excel' | 'zip'

export interface ReportItemConfig {
  key: string
  label: string
  description: string
  category: ReportCategory
  icon: LucideIcon
  supportedFormats: ReportFormat[]
  defaultFormat?: ReportFormat
  supportedDateModes: DateSelectionMode[]
  defaultDateMode?: DateSelectionMode
  needsEmployeeSelection?: boolean
  needsCategorySelection?: boolean
  needsTaskSelection?: boolean
  instantDownload?: boolean
}

export interface EmployeeCategoryItem {
  employee_category_id: string | number
  employee_category_name: string
  [key: string]: any
}

export interface ReportEmployeeItem {
  id: string
  first_name?: string
  last_name?: string
  name?: string
  employee_code?: string
  status?: string
  department_name?: string
  title?: string
  country?: string
  inactive_date?: string
  date_updated?: string
  updated_at?: string
  employee_category_id?: any
  role?: any
  [key: string]: any
}

export interface ReportTaskItem {
  task_id: string
  task_title?: string
  task_duedate?: string
  assignedTo?: any
  assignedToOthers?: any[]
  [key: string]: any
}
