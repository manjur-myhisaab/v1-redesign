export interface Employee {
  user_id: string;
  first_name: string;
  last_name: string;
  mobile_number: string;
  role: string[];
  current_firm_id: string;
  created_at: string;
  updated_at: string;
  aadhaar_number: string | null;
  ai_selfie_verification: boolean;
  all_firms: any[] | null;
  firm_id: string;
  firm_name: string;
  app_version: string | null;
  applicable_for_overtime: boolean;
  auto_overtime: boolean;
  balance_leaves: number;
  basic_salary: string;
  battery_percentage: string | null;
  can_be_seen_by_all_managers: boolean;
  can_view_manager: boolean;
  can_view_self_salary: boolean;
  casual_leaves: number;
  country: string;
  current_tp: string | null;
  date_created: string;
  day_end_whatsapp_report: boolean;
  department_name: string | null;
  designation_id: string | null;
  distance_track_collection: boolean;
  documents: string | null;
  doj: string | null;
  early: boolean;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_leave: number;
  employee_address: string | null;
  employee_bank_ac_holder_name: string | null;
  employee_bank_ac_number: string | null;
  employee_bank_branch_name: string | null;
  employee_bank_ifsc: string | null;
  employee_bank_name: string | null;
  employee_birthdate: string | null;
  employee_blood_group: string | null;
  employee_category_id: string | null;
  employee_code: string | null;
  employee_email_address: string | null;
  employee_serial_no: number;
  employee_upi: string | null;
  esi_applicable: string | null;
  esi_no: string | null;
  esi_to_deduct_till: string | null;
  face_images: string | null;
  father_name: string | null;
  forever_tracking: boolean;
  gender: string | null;
  in_time: string | null;
  inactive_date: string | null;
  incentive: number | null;
  increment_from: string | null;
  is_admin: boolean;
  last_geo_address: string | null;
  last_geo_point: string | null;
  last_lat: string | null;
  last_loc_time: string | null;
  last_long: string | null;
  late: boolean;
  leave_taken: number;
  live_tracking: boolean;
  manager_category_id: string | null;
  marital_status: string | null;
  mobile_attendance: boolean;
  monthly_shifts: Record<string, any>;
  multiple_attendance: boolean;
  opening_leaves: number;
  other_category_ids: string | null;
  out_time: string | null;
  overtime_hourly_rate: string | null;
  overtime_hours: number;
  overtime_minutes: number;
  pan_number: string | null;
  patch_version: string | null;
  pay_type: string | null;
  payroll_benefits: Record<string, any>;
  payroll_deductions: Record<string, any>;
  payroll_heads: string | null;
  payroll_template_id: string | null;
  per_km_amount: string | null;
  pf_id: string | null;
  pf_no: string | null;
  previous_salary_per_month: number | null;
  privilege_leaves: number;
  punch_from: string | null;
  punch_status: string | null;
  salary_per_month: number;
  salary_per_month_after_decimal: number;
  self_custom_daywise_salary: boolean;
  self_odometer_reading: boolean;
  shift_id: string | null;
  shift_ids: string | null;
  shift_type: string | null;
  shiftwise_attendance: boolean;
  sick_leaves: number;
  staff_notification: boolean;
  supervisor_id: string | null;
  task_visit_management: boolean;
  uan: string | null;
  vehicle_type: string | null;
  vendor_name: string | null;
  week_off_day_number: number;
  week_off_payment: boolean;
  weekly_shifts: Record<string, any>;
  whatsapp_report_time: string | null;
  ufid: string;
}

export interface EmployeeFirm {
  ufid?: string;
  firm_id?: string;
  firm_name?: string;
  [key: string]: any;
}

export interface EmployeeItemWrapper {
  firm?: EmployeeFirm;
  user: Employee;
  roles?: any[];
  shifts?: any[];
  geo_fence?: any[];
}

export interface EmployeeResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export type SingleEmployeeResponse = EmployeeResponse<EmployeeItemWrapper | Employee>;
export type EmployeeListResponse = EmployeeResponse<(EmployeeItemWrapper | Employee)[]>;

export interface CreateEmployeeRequest {
  first_name: string;
  last_name?: string | null;
  mobile_number: string;
  role?: string[];
  aadhaar_number?: string | null;
  applicable_for_overtime?: boolean;
  auto_overtime?: boolean;
  basic_salary?: string;
  department_name?: string | null;
  designation_id?: string | null;
  doj?: string | null;
  employee_address?: string | null;
  employee_bank_ac_holder_name?: string | null;
  employee_bank_ac_number?: string | null;
  employee_bank_branch_name?: string | null;
  employee_bank_ifsc?: string | null;
  employee_bank_name?: string | null;
  employee_birthdate?: string | null;
  employee_code?: string | null;
  employee_email_address?: string | null;
  gender?: string | null;
  in_time?: string | null;
  out_time?: string | null;
  salary_per_month?: number;
  shift_id?: string | null;
  shift_type?: string | null;
  supervisor_id?: string | null;
  [key: string]: any;
}

export interface UpdateEmployeeRequest extends Partial<CreateEmployeeRequest> {
  user_id: string;
}
