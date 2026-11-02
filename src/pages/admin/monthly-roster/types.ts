export interface Shift {
  shift_id: number | string
  id?: number | string
  shift_name?: string
  name?: string
  shift_from?: string
  shift_to?: string
  status?: string
  is_deleted?: boolean
}

export interface EmployeeCategory {
  employee_category_id: number | string
  employee_category_name: string
}

export interface Designation {
  designation_id?: number | string
  id?: number | string
  designation_name?: string
  name?: string
}

export interface MonthlyShiftItem {
  date_string: string
  shift_ids: Array<{
    shift_id?: {
      shift_id?: number | string
      id?: number | string
    } | number | string
  }>
}

export interface RosterUser {
  id: string | number
  employee_code?: string
  first_name?: string
  last_name?: string
  role?: string
  status?: string
  shift_type?: string
  department_name?: string
  designation_id?: Designation
  employee_category_id?: EmployeeCategory
  monthly_shifts?: MonthlyShiftItem[] | string
  shift_ids?: any[]
  weekly_shifts?: any[]
  week_off_day_number?: number
  other_category_ids?: any[]
  supervisor_id?: any
}

export interface RosterFilterState {
  searchQuery: string
  selectedCategory: string
  selectedDepartments: string[]
  selectedDesignations: string[]
  selectedFilterCategories: string[]
  sortSelected: string
}

export interface RosterFormValues {
  selectionMode: 'single' | 'range' | 'multiple' | 'month'
  downloadMonth: string
  categories: string[]
  departments: string[]
  employees: string[]
  shifts: string[]
  dateRange: {
    start: Date
    end: Date
  }
  dates?: Date[]
}

export type RosterModalMode = 'update' | 'download' | 'import' | null
