import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Check,
  Loader2,
  Building2,
  Users,
  CreditCard,
  Clock,
  CalendarClock,
  LayoutGrid,
  Volume2,
  History,
  Receipt,
  Wallet,
  Tag,
} from 'lucide-react'
import Panel from '@/components/admin/Panel'
import ShiftsGrid from '@/components/admin/ShiftsGrid'
import { CompanyDetailsForm } from '@/features/firm'
import PersonalDetailsSettings from '@/features/employees/components/user-me/PersonalDetailsSettings'
import RolesList from '@/features/roles/components/RolesList'
import TeamMembers from './TeamMembers'
import BillingPanel from './BillingPanel'
import StatutorySettings from './StatutorySettings'
import SalaryStructures from './SalaryStructures'
import { HolidaysSettings } from '@/features/holidays'
import AuditLog from './AuditLog'
import CategoriesSettings from '@/features/categories/components/CategoriesSettings'
import GeofencingSettings from '@/features/geofencing/components/GeofencingSettings'
import UpgradeModal from '@/components/admin/UpgradeModal'
import { MapPin } from 'lucide-react'
import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import { type Employee } from '@/lib/employees'
import {
  getAttendanceConfig,
  saveAttendanceConfig,
  assignDepartmentShift,
  getBillingSummary,
  listEmployees,
  type Shift,
  type AttendancePolicy,
  type BillingSummary,
  type Paywall,
} from '@/lib/api'
import { User, ShieldCheck } from 'lucide-react'

type Section =
  | 'general'
  | 'personal'
  | 'roles'
  | 'members'
  | 'billing'
  | 'activity'
  | 'shifts'
  | 'policy'
  | 'departments'
  | 'holidays'
  | 'statutory'
  | 'structures'
  | 'preferences'
  | 'categories'
  | 'geofencing'

interface NavItem {
  id: Section
  label: string
  icon: ComponentType<{ className?: string }>
}
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Workspace',
    items: [
      { id: 'general', label: 'Company Details', icon: Building2 },
      { id: 'personal', label: 'Personal Details', icon: User },
      { id: 'roles', label: 'Roles & Permissions', icon: ShieldCheck },
      { id: 'members', label: 'Members', icon: Users },
      { id: 'billing', label: 'Billing', icon: CreditCard },
      { id: 'activity', label: 'Activity log', icon: History },
    ],
  },
  {
    group: 'Attendance',
    items: [
      { id: 'shifts', label: 'Shifts', icon: Clock },
      { id: 'policy', label: 'Policy', icon: CalendarClock },
      { id: 'departments', label: 'Departments', icon: LayoutGrid },
      { id: 'holidays', label: 'Holidays', icon: CalendarClock },
      { id: 'geofencing', label: 'Geofencing', icon: MapPin },
    ],
  },
  {
    group: 'Payroll',
    items: [
      { id: 'statutory', label: 'Statutory', icon: Receipt },
      { id: 'structures', label: 'Salary structures', icon: Wallet },
    ],
  },
  {
    group: 'Employee Groups',
    items: [
      { id: 'categories', label: 'Categories & Subcategories', icon: Tag },
    ],
  },
  {
    group: 'Preferences',
    items: [{ id: 'preferences', label: 'Sound', icon: Volume2 }],
  },
]
const META: Record<Section, { title: string; desc: string }> = {
  general: { title: 'Company Details', desc: 'Manage your company details and pay policy configurations.' },
  personal: { title: 'Personal Details', desc: 'Manage your personal profile and preferences.' },
  roles: { title: 'Roles & Permissions', desc: 'Manage custom roles, access permissions, and employee assignments.' },
  members: { title: 'Team members', desc: 'Invite teammates and manage their roles.' },
  billing: { title: 'Billing & plan', desc: 'Your subscription, usage and invoices.' },
  activity: { title: 'Activity log', desc: 'Recent administrative actions.' },
  shifts: { title: 'Shifts', desc: 'Your shifts and their timings.' },
  policy: { title: 'Attendance policy', desc: 'Working days and late / early rules.' },
  departments: { title: 'Departments', desc: 'Assign a shift to everyone in a department.' },
  holidays: { title: 'Holiday calendar', desc: 'Public, restricted and company holidays.' },
  statutory: { title: 'Statutory configuration', desc: 'PF, ESI, Professional Tax and payroll rules.' },
  structures: { title: 'Salary structures', desc: 'Reusable salary breakups for your team.' },
  preferences: { title: 'Sound', desc: 'Interface sound effects.' },
  categories: { title: 'Categories & Subcategories', desc: 'Manage branch-level categories and subcategories for employee classification.' },
  geofencing: { title: 'Geofencing', desc: 'Manage location boundaries and geo-restrictions for employee attendance.' },
}

const ATTENDANCE_SECTIONS: Section[] = ['shifts', 'policy', 'departments']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const newShift = (isDefault: boolean): Shift => ({
  name: 'General',
  startTime: '09:00',
  endTime: '18:00',
  lateGraceMin: 10,
  earlyLeaveGraceMin: 10,
  halfDayAfterMin: 0,
  minFullDayMin: 0,
  minHalfDayMin: 0,
  isDefault,
})

const DEFAULT_POLICY: AttendancePolicy = {
  workingDays: '1,2,3,4,5',
  latesForHalfDay: 3,
  latesForAbsent: 0,
  earlyLeavesForHalfDay: 3,
  earlyLeavesForAbsent: 0,
  countingPeriod: 'month',
}

export default function Settings() {
  const { firstTabActive } = useShell()
  const { activeWorkspace } = useAuth()
  const wsId = activeWorkspace?.id ?? ''
  const isOwner = activeWorkspace?.role === 'Owner'
  const canEdit = isOwner || activeWorkspace?.role === 'Admin'
  const [searchParams, setSearchParams] = useSearchParams()
  const initialSection =
    (searchParams.get('section') as Section) ||
    (localStorage.getItem('mh.settings.section') as Section) ||
    'general'
  const [section, setSectionState] = useState<Section>(initialSection)

  const setSection = (sec: Section) => {
    setSectionState(sec)
    setSearchParams({ section: sec }, { replace: true })
    localStorage.setItem('mh.settings.section', sec)
  }

  useEffect(() => {
    const secFromUrl = searchParams.get('section') as Section | null
    if (secFromUrl && secFromUrl !== section) {
      setSectionState(secFromUrl)
      localStorage.setItem('mh.settings.section', secFromUrl)
    }
  }, [searchParams, section])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [policy, setPolicy] = useState<AttendancePolicy>(DEFAULT_POLICY)
  const [emps, setEmps] = useState<Employee[]>([])
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [billingReload, setBillingReload] = useState(0)
  const [soundOn, setSoundOn] = useState(!sound.isMuted())

  const loadBilling = () => {
    if (wsId) getBillingSummary(wsId).then(setSummary).catch(() => {})
  }

  const lastSaved = useRef('')
  const serialize = (s: Shift[], p: AttendancePolicy) => JSON.stringify({ s, p })

  useEffect(() => {
    getAttendanceConfig()
      .then((c) => {
        const s = c.shifts.length ? c.shifts : [newShift(true)]
        const p = { ...DEFAULT_POLICY, ...c.policy }
        setShifts(s)
        setPolicy(p)
        lastSaved.current = serialize(s, p)
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    listEmployees().then(setEmps).catch(() => {})
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadBilling, [wsId])

  // autosave the attendance config (shifts + policy)
  useEffect(() => {
    if (!canEdit || !lastSaved.current) return
    if (serialize(shifts, policy) === lastSaved.current) return
    const t = setTimeout(async () => {
      setSaving(true)
      setError('')
      try {
        const c = await saveAttendanceConfig({ shifts, policy })
        const mergedPolicy = { ...DEFAULT_POLICY, ...c.policy }
        lastSaved.current = serialize(c.shifts, mergedPolicy)
        setShifts(c.shifts)
        setPolicy(mergedPolicy)
        setSaved(true)
        sound.success()
        setTimeout(() => setSaved(false), 1500)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setSaving(false)
      }
    }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shifts, policy, canEdit])

  const days = new Set(policy.workingDays.split(',').filter(Boolean).map(Number))
  const toggleDay = (d: number) => {
    const next = new Set(days)
    if (next.has(d)) next.delete(d)
    else next.add(d)
    setPolicy((p) => ({ ...p, workingDays: [...next].sort((a, b) => a - b).join(',') }))
  }

  const departments = useMemo(() => {
    const map = new Map<string, { count: number; shiftIds: Set<string | null> }>()
    for (const e of emps) {
      if (!e.department) continue
      const d = map.get(e.department) ?? { count: 0, shiftIds: new Set() }
      d.count += 1
      d.shiftIds.add(e.shiftId ?? null)
      map.set(e.department, d)
    }
    return [...map.entries()]
      .map(([name, v]) => ({
        name,
        count: v.count,
        mixed: v.shiftIds.size > 1,
        shiftId: v.shiftIds.size === 1 ? [...v.shiftIds][0] : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [emps])

  const savedShifts = shifts.filter((s) => s.id)

  const assignShift = async (department: string, shiftId: string | null) => {
    setEmps((prev) => prev.map((e) => (e.department === department ? { ...e, shiftId } : e)))
    try {
      await assignDepartmentShift(department, shiftId)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const paywall: Paywall | null = summary
    ? {
        plan: summary.plan,
        usedSeats: summary.employees.used,
        seatLimit: summary.employees.cap,
        perMemberPaise: summary.perMemberPaise,
        proSeatPaise: summary.proSeatPaise,
        annualPaise: summary.annualPaise,
        annualTiers: summary.annualTiers,
      }
    : null

  const showStatus =
    canEdit && (section === 'shifts' || section === 'policy') && (saving || saved)
  const configLoading = loading && ATTENDANCE_SECTIONS.includes(section)

  return (
    <Panel className={cn('flex min-w-0 flex-1', firstTabActive && 'rounded-tl-none')}>
      {/* left settings nav */}
      <nav className="w-52 shrink-0 overflow-y-auto border-r border-border p-3">
        {NAV.map((g) => (
          <div key={g.group} className="mb-3">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {g.group}
            </p>
            <div className="space-y-0.5">
              {g.items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setSection(it.id)}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors',
                    section === it.id
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <it.icon className="size-4" />
                  {it.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* section header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <div>
            <h1 className="text-sm font-semibold">{META[section].title}</h1>
            <p className="text-[13px] text-muted-foreground">{META[section].desc}</p>
          </div>
          {showStatus && (
            <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5 text-emerald-600" />
              )}
              {saving ? 'Saving…' : 'Saved'}
            </span>
          )}
        </div>

        {/* Shifts — full-width data table in a card */}
        {section === 'shifts' ? (
          configLoading ? (
            <Loading />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col p-6">
              <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
                <ShiftsGrid shifts={shifts} onChange={setShifts} canEdit={canEdit} />
              </div>
            </div>
          )
        ) : section === 'categories' ? (
          <div className="flex min-h-0 flex-1 flex-col p-6">
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
              <CategoriesSettings />
            </div>
          </div>
        ) : section === 'geofencing' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <GeofencingSettings />
          </div>
        ) : section === 'holidays' ? (
          <div className="flex min-h-0 flex-1 flex-col p-6 overflow-hidden">
            <HolidaysSettings canEdit={canEdit} />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {!canEdit && ATTENDANCE_SECTIONS.includes(section) && (
              <p className="mb-4 max-w-2xl rounded-lg border border-border bg-muted/40 px-3 py-2 text-[13px] text-muted-foreground">
                Only the Owner or an Admin can edit attendance configuration.
              </p>
            )}

            {section === 'general' && <CompanyDetailsForm />}

            {section === 'personal' && <PersonalDetailsSettings />}

            {section === 'roles' && <RolesList />}

            {section === 'activity' && <AuditLog />}

            {section === 'statutory' && <StatutorySettings canEdit={canEdit} />}

            {section === 'structures' && <SalaryStructures canEdit={canEdit} />}

            {section === 'members' && <TeamMembers />}

            {section === 'billing' &&
              (summary ? (
                <BillingPanel
                  summary={summary}
                  isOwner={isOwner}
                  onUpgrade={() => setUpgradeOpen(true)}
                  workspaceId={wsId}
                  reloadKey={billingReload}
                  onPaid={() => {
                    loadBilling()
                    setBillingReload((k) => k + 1)
                  }}
                />
              ) : (
                <div className="py-10 text-[13px] text-muted-foreground">Loading billing…</div>
              ))}

            {section === 'policy' &&
              (configLoading ? (
                <Loading inline />
              ) : (
                <div className="max-w-3xl space-y-6">
                  <div>
                    <h2 className="mb-2 text-sm font-semibold">Working days</h2>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS.map((d, i) => (
                        <button
                          key={d}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => toggleDay(i)}
                          className={cn(
                            'h-9 w-12 cursor-pointer rounded-md border text-[13px] font-medium transition-colors',
                            days.has(i)
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-card text-muted-foreground hover:bg-muted',
                            !canEdit && 'cursor-default opacity-70',
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-sm font-semibold">Late &amp; early rules</h2>
                    <p className="mb-3 text-[13px] text-muted-foreground">
                      Convert repeated lates / early departures into a half-day or absent. 0 = off.
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <NumField label="Lates → half day" value={policy.latesForHalfDay} disabled={!canEdit} onChange={(v) => setPolicy((p) => ({ ...p, latesForHalfDay: v }))} />
                      <NumField label="Lates → absent" value={policy.latesForAbsent} disabled={!canEdit} onChange={(v) => setPolicy((p) => ({ ...p, latesForAbsent: v }))} />
                      <NumField label="Early-leaves → half day" value={policy.earlyLeavesForHalfDay} disabled={!canEdit} onChange={(v) => setPolicy((p) => ({ ...p, earlyLeavesForHalfDay: v }))} />
                      <NumField label="Early-leaves → absent" value={policy.earlyLeavesForAbsent} disabled={!canEdit} onChange={(v) => setPolicy((p) => ({ ...p, earlyLeavesForAbsent: v }))} />
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-[13px]">
                      <span className="text-muted-foreground">Count over a</span>
                      <select
                        value={policy.countingPeriod}
                        disabled={!canEdit}
                        onChange={(e) => setPolicy((p) => ({ ...p, countingPeriod: e.target.value as 'week' | 'month' }))}
                        className="h-8 cursor-pointer rounded-md border border-input bg-card px-2 text-[13px] outline-none focus:border-ring disabled:opacity-70"
                      >
                        <option value="week">week</option>
                        <option value="month">month</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}

            {section === 'departments' &&
              (configLoading ? (
                <Loading inline />
              ) : (
                <>
                  <div className="max-w-2xl overflow-hidden rounded-xl border border-border">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <span>Department</span>
                      <span className="text-right">Staff</span>
                      <span className="w-44 text-right">Shift</span>
                    </div>
                    {departments.map((d) => (
                      <div
                        key={d.name}
                        className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-b border-border px-4 py-2.5 text-[13px] last:border-b-0"
                      >
                        <span className="font-medium">{d.name}</span>
                        <span className="text-right tabular-nums text-muted-foreground">{d.count}</span>
                        <select
                          value={d.mixed ? 'mixed' : (d.shiftId ?? '')}
                          disabled={!canEdit}
                          onChange={(e) => assignShift(d.name, e.target.value ? e.target.value : null)}
                          className="h-8 w-44 cursor-pointer rounded-md border border-input bg-card px-2 text-[13px] outline-none focus:border-ring disabled:opacity-70"
                        >
                          {d.mixed && <option value="mixed" disabled>Mixed</option>}
                          <option value="">No shift</option>
                          {savedShifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                    {departments.length === 0 && (
                      <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">
                        No departments yet — add employees with departments first.
                      </div>
                    )}
                  </div>
                  {shifts.some((s) => !s.id) && (
                    <p className="mt-2 text-[12px] text-muted-foreground">
                      Save shifts first to assign newly added ones.
                    </p>
                  )}
                </>
              ))}

            {section === 'preferences' && (
              <div className="max-w-2xl">
                <div className="flex items-center justify-between rounded-xl border border-border p-4">
                  <div>
                    <div className="text-sm font-medium">Interface sounds</div>
                    <div className="text-[13px] text-muted-foreground">
                      Subtle clicks and chimes when you interact with the app.
                    </div>
                  </div>
                  <button
                    type="button"
                    data-no-sound
                    role="switch"
                    aria-checked={soundOn}
                    onClick={() => {
                      const next = !soundOn
                      setSoundOn(next)
                      sound.setMuted(!next)
                      if (next) sound.toggle()
                    }}
                    className={cn(
                      'inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors',
                      soundOn ? 'bg-primary' : 'bg-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block size-5 rounded-full bg-background shadow-sm transition-transform',
                        soundOn ? 'translate-x-5' : 'translate-x-0',
                      )}
                    />
                  </button>
                </div>
              </div>
            )}

            {error && <p className="mt-4 text-[13px] text-rose-600">{error}</p>}
          </div>
        )}
      </div>

      {upgradeOpen && paywall && (
        <UpgradeModal
          workspaceId={wsId}
          workspaceName={activeWorkspace?.name}
          paywall={paywall}
          onClose={() => setUpgradeOpen(false)}
          onSuccess={() => {
            setUpgradeOpen(false)
            loadBilling()
            setBillingReload((k) => k + 1)
          }}
        />
      )}
    </Panel>
  )
}

function Loading({ inline }: { inline?: boolean }) {
  return (
    <div
      className={cn(
        'grid place-items-center text-[13px] text-muted-foreground',
        inline ? 'py-16' : 'flex-1',
      )}
    >
      Loading configuration…
    </div>
  )
}

function NumField({
  label,
  value,
  suffix,
  disabled,
  onChange,
}: {
  label: string
  value: number
  suffix?: string
  disabled?: boolean
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 rounded-md border border-input bg-card px-2 has-[input:focus]:border-ring">
        <input
          type="number"
          min={0}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
          className="h-9 w-full bg-transparent text-[13px] outline-none disabled:opacity-70"
        />
        {suffix && <span className="text-[11px] text-muted-foreground">{suffix}</span>}
      </span>
    </label>
  )
}
