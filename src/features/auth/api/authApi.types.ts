export interface CheckRequest {
  mobile_number: string;
}

export interface SendOtpRequest {
  mobile_number: string;
}

export interface VerifyOtpRequest {
  mobile_number: string;
  otp_code: string;
}

export interface SignupRequest {
  first_name: string;
  last_name?: string;
  mobile_number: string;
  password: string;
  confirm_password?: string;
  role: any;
  firm_name?: string;
  firm_type?: string;
  team_size?: string;
  company_code?: string;
}

// User Profile Types (/user/profile)
export interface UserProfileFirm {
  firm_id: string;
  firm_name: string;
  firm_code?: string;
  status?: string;
  firm_type?: string;
  team_size?: string;
  comp_off?: boolean;
  attendance_method?: string;
  attendance_marking_method?: string;
  attendance_module?: boolean;
  firm_geo_fencing_system?: boolean;
  firm_face_attendance?: boolean;
  [key: string]: any;
}

export interface UserProfileShift {
  shift_id: string;
  shift_name: string;
  shift_from: string;
  shift_to: string;
  shift_type: string;
  status?: string;
  applicable_for_break?: boolean;
  applicable_for_overnight?: boolean;
  auto_punch_out?: boolean;
  auto_punch_out_time?: string | null;
  applicable_for_minimum_working_hours?: boolean;
  [key: string]: any;
}

export interface UserProfileRole {
  role_id: string;
  role_name: string;
  [key: string]: any;
}

export interface UserProfileUser {
  user_id: string;
  first_name: string;
  last_name?: string;
  mobile_number: string;
  employee_email_address?: string;
  department_name?: string;
  designation_name?: string;
  role?: string[];
  status?: string;
  punch_status?: string;
  in_time?: string | null;
  out_time?: string | null;
  punch_from?: string;
  avatar?: string | null;
  categories?: any[];
  current_firm_id?: string;
  employee_code?: string | null;
  [key: string]: any;
}

export interface UserProfileData {
  firm: UserProfileFirm;
  user: UserProfileUser;
  roles: UserProfileRole[];
  shifts: UserProfileShift[];
  allfirms: { firm_id: string; firm_name: string }[];
  geo_fence: any[];
}

export interface UserProfileResponse {
  success: boolean;
  message: string;
  data: UserProfileData;
}
