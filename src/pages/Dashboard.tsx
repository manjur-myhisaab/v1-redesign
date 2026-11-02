import { useEffect, useState } from 'react'
import { ChevronDown, AlertTriangle, IndianRupee } from 'lucide-react'
import MetricCard from '@/components/admin/MetricCard'
import AreaChart from '@/components/admin/AreaChart'
import BarChart from '@/components/admin/BarChart'
import GaugeChart from '@/components/admin/GaugeChart'
import Panel from '@/components/admin/Panel'
import PageTabs from '@/components/admin/PageTabs'
import Announcements from '@/components/admin/Announcements'
import PersonAvatar from '@/components/admin/PersonAvatar'
import StatusBadge, { type StatusTone } from '@/components/admin/StatusBadge'
import { useShell } from '@/components/admin/shell-context'
import { cn } from '@/lib/utils'
import { statusTone, genderSex } from '@/lib/employees'
import { getDashboardStats, type DashboardStats } from '@/lib/api'

const TABS = ['Cockpit', 'Other metrics'] as const

const rupee = (paise: number) => '₹' + Math.round(paise / 100).toLocaleString('en-IN')
const toLakh = (paise: number) => +(paise / 100 / 100_000).toFixed(2)
const shortDept = (d: string) => (d.length > 5 ? d.slice(0, 4) : d)
const monthShort = (period: string) => {
  const d = new Date(`${period}-01`)
  return Number.isNaN(d.getTime())
    ? period
    : d.toLocaleString('en-US', { month: 'short' })
}
const tenureLabel = (months: number) =>
  months >= 12 ? `${(months / 12).toFixed(1)} yrs` : `${months} mo`

interface RiskRow {
  name: string
  gender?: string
  amount: string
  meta: string
  status: { label: string; tone: StatusTone }
}

export default function Dashboard() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Cockpit')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const { firstTabActive } = useShell()

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  return (
    <Panel
      className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}
    >
      {/* tabs */}
      <PageTabs
        tabs={TABS.map((t) => ({ key: t, label: t }))}
        active={tab}
        onChange={setTab}
      />

      {loading || !stats ? (
        <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">
          {loading ? 'Loading dashboard…' : 'No data'}
        </div>
      ) : tab === 'Cockpit' ? (
        <Cockpit stats={stats} />
      ) : (
        <OtherMetrics stats={stats} />
      )}
    </Panel>
  )
}

function Cockpit({ stats }: { stats: DashboardStats }) {
  const deptBars = stats.byDepartment.map((d) => ({
    label: shortDept(d.department),
    value: Math.round(d.costPaise / 100),
  }))
  const trend = stats.payrollTrend.map((p) => ({
    label: monthShort(p.period),
    value: toLakh(p.netPaise),
  }))
  const activePct = stats.employees
    ? Math.round((stats.activeEmployees / stats.employees) * 100)
    : 0

  const pending: RiskRow[] = stats.pendingApprovals.map((p) => ({
    name: p.name,
    gender: p.gender,
    amount: p.paise != null ? rupee(p.paise) : '—',
    meta: p.detail,
    status: { label: p.kind, tone: p.kind === 'Leave' ? 'amber' : 'violet' },
  }))
  const topSalaries: RiskRow[] = stats.topSalaries.map((t) => ({
    name: t.name,
    gender: t.gender,
    amount: rupee(t.paise),
    meta: t.department,
    status: { label: t.status, tone: statusTone(t.status) },
  }))

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
      {/* row 1: metric cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Employees" value={String(stats.employees)} />
        <MetricCard label="Attendance today" value={`${stats.attendanceRatePct}%`} />
        <MetricCard label="Avg salary" value={rupee(stats.avgSalaryPaise)} />
        <MetricCard label="Monthly payroll" value={rupee(stats.monthlyPayrollPaise)} />
      </div>

      <Announcements />

      {/* main bento */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* left column */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-medium">Active staff</h2>
              <div className="mt-1">
                <GaugeChart
                  value={activePct}
                  caption={`${stats.activeEmployees} of ${stats.employees} active`}
                  color="#10b981"
                />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-medium">Attendance</h2>
              <div className="mt-1">
                <GaugeChart
                  value={stats.attendanceRatePct}
                  caption={`${stats.presentToday} of ${stats.employees} present`}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-medium">Cost by department</h2>
            <p className="text-xs text-muted-foreground">Monthly CTC (₹)</p>
            <div className="mt-1">
              {deptBars.length ? (
                <BarChart data={deptBars} height={220} color="#93b4f5" />
              ) : (
                <Empty>No employees yet</Empty>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Avg tenure" value={tenureLabel(stats.avgTenureMonths)} />
            <MetricCard
              label="Largest salary"
              value={stats.maxSalary ? rupee(stats.maxSalary.paise) : '—'}
            />
          </div>
        </div>

        {/* right column */}
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-medium">Payroll this year</h2>
            <p className="text-xs text-muted-foreground">Monthly run total (₹ lakh)</p>
            <div className="mt-1">
              {trend.length ? (
                <AreaChart data={trend} height={210} color="#7c5cff" />
              ) : (
                <Empty>No payroll runs yet</Empty>
              )}
            </div>
          </div>

          <RiskTable
            title="Pending approvals"
            count={pending.length}
            icon={<AlertTriangle className="size-3.5 text-amber-500" />}
            rows={pending}
            empty="Nothing pending"
          />
          <RiskTable
            title="Top salaries"
            count={topSalaries.length}
            icon={<IndianRupee className="size-3.5 text-emerald-600" />}
            rows={topSalaries}
            empty="No employees yet"
          />
        </div>
      </div>
    </div>
  )
}

function OtherMetrics({ stats }: { stats: DashboardStats }) {
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
      <div>
        <h2 className="text-sm font-medium">Headcount by status</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {stats.statusCounts.map((s) => (
            <span
              key={s.status}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px]"
            >
              <StatusBadge tone={statusTone(s.status)}>{s.status}</StatusBadge>
              <span className="font-medium tabular-nums">{s.count}</span>
            </span>
          ))}
          {stats.statusCounts.length === 0 && <Empty>No employees yet</Empty>}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Department</span>
          <span className="text-right">Headcount</span>
          <span className="w-28 text-right">Monthly cost</span>
        </div>
        {stats.byDepartment.map((d) => (
          <div
            key={d.department}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-t border-border px-4 py-2 text-[13px]"
          >
            <span className="font-medium">{d.department}</span>
            <span className="text-right tabular-nums">{d.count}</span>
            <span className="w-28 text-right tabular-nums">{rupee(d.costPaise)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-32 place-items-center text-[13px] text-muted-foreground">
      {children}
    </div>
  )
}

function RiskTable({
  title,
  count,
  icon,
  rows,
  empty,
}: {
  title: string
  count: number
  icon: React.ReactNode
  rows: RiskRow[]
  empty: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium">
        {icon}
        {title}
        <span className="text-muted-foreground">· {count}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </div>
      {rows.length === 0 ? (
        <div className="border-t border-border px-4 py-4 text-center text-[13px] text-muted-foreground">
          {empty}
        </div>
      ) : (
        rows.map((r, i) => (
          <div
            key={`${r.name}-${i}`}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-t border-border px-4 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <PersonAvatar name={r.name} sex={genderSex(r.gender ?? '')} className="size-5" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{r.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {r.meta}
                </span>
              </span>
            </div>
            <span className="text-right text-[13px] tabular-nums">{r.amount}</span>
            <span className="w-20 text-right">
              <StatusBadge tone={r.status.tone}>{r.status.label}</StatusBadge>
            </span>
          </div>
        ))
      )}
    </div>
  )
}
