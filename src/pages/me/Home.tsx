import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Receipt, LifeBuoy, Megaphone, PartyPopper } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import MetricCard from '@/components/admin/MetricCard'
import { useAuth } from '@/context/auth/AuthContext'
import { useUserProfileQuery } from '@/features/auth/hooks/useUserProfile'
import PunchControls from '@/components/me/PunchControls'
import {
  getPortalSummary,
  getAnnouncements,
  getUpcomingHolidays,
  type PortalSummary,
  type Announcement,
  type Holiday,
} from '@/lib/api'
import { Loading, rupee, fmtDate } from './ui'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Home() {
  const { user } = useAuth()
  const { data: profile } = useUserProfileQuery()
  const navigate = useNavigate()
  const [summary, setSummary] = useState<PortalSummary | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    Promise.all([
      getPortalSummary().catch(() => null),
      getAnnouncements().catch(() => []),
      getUpcomingHolidays().catch(() => []),
    ]).then(([s, a, h]) => {
      setSummary(s)
      setAnnouncements(a)
      setHolidays(h)
      setLoading(false)
    })
  }
  useEffect(load, [])

  const displayName = profile?.user?.first_name || user?.name || 'there'

  return (
    <Panel className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="border-b border-border px-5 py-5">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          {greeting()}, {displayName.split(' ')[0]}
        </h1>
        <p className="text-[13px] text-muted-foreground">Here's your workspace at a glance.</p>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-6 p-5">
          {/* Punch Actions (Punch in, Break in, Break out, Punch out) */}
          <PunchControls />

          {/* quick actions */}
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton icon={CalendarDays} label="Apply leave" onClick={() => navigate('/me/leave')} />
            <ActionButton icon={Receipt} label="File expense" onClick={() => navigate('/me/expenses')} />
            <ActionButton icon={LifeBuoy} label="Raise ticket" onClick={() => navigate('/me/helpdesk')} />
          </div>

          {/* metric tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <MetricCard label="Leave balance" value={String(summary?.leaveBalanceTotal ?? 0)} />
            <MetricCard label="Pending leaves" value={String(summary?.pendingLeaves ?? 0)} />
            <MetricCard label="Present this month" value={String(summary?.presentDays ?? 0)} />
            <MetricCard label="Latest net pay" value={summary?.latestPayslipNet != null ? rupee(summary.latestPayslipNet) : '—'} />
            <MetricCard label="Open tickets" value={String(summary?.openTickets ?? 0)} />
            <MetricCard label="Reviews to fill" value={String(summary?.pendingReviews ?? 0)} />
            <MetricCard label="Active objectives" value={String(summary?.activeObjectives ?? 0)} />
            <MetricCard label="Assets held" value={String(summary?.assignedAssets ?? 0)} />
          </div>

          {!summary?.employee && !profile?.user && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              No employee profile is linked to your account in this workspace yet. Ask an admin to link your phone number to
              an employee record to see your attendance, leave and payslips.
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            {/* announcements */}
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Megaphone className="size-4 text-muted-foreground" />
                <span className="text-[13px] font-semibold">Announcements</span>
              </div>
              {announcements.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">No announcements.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {announcements.slice(0, 5).map((a) => (
                    <li key={a.id} className="px-4 py-3">
                      <div className="text-[13px] font-medium">{a.title}</div>
                      {a.body && <div className="mt-0.5 text-[12px] text-muted-foreground line-clamp-2">{a.body}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* holidays */}
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <PartyPopper className="size-4 text-muted-foreground" />
                <span className="text-[13px] font-semibold">Upcoming holidays</span>
              </div>
              {holidays.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">No upcoming holidays.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {holidays.slice(0, 5).map((h) => (
                    <li key={h.id} className="flex items-center justify-between px-4 py-3">
                      <span className="text-[13px] font-medium">{h.name}</span>
                      <span className="text-[12px] text-muted-foreground">{fmtDate(h.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}

function ActionButton({ icon: Icon, label, onClick }: { icon: typeof CalendarDays; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-[13px] font-medium transition-colors hover:bg-muted"
    >
      <Icon className="size-4 text-muted-foreground" /> {label}
    </button>
  )
}
