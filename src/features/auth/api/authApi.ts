import {
  checkNewUser,
  sendOtpViaSmsGateway,
  verifyAndLoginViaSmsGateway,
  login as serverLogin,
  logout as serverLogout,
  getCurrentUser,
  createNewEmployee,
  createNewBusiness,
  formatPhoneAsEmail,
} from '@/services/server';
import type {
  CheckRequest,
  SendOtpRequest,
  VerifyOtpRequest,
  SignupRequest,
  UserProfileResponse,
} from './authApi.types';

export const authApi = {
  check: async (data: CheckRequest) => {
    const digits = (data.mobile_number || '').replace(/\D/g, '');
    try {
      const result: any = await checkNewUser(digits);
      const userArray = result?.user || result?.data?.user;
      const exists = Array.isArray(userArray) && userArray.length > 0;
      return {
        success: true,
        exists,
        authentication_type: exists ? 1 : 2,
        user: exists ? userArray[0] : null,
        data: result,
      };
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.message?.includes('404')) {
        return {
          success: true,
          exists: false,
          authentication_type: 2,
          user: null,
          data: null,
        };
      }
      throw err;
    }
  },

  register: async (data: SignupRequest) => {
    const digits = (data.mobile_number || '').replace(/\D/g, '');
    const roleStr = Array.isArray(data.role) ? data.role[0] : (data.role || '');
    const isEmployee = String(roleStr).toLowerCase() === 'employee';

    let res: any;
    if (isEmployee) {
      const payload = {
        firm_company_code: data.company_code || '',
        first_name: data.first_name,
        last_name: data.last_name || '',
        password: data.password,
        contact_number: digits,
      };
      res = await createNewEmployee(payload);
    } else {
      const payload = {
        attendance_module: true,
        firm_name: data.firm_name || '',
        first_name: data.first_name,
        last_name: data.last_name || '',
        firm_employee_limit: parseInt(data.team_size || '10', 10) || 10,
        password: data.password,
        firm_contact_number: digits,
      };
      res = await createNewBusiness(payload);
    }

    let loginRes: any = null;
    try {
      const email = formatPhoneAsEmail(digits);
      loginRes = await serverLogin({ email, password: data.password });
    } catch (loginErr) {
      console.warn('Auto-login after registration failed:', loginErr);
    }

    const token = loginRes?.access_token || res?.access_token || res?.data?.access_token || '';
    let userData: any = null;
    if (token) {
      try {
        userData = await getCurrentUser();
      } catch (e) {
        console.warn('Could not fetch user data after register:', e);
      }
    }

    return {
      success: true,
      token,
      data: {
        user: userData || res?.user,
        firm: userData?.firm_id || res?.firm,
      },
      message: 'Registration successful',
    };
  },

  sendOtp: async (data: SendOtpRequest) => {
    const digits = (data.mobile_number || '').replace(/\D/g, '');
    const res: any = await sendOtpViaSmsGateway(digits);
    return {
      success: true,
      message: res?.message || 'OTP sent successfully!',
      data: res,
    };
  },

  verifyOtp: async (data: VerifyOtpRequest) => {
    const digits = (data.mobile_number || '').replace(/\D/g, '');
    const res: any = await verifyAndLoginViaSmsGateway(digits, data.otp_code);
    return {
      success: true,
      message: 'OTP verified successfully!',
      data: res,
      token: res?.access_token || res?.data?.access_token,
    };
  },

  logout: async () => {
    try {
      await serverLogout();
    } catch (e) {
      console.warn('Error during logout:', e);
    }
    return { success: true, message: 'Logged out successfully' };
  },

  getUserProfile: async (): Promise<UserProfileResponse> => {
    const userData: any = await getCurrentUser();
    const firm = userData?.firm_id || {};
    return {
      success: true,
      message: 'Profile fetched successfully',
      data: {
        firm: {
          firm_id: firm?.firm_id || firm?.id || '',
          firm_name: firm?.firm_name || firm?.name || '',
          firm_code: firm?.firm_code,
          status: firm?.status,
          ...firm,
        },
        user: {
          user_id: userData?.id || userData?.user_id || '',
          first_name: userData?.first_name || '',
          last_name: userData?.last_name || '',
          mobile_number: userData?.phone || userData?.contact_number || '',
          employee_email_address: userData?.email || '',
          role: userData?.role ? (Array.isArray(userData.role) ? userData.role : [userData.role]) : [],
          ...userData,
        },
        roles: userData?.roles || [],
        shifts: userData?.shifts || [],
        allfirms: (userData?.all_firms || []).map((f: any) => ({
          firm_id: f?.firm_id?.firm_id || f?.firm_id?.id || f?.firm_id || '',
          firm_name: f?.firm_id?.firm_name || f?.firm_id?.name || '',
        })),
        geo_fence: userData?.geo_fence || [],
      },
    };
  },
};
