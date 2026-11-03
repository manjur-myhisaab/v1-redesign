import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

// Layouts and guards
import RequireAuth from './context/auth/RequireAuth'
import RequireAdmin from './context/auth/RequireAdmin'
import AppShell from './components/admin/AppShell'
import MeShell from './components/me/MeShell'
import { ThemeProvider } from './components/theme-provider'
import NotFound from './pages/NotFound'

// Lazy loaded pages
const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./features/auth/components/PhoneNumberInput'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Onboarding = lazy(() => import('./pages/admin/Onboarding'))
const Staff = lazy(() => import('./pages/admin/Staff'))
const Employees = lazy(() => import('./pages/admin/Employees'))
const EmployeeDetails = lazy(() => import('./pages/admin/staff-profile/StaffProfile'))
const StaffProfile = lazy(() => import('./pages/admin/staff-profile/StaffProfile'))
const StaffForm = lazy(() => import('./pages/admin/StaffForm'))
const EmployeeForm = lazy(() => import('./pages/admin/EmployeeForm'))
const EmployeeCategory = lazy(() => import('./pages/admin/EmployeeCategory'))
const Organization = lazy(() => import('./pages/admin/Organization'))
const Attendance = lazy(() => import('./pages/admin/Attendance'))
const Roster = lazy(() => import('./pages/admin/Roster'))
const MonthlyRoster = lazy(() => import('./pages/admin/monthly-roster/MonthlyRoster'))
const Payroll = lazy(() => import('./pages/admin/payroll/PayslipList'))
const PayrollTemplates = lazy(() => import('./pages/admin/PayrollTemplates'))
const EditPayrollTemplate = lazy(() => import('./pages/admin/EditPayrollTemplate'))
const EmployeePayslipDetails = lazy(() => import('./pages/admin/payroll/EmployeeSalaryConfig'))
const Incentives = lazy(() => import('./pages/admin/Incentives'))
const Leave = lazy(() => import('./pages/admin/Leave'))
const LeaveTemplatePage = lazy(() => import('./pages/admin/LeaveTemplatePage'))
const Tasks = lazy(() => import('./pages/admin/Tasks'))
const Visits = lazy(() => import('./pages/admin/Visits'))
const Clients = lazy(() => import('./pages/admin/Clients'))
const Crm = lazy(() => import('./pages/admin/Crm'))
const Sales = lazy(() => import('./pages/admin/Sales'))
const Expenses = lazy(() => import('./pages/admin/Expenses'))
const Hiring = lazy(() => import('./pages/admin/Hiring'))
const Documents = lazy(() => import('./pages/admin/Documents'))
const Assets = lazy(() => import('./pages/admin/Assets'))
const Helpdesk = lazy(() => import('./pages/admin/Helpdesk'))
const Performance = lazy(() => import('./pages/admin/Performance'))
const Tracking = lazy(() => import('./pages/admin/tracking/RealtimeTracking'))
const LiveTrackingTimeline = lazy(() => import('./pages/admin/LiveTrackingTimeline'))
const Reports = lazy(() => import('./pages/admin/Reports'))
const ReportViewer = lazy(() => import('./pages/admin/ReportViewer'))
const ReportBuilder = lazy(() => import('./pages/admin/ReportBuilder'))
const ReportTemplateEditor = lazy(() => import('./pages/admin/ReportTemplateEditor'))
const Messages = lazy(() => import('./pages/admin/Messages'))
const Settings = lazy(() => import('./pages/admin/Settings'))
const NewTab = lazy(() => import('./pages/admin/NewTab'))
const SuperAdmin = lazy(() => import('./pages/SuperAdmin'))
const CreateGeofencePage = lazy(() => import('./features/geofencing/components/CreateGeofencePage'))
const GeofencingListPage = lazy(() => import('./features/geofencing/components/GeofencingSettings'))

// Public & Utility pages
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const RegistrationPending = lazy(() => import('./pages/RegistrationPending'))
const ExportAttendanceCSV = lazy(() => import('./pages/ExportAttendanceCSV'))

// Employee portal pages
const MeHome = lazy(() => import('./pages/me/Home'))
const MeAttendance = lazy(() => import('./pages/me/Attendance'))
const MeLeave = lazy(() => import('./pages/me/Leave'))
const MePayslips = lazy(() => import('./pages/me/Payslips'))
const MeExpenses = lazy(() => import('./pages/me/Expenses'))
const MeDocuments = lazy(() => import('./pages/me/Documents'))
const MeAssets = lazy(() => import('./pages/me/Assets'))
const MeHelpdesk = lazy(() => import('./pages/me/Helpdesk'))
const MePerformance = lazy(() => import('./pages/me/Performance'))
const MeProfile = lazy(() => import('./pages/me/Profile'))

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <Suspense
        fallback={
          <div className="flex h-screen w-screen items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/sign-in" element={<Navigate to="/login" replace />} />
          <Route path="/sign-up" element={<Navigate to="/login" replace />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/legal/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/pending-process" element={<RegistrationPending />} />
          <Route path="/export-attendance-csv" element={<ExportAttendanceCSV />} />

          <Route element={<RequireAuth />}>
            <Route path="/onboarding" element={<Onboarding />} />

            {/* Admin only routes protected by RequireAdmin */}
            <Route element={<RequireAdmin />}>
              <Route path="/superadmin" element={<SuperAdmin />} />
              <Route path="/admin" element={<AppShell />}>
                <Route index element={<Navigate to="/admin/staff" replace />} />
                <Route path="staff" element={<Staff />} />
                <Route path="category" element={<EmployeeCategory />} />
                <Route path="staff/category" element={<Navigate to="/admin/category" replace />} />
                <Route path="new" element={<NewTab />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="staff/new" element={<StaffForm />} />
                <Route path="staff/:id/edit" element={<StaffForm />} />
                <Route path="staff/:id" element={<StaffProfile />} />
                <Route path="employees" element={<Employees />} />
                <Route path="employees/new" element={<StaffForm />} />
                <Route path="employees/:id" element={<StaffProfile />} />
                <Route path="employees/:id/edit" element={<StaffForm />} />
                <Route path="organization" element={<Organization />} />
                <Route path="attendance" element={<Attendance />} />
                <Route path="roster" element={<MonthlyRoster />} />
                <Route path="monthly-roster" element={<MonthlyRoster />} />
                <Route path="weekly-roster" element={<Roster />} />
                <Route path="leave" element={<Leave />} />
                <Route path="tracking" element={<Tracking />} />
                <Route path="timeline" element={<LiveTrackingTimeline />} />
                <Route path="tracking/timeline" element={<Navigate to="/admin/timeline" replace />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="visits" element={<Visits />} />
                <Route path="clients" element={<Clients />} />
                <Route path="crm" element={<Crm />} />
                <Route path="sales" element={<Sales />} />
                <Route path="expenses" element={<Expenses />} />
                <Route path="hiring" element={<Hiring />} />
                <Route path="documents" element={<Documents />} />
                <Route path="assets" element={<Assets />} />
                <Route path="helpdesk" element={<Helpdesk />} />
                <Route path="performance" element={<Performance />} />
                <Route path="payroll" element={<Payroll />} />
                <Route path="payroll/:userid" element={<EmployeePayslipDetails />} />
                <Route path="payroll/incentives" element={<Navigate to="/admin/incentives" replace />} />
                <Route path="payroll/templates" element={<Navigate to="/admin/templates" replace />} />
                <Route path="payroll/templates/:id" element={<EditPayrollTemplate />} />
                <Route path="incentives" element={<Incentives />} />
                <Route path="templates" element={<PayrollTemplates />} />
                <Route path="templates/:id" element={<EditPayrollTemplate />} />
                <Route path="messages" element={<Messages />} />
                <Route path="reports" element={<Reports />} />
                <Route path="report-viewer" element={<ReportViewer />} />
                <Route path="report-builder" element={<ReportBuilder />} />
                <Route path="report-builder/:id" element={<ReportTemplateEditor />} />
                <Route path="settings" element={<Settings />} />
                <Route path="settings/leave-templates/new" element={<LeaveTemplatePage />} />
                <Route path="settings/leave-templates/:template_id" element={<LeaveTemplatePage />} />
                <Route path="create-geo-location" element={<CreateGeofencePage />} />
                <Route path="edit-geo-location/:id" element={<CreateGeofencePage />} />
                <Route path="geofence-list" element={<GeofencingListPage />} />
              </Route>

              {/* Compatibility direct mappings for all v1 routes */}
              <Route path="/attendance/staff" element={<Navigate to="/admin/staff" replace />} />
              <Route path="/attendance/staff/category" element={<Navigate to="/admin/staff/category" replace />} />
              <Route path="/attendance/employees" element={<Navigate to="/admin/employees" replace />} />
              <Route path="/attendance/staff/new" element={<Navigate to="/admin/employees/new" replace />} />
              <Route path="/attendance/staff/:id" element={<Navigate to="/admin/employees/:id" replace />} />
              <Route path="/attendance/staff/:id/edit" element={<Navigate to="/admin/employees/:id/edit" replace />} />
              <Route path="/attendance/leaves" element={<Navigate to="/admin/leave" replace />} />
              <Route path="/attendance/expenses" element={<Navigate to="/admin/expenses" replace />} />
              <Route path="/attendance/payslip" element={<Navigate to="/admin/payroll" replace />} />
              <Route path="/attendance/payslip/:userid" element={<Navigate to="/admin/payroll/:userid" replace />} />
              <Route path="/attendance/payroll/incentives" element={<Navigate to="/admin/incentives" replace />} />
              <Route path="/attendance/incentives" element={<Navigate to="/admin/incentives" replace />} />
              <Route path="/attendance/payroll/templates" element={<Navigate to="/admin/templates" replace />} />
              <Route path="/attendance/templates" element={<Navigate to="/admin/templates" replace />} />
              <Route path="/attendance/payroll/templates/:id" element={<Navigate to="/admin/templates/:id" replace />} />
              <Route path="/attendance/templates/:id" element={<Navigate to="/admin/templates/:id" replace />} />
              <Route path="/attendance/live-tracking" element={<Navigate to="/admin/tracking" replace />} />
              <Route path="/attendance/live-tracking/timeline" element={<Navigate to="/admin/timeline" replace />} />
              <Route path="/attendance/works" element={<Navigate to="/admin/tasks" replace />} />
              <Route path="/attendance/visits" element={<Navigate to="/admin/visits" replace />} />
              <Route path="/attendance/clients" element={<Navigate to="/admin/clients" replace />} />
              <Route path="/attendance/roaster" element={<Navigate to="/admin/roster" replace />} />
              <Route path="/attendance/reports" element={<Navigate to="/admin/reports" replace />} />
              <Route path="/report-viewer" element={<Navigate to="/admin/report-viewer" replace />} />
              <Route path="/attendance/report-builder" element={<Navigate to="/admin/report-builder" replace />} />
              <Route path="/attendance/report-builder/:id" element={<Navigate to="/admin/report-builder/:id" replace />} />
              <Route path="/attendance/create-geo-location" element={<Navigate to="/admin/create-geo-location" replace />} />
              <Route path="/attendance/edit-geo-location/:id" element={<Navigate to="/admin/edit-geo-location/:id" replace />} />
              <Route path="/attendance/geofence-create" element={<Navigate to="/admin/create-geo-location" replace />} />
              <Route path="/attendance/geofence-create/:id" element={<Navigate to="/admin/edit-geo-location/:id" replace />} />
              <Route path="/attendance/geofence-list" element={<Navigate to="/admin/geofence-list" replace />} />
              <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
              <Route path="/settings/leave-templates/new" element={<Navigate to="/admin/settings/leave-templates/new" replace />} />
              <Route path="/settings/leave-templates/:template_id" element={<Navigate to="/admin/settings/leave-templates/:template_id" replace />} />
              <Route path="/crm/leads" element={<Navigate to="/admin/crm" replace />} />
              <Route path="/orders" element={<Navigate to="/admin/sales" replace />} />
              <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
            </Route>

            {/* Employee self-service portal */}
            <Route path="/me" element={<MeShell />}>
              <Route index element={<MeHome />} />
              <Route path="attendance" element={<MeAttendance />} />
              <Route path="leave" element={<MeLeave />} />
              <Route path="payslips" element={<MePayslips />} />
              <Route path="expenses" element={<MeExpenses />} />
              <Route path="documents" element={<MeDocuments />} />
              <Route path="assets" element={<MeAssets />} />
              <Route path="helpdesk" element={<MeHelpdesk />} />
              <Route path="performance" element={<MePerformance />} />
              <Route path="profile" element={<MeProfile />} />
            </Route>
          </Route>

          {/* Catch-all 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ThemeProvider>
  )
}

export default App
