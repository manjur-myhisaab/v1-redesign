export interface FirmListItem {
  firm_id: string;
  firm_name: string;
  firm_code: string;
}

export interface SwitchFirmResponse {
  user_id: string;
  first_name: string;
  last_name: string;
  mobile_number: string;
  current_firm_id: string;
}

export interface FirmDetails {
  firm_id: string;
  firm_type: string;
  firm_name: string;
  firm_code: string;
  attendance_method: string | null;
  team_size: string;
  created_at: string;
  updated_at: string;
  applicable_comp_off: string | null;
  applicable_for_sandwich_policy: boolean | null;
  attendance_marking_method: string;
  attendance_module: boolean;
  comp_off: boolean | null;
  comp_off_validity: string | null;
  custom_report_eligible: boolean;
  date_created: string;
  date_updated: string | null;
  device_sno: string | null;
  ecommerce_module: boolean;
  face_recognition_method: string;
  firm_address: string;
  firm_company_code: string | null;
  firm_custom_daywise_salary: boolean;
  firm_early: string | null;
  firm_email: string;
  firm_employee_limit: number | null;
  firm_expense_system: boolean;
  firm_face_attendance: boolean;
  firm_geo_fencing_system: boolean;
  firm_gstin: string;
  firm_leave_system: boolean;
  firm_paid_logo: string | null;
  firm_phone: string;
  firm_pro_employee_limit: number | null;
  firm_server_url: string | null;
  firm_task_visit_management: boolean;
  firm_theme: string | null;
  late_cut_off: string | null;
  maintain_salary_payment_history: boolean;
  map_provider: string;
  pay_cycle_enabled: boolean;
  pay_cycle_from: number;
  pay_cycle_to: number;
  pay_period: string;
  plan_expiry_date: string | null;
  plan_start_date: string | null;
  shiftwise_incentive: boolean | null;
  status: string;
  subscription_plan: string;
  user_created: string | null;
  user_updated: string | null;
  week_off_day: string;
  week_off_day_number: number;
  week_off_payment: boolean;
  whatsapp_credits_available: number;
}

export interface FirmApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
