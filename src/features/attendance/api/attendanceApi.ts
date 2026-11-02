import { apiClient } from '@/api/apiClient'
import type {
  DailyAttendanceSummaryRequest,
  AttendanceSummaryResponse,
  EmployeeMonthlySummaryRequest,
  EmployeeDaySessionsRequest,
  EmployeeDaySessionsResponse,
  BulkAttendanceRegisterRequest,
  BulkAttendanceUpdateRequest,
  BulkAttendanceResponse,
  MyAttendanceSessionsRequest,
  MyAttendanceSessionsResponse,
} from '../types/attendanceApi.types'

export const attendanceApi = {
  /**
   * Fetch attendance sessions for the currently logged-in user on a given date
   * POST /attendance/all
   * Body: { attendance_date: "YYYY-MM-DD" }
   */
  getMyAttendanceSessions: async (
    params: MyAttendanceSessionsRequest
  ): Promise<MyAttendanceSessionsResponse> => {
    return apiClient.post('/attendance/all', params)
  },

  /**
   * 1. Fetch attendance summary of all employees for a given date
   * POST /attendance/summary/employee
   * Body: { date: "YYYY-MM-DD" }
   */
  getDailyAttendanceSummary: async (
    params: DailyAttendanceSummaryRequest
  ): Promise<AttendanceSummaryResponse> => {
    return apiClient.post('/attendance/summary/employee', params)
  },

  /**
   * 2. Fetch monthly attendance summary for a specific employee
   * POST /attendance/summary/employee
   * Body: { employee_id: "...", date: "YYYY-MM" }
   */
  getEmployeeMonthlySummary: async (
    params: EmployeeMonthlySummaryRequest
  ): Promise<AttendanceSummaryResponse> => {
    return apiClient.post('/attendance/summary/employee', params)
  },

  /**
   * 3. Fetch punch sessions for a specific employee on a given date
   * POST /attendance/employee/all
   * Body: { employee_id: "...", attendance_date: "YYYY-MM-DD" }
   */
  getEmployeeDaySessions: async (
    params: EmployeeDaySessionsRequest
  ): Promise<EmployeeDaySessionsResponse> => {
    return apiClient.post('/attendance/employee/all', params)
  },

  /**
   * 4. Register attendance sessions in bulk (work & break)
   * POST /attendance/register/bulk
   * Body: BulkAttendanceItem[]
   */
  registerBulkAttendance: async (
    payload: BulkAttendanceRegisterRequest
  ): Promise<BulkAttendanceResponse> => {
    // console.log('📌 [POST /attendance/register/bulk] Payload:', payload)
    return apiClient.post('/attendance/register/bulk', payload)
  },

  /**
   * 5. Update attendance sessions in bulk (work & break)
   * PUT /attendance/update/bulk
   * Body: BulkAttendanceItem[]
   */
  updateBulkAttendance: async (
    payload: BulkAttendanceUpdateRequest
  ): Promise<BulkAttendanceResponse> => {
    // console.log('📌 [PUT /attendance/update/bulk] Payload:', payload)
    return apiClient.put('/attendance/update/bulk', payload)
  },

  /**
   * 6. Delete an attendance session
   * DELETE /attendance/session/delete
   * Body: { employee_id: "...", attendance_id: "..." }
   */
  deleteAttendanceSession: async (
    payload: { employee_id: string; attendance_id: string }
  ): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete('/attendance/session/delete', payload)
  },

  /**
   * 7. Punch in (check-in)
   * POST /attendance/check-in
   */
  checkIn: async (data: any): Promise<any> => {
    return apiClient.post('/attendance/check-in', data)
  },

  /**
   * 8. Break in (start break)
   * POST /attendance/break-in
   */
  breakIn: async (data: any): Promise<any> => {
    return apiClient.post('/attendance/break-in', data)
  },

  /**
   * 9. Break out (end break / resume work)
   * PATCH /attendance/break-out
   */
  breakOut: async (data: any): Promise<any> => {
    return apiClient.patch('/attendance/break-out', data)
  },

  /**
   * 10. Check out (punch out)
   * PATCH /attendance/check-out
   */
  checkOut: async (data: any): Promise<any> => {
    return apiClient.patch('/attendance/check-out', data)
  },
}
