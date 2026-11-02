import { type ComponentType } from 'react'
import {
  Users,
  Tag,
  Network,
  CalendarClock,
  CalendarRange,
  CalendarCheck,
  Wallet,
  BarChart3,
  Settings,
  Sparkles,
  Receipt,
  FileText,
  MapPin,
  TrendingUp,
  History,
  CheckSquare,
  Compass,
  Building2,
  FileSpreadsheet,
} from 'lucide-react'

export const NEW_TAB_PATH = '/admin/new'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  count?: string
  badge?: string
  // key into the live nav-counts payload; resolved at render time in AppShell
  countKey?: 'employees' | 'present' | 'pendingLeaves'
}

export interface NavGroup {
  // empty label === ungrouped: items render with no header / chevron and are
  // not collapsible.
  label: string
  badge?: string
  items: NavItem[]
}

// Grouped, collapsible navigation replicating v1's exact structure with v2 design system
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Employees',
    items: [
      { to: '/admin/staff', label: 'Attendances', icon: CalendarClock },
      { to: '/admin/category', label: 'Category', icon: Tag },
    ],
  },
  {
    label: 'Requests',
    items: [
      { to: '/admin/leave', label: 'Leaves', icon: CalendarCheck },
      { to: '/admin/expenses', label: 'Expenses', icon: Receipt },
    ],
  },
  {
    label: 'Payroll',
    items: [
      { to: '/admin/payroll', label: 'Payslips', icon: Wallet },
      { to: '/admin/payroll/incentives', label: 'Incentives', icon: TrendingUp },
      { to: '/admin/payroll/templates', label: 'Templates', icon: FileText },
    ],
  },
  {
    label: 'Live Tracking',
    badge: 'BETA',
    items: [
      { to: '/admin/tracking', label: 'Realtime', icon: MapPin },
      { to: '/admin/timeline', label: 'Timeline', icon: History },
    ],
  },
  {
    label: 'Works',
    badge: 'BETA',
    items: [
      { to: '/admin/tasks', label: 'Tasks', icon: CheckSquare },
      { to: '/admin/visits', label: 'Visits', icon: Compass },
      { to: '/admin/clients', label: 'Clients', icon: Building2 },
    ],
  },
  {
    label: '',
    items: [
      { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
      { to: '/admin/monthly-roster', label: 'Monthly Roster', icon: CalendarRange },
    ],
  },
]

// flat concat of every nav item across all groups
export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)

export function navMeta(path: string): NavItem | undefined {
  if (path === NEW_TAB_PATH)
    return { to: NEW_TAB_PATH, label: 'New tab', icon: Sparkles }
  if (path === '/admin/staff' || path === '/attendance/staff') {
    return { to: '/admin/staff', label: 'Attendances', icon: CalendarClock }
  }
  if (path === '/admin/employees' || path === '/attendance/employees') {
    return { to: '/admin/employees', label: 'Employees', icon: Users }
  }
  if (path === '/admin/staff/category' || path === '/attendance/staff/category') {
    return { to: '/admin/staff/category', label: 'Category', icon: Tag }
  }
  if (path === '/admin/organization' || path === '/attendance/organization') {
    return { to: '/admin/organization', label: 'Organization', icon: Network }
  }
  if (path === '/admin/leave' || path === '/attendance/leaves') {
    return { to: '/admin/leave', label: 'Leaves', icon: CalendarCheck }
  }
  if (path === '/admin/expenses' || path === '/attendance/expenses') {
    return { to: '/admin/expenses', label: 'Expenses', icon: Receipt }
  }
  if (path === '/admin/payroll' || path === '/attendance/payslip') {
    return { to: '/admin/payroll', label: 'Payslips', icon: Wallet }
  }
  if (path === '/admin/payroll/incentives' || path === '/attendance/payroll/incentives') {
    return { to: '/admin/payroll/incentives', label: 'Incentives', icon: TrendingUp }
  }
  if (path === '/admin/payroll/templates' || path === '/attendance/payroll/templates') {
    return { to: '/admin/payroll/templates', label: 'Payroll Templates', icon: FileText }
  }
  const editPayrollMatch = path.match(/^\/admin\/payroll\/templates\/([^/]+)$/) || path.match(/^\/attendance\/payroll\/templates\/([^/]+)$/)
  if (editPayrollMatch) {
    return { to: path, label: 'Edit Payroll Template', icon: FileText }
  }
  const payslipUserMatch = path.match(/^\/admin\/payroll\/([^/]+)$/) || path.match(/^\/attendance\/payslip\/([^/]+)$/)
  if (payslipUserMatch) {
    return { to: path, label: 'Employee Payslip', icon: Wallet }
  }
  if (path === '/admin/tracking' || path === '/attendance/live-tracking') {
    return { to: '/admin/tracking', label: 'Live Tracking', icon: MapPin }
  }
  if (path === '/admin/timeline' || path === '/admin/tracking/timeline' || path === '/attendance/live-tracking/timeline') {
    return { to: '/admin/timeline', label: 'Tracking Timeline', icon: History }
  }
  if (path === '/admin/tasks' || path === '/attendance/works') {
    return { to: '/admin/tasks', label: 'Tasks', icon: CheckSquare }
  }
  if (path === '/admin/visits' || path === '/attendance/visits') {
    return { to: '/admin/visits', label: 'Visits', icon: Compass }
  }
  if (path === '/admin/clients' || path === '/attendance/clients') {
    return { to: '/admin/clients', label: 'Clients', icon: Building2 }
  }
  if (path === '/admin/monthly-roster' || path === '/admin/roster' || path === '/attendance/roaster') {
    return { to: '/admin/monthly-roster', label: 'Monthly Roster', icon: CalendarRange }
  }
  if (path === '/admin/reports' || path === '/attendance/reports') {
    return { to: '/admin/reports', label: 'Reports', icon: BarChart3 }
  }
  if (path === '/admin/report-builder' || path === '/attendance/report-builder') {
    return { to: '/admin/report-builder', label: 'Report Builder', icon: FileSpreadsheet }
  }
  const editReportTemplateMatch = path.match(/^\/admin\/report-builder\/([^/]+)$/) || path.match(/^\/attendance\/report-builder\/([^/]+)$/)
  if (editReportTemplateMatch) {
    return { to: path, label: 'Template Editor', icon: FileSpreadsheet }
  }
  if (path === '/report-viewer' || path === '/admin/report-viewer') {
    return { to: path, label: 'Report Viewer', icon: BarChart3 }
  }
  if (path === '/admin/settings' || path === '/settings') {
    return { to: '/admin/settings', label: 'Settings', icon: Settings }
  }
  const editLeaveTemplateMatch = path.match(/^\/settings\/leave-templates\/([^/]+)$/) || path.match(/^\/admin\/settings\/leave-templates\/([^/]+)$/)
  if (editLeaveTemplateMatch) {
    return { to: path, label: 'Leave Template', icon: CalendarCheck }
  }
  const editMatch = path.match(/^\/admin\/employees\/([^/]+)\/edit$/) || path.match(/^\/attendance\/staff\/([^/]+)\/edit$/)
  if (editMatch) {
    return { to: path, label: 'Edit Employee', icon: Users }
  }
  const viewMatch = path.match(/^\/admin\/employees\/([^/]+)$/) || path.match(/^\/attendance\/staff\/([^/]+)$/)
  if (viewMatch) {
    return { to: path, label: 'Employee Details', icon: Users }
  }
  if (path === '/admin/create-geo-location' || path === '/attendance/create-geo-location') {
    return { to: path, label: 'Configure Geofence', icon: MapPin }
  }
  const editGeoMatch = path.match(/^\/admin\/edit-geo-location\/([^/]+)$/) || path.match(/^\/attendance\/edit-geo-location\/([^/]+)$/)
  if (editGeoMatch) {
    return { to: path, label: 'Edit Geofence', icon: MapPin }
  }
  return ALL_NAV.find((n) => n.to === path)
}
