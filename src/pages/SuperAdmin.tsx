import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Users, Briefcase, IndianRupee, LifeBuoy, ArrowLeft, Check, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'
import DbCanvas from '@/components/DbCanvas'
import PipelineCanvas from '@/components/PipelineCanvas'
import {
  getPlatformOverview,
  getPlatformTickets,
  resolveTicket,
  type PlatformOverview,
  type SupportTicketRow,
} from '@/lib/api'

const rupee = (p: number) => '₹' + Math.round(p / 100).toLocaleString('en-IN')
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })

type Tab = 'workspaces' | 'support' | 'database' | 'pipeline'

export default function SuperAdmin() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('workspaces')

  if (!user?.isSuperAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/30 text-center">
        <div>
          <p className="text-[15px] font-medium">Platform admin only</p>
          <button onClick={() => navigate('/admin')} className="mt-3 cursor-pointer text-[13px] text-[#2f63d8] hover:underline">
            ← Back to app
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-muted/30">
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-background px-6 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin')} className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Back to app">
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="font-display text-base font-semibold tracking-tight">Platform admin</h1>
            <p className="text-[11px] text-muted-foreground">myHisaab · all workspaces</p>
          </div>
        </div>
        <button onClick={() => { logout(); navigate('/login') }} className="cursor-pointer text-[13px] text-muted-foreground hover:text-foreground">
          Sign out
        </button>
      </header>

      {/* tabs — flush below the topbar, full width */}
      <div className="flex shrink-0 items-center gap-5 border-b border-border bg-background px-6">
        {([['workspaces', 'Workspaces'], ['support', 'Support'], ['database', 'Database'], ['pipeline', 'Write pipeline']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'relative -mb-px cursor-pointer py-2.5 text-[13px] font-medium transition-colors',
              tab === t ? 'text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* content fills the remaining width + height */}
      <div className="min-h-0 flex-1">
        {tab === 'database' ? (
          <DbCanvas />
        ) : tab === 'pipeline' ? (
          <PipelineCanvas />
        ) : (
          <div className="h-full overflow-auto p-6">
            {tab === 'workspaces' ? <Workspaces /> : <Support />}
          </div>
        )}
      </div>
    </div>
  )
}

function Workspaces() {
  const [data, setData] = useState<PlatformOverview | null>(null)
  useEffect(() => {
    getPlatformOverview().then(setData)
  }, [])
  if (!data) return <div className="py-16 text-center text-[13px] text-muted-foreground">Loading…</div>

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard icon={Building2} label="Workspaces" value={String(data.totals.workspaces)} />
        <StatCard icon={Users} label="Users" value={String(data.totals.users)} />
        <StatCard icon={Briefcase} label="Employees" value={String(data.totals.employees)} />
        <StatCard icon={IndianRupee} label="Revenue" value={rupee(data.totals.revenuePaise)} />
        <StatCard icon={Building2} label="Paying" value={`${data.totals.paying}/${data.totals.workspaces}`} />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/40 text-[12px] text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 text-left font-medium">Workspace</th>
              <th className="px-3 py-2.5 text-left font-medium">Owner</th>
              <th className="px-3 py-2.5 text-left font-medium">Plan</th>
              <th className="px-3 py-2.5 text-right font-medium">Employees</th>
              <th className="px-3 py-2.5 text-right font-medium">Members</th>
              <th className="px-3 py-2.5 text-right font-medium">Revenue</th>
              <th className="px-4 py-2.5 text-right font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {data.workspaces.map((w) => (
              <tr key={w.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{w.name}</td>
                <td className="px-3 py-2.5">
                  <div>{w.ownerName}</div>
                  <div className="text-[11px] text-muted-foreground">{w.ownerPhone}</div>
                </td>
                <td className="px-3 py-2.5">
                  <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium', w.plan === 'free' ? 'bg-muted text-muted-foreground' : 'bg-[#2f63d8]/10 text-[#2f63d8]')}>
                    {w.plan}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {w.employees}<span className="text-muted-foreground">/{w.employeeCap >= 1_000_000 ? '∞' : w.employeeCap}</span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{w.members}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{rupee(w.revenuePaise)}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{fmtDate(w.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Support() {
  const [tickets, setTickets] = useState<SupportTicketRow[]>([])
  const [filter, setFilter] = useState('open')
  const [loading, setLoading] = useState(true)
  const [replyFor, setReplyFor] = useState<SupportTicketRow | null>(null)

  const load = () => {
    setLoading(true)
    getPlatformTickets(filter === 'all' ? undefined : filter)
      .then(setTickets)
      .finally(() => setLoading(false))
  }
  useEffect(load, [filter])

  return (
    <div className="space-y-3">
      <div className="flex items-center rounded-lg border border-border bg-background p-0.5 text-[13px] w-max">
        {['open', 'resolved', 'all'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn('cursor-pointer rounded-md px-2.5 py-1 font-medium capitalize transition-colors', filter === f ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-[13px] text-muted-foreground">Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-border py-16 text-[13px] text-muted-foreground">
          <LifeBuoy className="mb-2 size-6 opacity-40" />
          No {filter !== 'all' ? filter : ''} tickets.
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold">{t.subject}</span>
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', t.status === 'open' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>{t.status}</span>
                  </div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">
                    {t.workspaceName} · {t.createdByName} · {fmtDate(t.createdAt)}
                  </div>
                  <p className="mt-2 text-[13px]">{t.message}</p>
                  {t.response && (
                    <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-[13px]">
                      <span className="font-medium">Response: </span>{t.response}
                    </p>
                  )}
                </div>
                {t.status === 'open' && (
                  <button onClick={() => setReplyFor(t)} className="shrink-0 cursor-pointer rounded-lg bg-foreground px-3 py-1.5 text-[12px] font-medium text-background hover:opacity-90">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {replyFor && (
        <ResolveModal
          ticket={replyFor}
          onClose={() => setReplyFor(null)}
          onDone={() => {
            setReplyFor(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function ResolveModal({ ticket, onClose, onDone }: { ticket: SupportTicketRow; onClose: () => void; onDone: () => void }) {
  const [response, setResponse] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      await resolveTicket(ticket.id, response)
      onDone()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl">
        <h2 className="font-display text-lg font-semibold tracking-tight">Resolve ticket</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{ticket.subject}</p>
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Response to the customer (optional)…"
          rows={4}
          className="mt-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-ring"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="h-9 cursor-pointer rounded-lg border border-border bg-card px-4 text-[13px] font-medium hover:bg-muted">Cancel</button>
          <button onClick={submit} disabled={busy} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Mark resolved
          </button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <Icon className="size-4 text-muted-foreground" />
      <div className="mt-2 text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}
