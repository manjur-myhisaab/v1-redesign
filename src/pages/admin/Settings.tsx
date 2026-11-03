import { useEffect, useState, type ComponentType } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Building2,
  User,
  ShieldCheck,
  Clock,
  CalendarDays,
  CalendarCheck,
  CreditCard,
  SlidersHorizontal,
  Settings as SettingsIcon,
  Server,
  MapPin,
} from 'lucide-react'

import Panel from '@/components/admin/Panel'
import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'
import { ALLOWED_SERVER_CONTROL_USER_IDS } from '@/services/server'

// V1 Sub-feature Components with dedicated modular folders
import CompanyDetailsSettings from './settings/company-details/CompanyDetailsSettings'
import PersonalDetailsSettings from './settings/personal-details/PersonalDetailsSettings'
import CompanyShiftsSettings from './settings/company-shifts/CompanyShiftsSettings'
import PayrollConfigurationSettings from './settings/payroll-configuration/PayrollConfigurationSettings'
import DesignationsPermissionsSettings from './settings/designations-permissions/DesignationsPermissionsSettings'
import HolidaysSettings from './settings/holidays/HolidaysSettings'
import LeaveManagementSettings from './settings/leave-management/LeaveManagementSettings'
import SystemSettings from './settings/system-settings/SystemSettings'
import PreferencesSettings from './settings/preferences/PreferencesSettings'
import ServerControlSettings from './settings/server-control/ServerControlSettings'

type Section =
  | 'company'
  | 'personal'
  | 'roles'
  | 'shifts'
  | 'holidays'
  | 'leaves'
  | 'payroll-config'
  | 'system-settings'
  | 'preferences'
  | 'server-control'

interface NavItem {
  id: Section
  label: string
  icon: ComponentType<{ className?: string }>
}

interface NavGroup {
  group: string
  items: NavItem[]
}

const META: Record<Section, { title: string; desc: string }> = {
  company: {
    title: 'Company Details',
    desc: 'Manage your organization profile, GSTIN, pay cycle, and attendance policies.',
  },
  personal: {
    title: 'Personal Details',
    desc: 'Manage your administrator profile, contact info, and tracking parameters.',
  },
  roles: {
    title: 'Designations & Permissions',
    desc: 'Configure designations and granular module access rights (View, Add, Edit, Delete).',
  },
  shifts: {
    title: 'Company Shifts',
    desc: 'Define work hours, grace periods, overnight settings, and minimum shift requirements.',
  },
  holidays: {
    title: 'Holiday Listing',
    desc: 'Declare and manage public, national, and custom holiday schedules for your workspace.',
  },
  leaves: {
    title: 'Leave Management',
    desc: 'Configure leave quotas, types, and company-wide leave policies.',
  },
  'payroll-config': {
    title: 'Payroll Configuration',
    desc: 'Manage recurring earnings, allowances, deductions, and salary calculation formulas.',
  },
  'system-settings': {
    title: 'System Settings',
    desc: 'Enable or disable core functional modules and features for your workspace.',
  },
  preferences: {
    title: 'Preferences',
    desc: 'Personalize system appearance (Light / Dark mode) and interface sound cues.',
  },
  'server-control': {
    title: 'Developer Server Environment',
    desc: 'Switch active backend endpoint dynamically for testing and staging environments.',
  },
}

export default function Settings() {
  const { firstTabActive } = useShell()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const currentUserId = String(user?.id || (user as any)?.user_id || '')
  const isAuthorizedDev = ALLOWED_SERVER_CONTROL_USER_IDS.includes(currentUserId)

  // Map legacy / URL alias params to valid section
  const normalizeSection = (param: string | null): Section => {
    if (!param) return 'company'
    if (param === 'general') return 'company'
    if (param === 'structures' || param === 'statutory') return 'payroll-config'
    if (param === 'policy' || param === 'departments') return 'shifts'
    return (param as Section) || 'company'
  }

  const initialSection = normalizeSection(
    searchParams.get('section') || localStorage.getItem('mh.settings.section')
  )

  const [section, setSectionState] = useState<Section>(initialSection)

  const setSection = (sec: Section) => {
    setSectionState(sec)
    setSearchParams({ section: sec }, { replace: true })
    localStorage.setItem('mh.settings.section', sec)
  }

  useEffect(() => {
    const secFromUrl = searchParams.get('section')
    if (secFromUrl) {
      const normalized = normalizeSection(secFromUrl)
      if (normalized !== section) {
        setSectionState(normalized)
        localStorage.setItem('mh.settings.section', normalized)
      }
    }
  }, [searchParams, section])

  // Build navigation items exclusively from v1 Settings
  const navGroups: NavGroup[] = [
    {
      group: 'Organization',
      items: [
        { id: 'company', label: 'Company Details', icon: Building2 },
        { id: 'personal', label: 'Personal Details', icon: User },
        { id: 'roles', label: 'Designations & Permissions', icon: ShieldCheck },
      ],
    },
    {
      group: 'Attendance & Leave',
      items: [
        { id: 'shifts', label: 'Company Shifts', icon: Clock },
        { id: 'holidays', label: 'Holiday Listing', icon: CalendarDays },
        { id: 'leaves', label: 'Leave Management', icon: CalendarCheck },
      ],
    },
    {
      group: 'Payroll',
      items: [
        { id: 'payroll-config', label: 'Payroll Configuration', icon: CreditCard },
      ],
    },
    {
      group: 'System & Preferences',
      items: [
        { id: 'system-settings', label: 'System Settings', icon: SlidersHorizontal },
        { id: 'preferences', label: 'Preferences', icon: SettingsIcon },
        ...(isAuthorizedDev
          ? [{ id: 'server-control' as Section, label: 'Server Environment', icon: Server }]
          : []),
      ],
    },
  ]

  const currentMeta = META[section] || META.company

  return (
    <Panel className={cn('flex min-w-0 flex-1', firstTabActive && 'rounded-tl-none')}>
      {/* Left Settings Sidebar Navigation */}
      <nav className="w-56 shrink-0 overflow-y-auto border-r border-border p-3.5 bg-muted/10">
        {navGroups.map((g) => (
          <div key={g.group} className="mb-4">
            <p className="px-2.5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
              {g.group}
            </p>
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = it.icon
                const isActive = section === it.id

                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => setSection(it.id)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors text-left',
                      isActive
                        ? 'bg-card font-semibold text-primary shadow-2xs border border-border/80'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                  >
                    <Icon className={cn('size-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="truncate">{it.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Right Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {section === 'company' && <CompanyDetailsSettings />}
        {section === 'personal' && <PersonalDetailsSettings />}
        {section === 'roles' && <DesignationsPermissionsSettings />}
        {section === 'shifts' && <CompanyShiftsSettings />}
        {section === 'holidays' && <HolidaysSettings />}
        {section === 'leaves' && <LeaveManagementSettings />}
        {section === 'payroll-config' && <PayrollConfigurationSettings />}
        {section === 'system-settings' && <SystemSettings />}
        {section === 'preferences' && <PreferencesSettings />}
        {section === 'server-control' && <ServerControlSettings />}
      </div>
    </Panel>
  )
}
