import { useEffect, useMemo, useState, type ComponentType } from 'react'
import {
  History,
  Search,
  ListFilter,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Wallet,
  FileText,
  UserPlus,
  Megaphone,
  ShieldCheck,
  Briefcase,
  Laptop,
  LifeBuoy,
  Target,
  Receipt,
  Check,
  Activity,
} from 'lucide-react'
import { EmployeeAvatar } from '@/lib/people'
import { getAuditLog, type AuditEntry } from '@/lib/api'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Relative time ("12 mins ago", "1 hour ago", "3 days ago")
// ---------------------------------------------------------------------------
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (secs < 45) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const fullTime = (s: string) =>
  new Date(s).toLocaleString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

// ---------------------------------------------------------------------------
// Visual mapping: verb → icon + tone; entity → fallback icon + readable label
// ---------------------------------------------------------------------------
type Tone = 'green' | 'rose' | 'blue' | 'amber' | 'violet' | 'gray'

const TONE_CLASS: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-600 ring-emerald-600/15',
  rose: 'bg-rose-50 text-rose-600 ring-rose-600/15',
  blue: 'bg-blue-50 text-blue-600 ring-blue-600/15',
  amber: 'bg-amber-50 text-amber-600 ring-amber-600/15',
  violet: 'bg-violet-50 text-violet-600 ring-violet-600/15',
  gray: 'bg-muted text-muted-foreground ring-border',
}

interface VerbMeta {
  icon: ComponentType<{ className?: string }>
  tone: Tone
  phrase: string
}

const VERB: Record<string, VerbMeta> = {
  create: { icon: Plus, tone: 'green', phrase: 'created' },
  add: { icon: Plus, tone: 'green', phrase: 'added' },
  post: { icon: Megaphone, tone: 'violet', phrase: 'posted' },
  update: { icon: Pencil, tone: 'blue', phrase: 'updated' },
  edit: { icon: Pencil, tone: 'blue', phrase: 'edited' },
  role: { icon: ShieldCheck, tone: 'blue', phrase: 'changed the role of' },
  assign: { icon: UserPlus, tone: 'blue', phrase: 'assigned' },
  approve: { icon: CheckCircle2, tone: 'green', phrase: 'approved' },
  reimburse: { icon: Wallet, tone: 'green', phrase: 'reimbursed' },
  finalize: { icon: CheckCircle2, tone: 'green', phrase: 'finalized' },
  issue: { icon: FileText, tone: 'green', phrase: 'issued' },
  reject: { icon: XCircle, tone: 'rose', phrase: 'rejected' },
  cancel: { icon: XCircle, tone: 'rose', phrase: 'cancelled' },
  remove: { icon: Trash2, tone: 'rose', phrase: 'removed' },
  delete: { icon: Trash2, tone: 'rose', phrase: 'deleted' },
  return: { icon: Laptop, tone: 'amber', phrase: 'returned' },
}

const ENTITY_ICON: Record<string, ComponentType<{ className?: string }>> = {
  payroll: Wallet,
  expense: Receipt,
  claim: Receipt,
  member: UserPlus,
  employee: UserPlus,
  role: ShieldCheck,
  announcement: Megaphone,
  document: FileText,
  letter: FileText,
  asset: Laptop,
  ticket: LifeBuoy,
  helpdesk: LifeBuoy,
  objective: Target,
  review: Target,
  performance: Target,
  job: Briefcase,
  hiring: Briefcase,
  candidate: Briefcase,
  deal: Activity,
  order: Receipt,
  invoice: Receipt,
}

const titleCase = (s: string) =>
  s.replace(/[_.-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

interface Decoded {
  entity: string
  entityLabel: string
  verbKey: string
  meta: VerbMeta
  icon: ComponentType<{ className?: string }>
}

function decode(a: AuditEntry): Decoded {
  // action is usually "entity.verb" (e.g. "expense.approve"); fall back gracefully
  const [rawEntity, rawVerb] = a.action.includes('.')
    ? a.action.split('.')
    : [a.entity || a.action, a.action]
  const entity = (rawEntity || '').toLowerCase()
  const verbKey = (rawVerb || '').toLowerCase()
  const meta: VerbMeta = VERB[verbKey] ?? {
    icon: ENTITY_ICON[entity] ?? Activity,
    tone: 'gray',
    phrase: titleCase(verbKey || a.action).toLowerCase(),
  }
  return {
    entity,
    entityLabel: titleCase(entity || 'item'),
    verbKey,
    meta,
    icon: meta.icon,
  }
}

const ghostBtn =
  'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

export default function AuditLog() {
  const [rows, setRows] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [entityFilter, setEntityFilter] = useState<Set<string>>(new Set())
  const [filterOpen, setFilterOpen] = useState(false)

  useEffect(() => {
    getAuditLog()
      .then(setRows)
      .finally(() => setLoading(false))
  }, [])

  // distinct entity types present, for the filter
  const entityTypes = useMemo(
    () => [...new Set(rows.map((r) => decode(r).entity).filter(Boolean))].sort(),
    [rows],
  )

  const view = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (entityFilter.size > 0 && !entityFilter.has(decode(r).entity))
        return false
      if (!q) return true
      return (
        r.actorName.toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q) ||
        (r.detail ?? '').toLowerCase().includes(q) ||
        (r.entity ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, query, entityFilter])

  const toggleEntity = (e: string) =>
    setEntityFilter((prev) => {
      const next = new Set(prev)
      if (next.has(e)) next.delete(e)
      else next.add(e)
      return next
    })

  if (loading)
    return (
      <div className="py-10 text-[13px] text-muted-foreground">Loading…</div>
    )

  return (
    <div className="max-w-2xl">
      {/* search */}
      <div className="mb-4 flex h-11 items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 shadow-sm">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search activity by name, action or details"
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
        />
        <kbd className="rounded border border-border px-1.5 text-[11px] leading-tight text-muted-foreground">
          S
        </kbd>
      </div>

      {/* header + filter */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold tracking-tight">Activity Log</h3>
        <div className="relative">
          <button
            className={cn(ghostBtn, entityFilter.size > 0 && 'text-primary')}
            onClick={() => setFilterOpen((o) => !o)}
          >
            Add Filter
            <ListFilter className="size-3.5" />
            {entityFilter.size > 0 && (
              <span className="rounded bg-primary/10 px-1 text-[11px] text-primary">
                {entityFilter.size}
              </span>
            )}
          </button>
          {filterOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setFilterOpen(false)}
              />
              <div className="absolute right-0 top-10 z-50 max-h-72 min-w-44 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
                <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Type
                </p>
                {entityTypes.length === 0 && (
                  <p className="px-2 py-1.5 text-[13px] text-muted-foreground">
                    No activity
                  </p>
                )}
                {entityTypes.map((e) => {
                  const on = entityFilter.has(e)
                  return (
                    <button
                      key={e}
                      onClick={() => toggleEntity(e)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted"
                    >
                      <span
                        className={cn(
                          'grid size-4 place-items-center rounded border',
                          on
                            ? 'border-primary bg-primary text-white'
                            : 'border-border',
                        )}
                      >
                        {on && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      {titleCase(e)}
                    </button>
                  )
                })}
                {entityFilter.size > 0 && (
                  <button
                    onClick={() => setEntityFilter(new Set())}
                    className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-muted"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* timeline */}
      {view.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-[13px] text-muted-foreground">
          <History className="mx-auto mb-2 size-6 opacity-40" />
          {rows.length === 0 ? 'No activity yet.' : 'No matching activity.'}
        </div>
      ) : (
        <ol className="relative">
          {view.map((r, i) => {
            const d = decode(r)
            const Icon = d.icon
            const last = i === view.length - 1
            return (
              <li key={r.id} className="relative flex gap-3 pb-5">
                {/* connector line */}
                {!last && (
                  <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-border" />
                )}
                {/* type icon badge */}
                <span
                  className={cn(
                    'relative z-10 grid size-8 shrink-0 place-items-center rounded-full ring-1 ring-inset',
                    TONE_CLASS[d.meta.tone],
                  )}
                >
                  <Icon className="size-4" />
                </span>

                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-baseline gap-1.5 text-[13px] leading-relaxed">
                    <EmployeeAvatar
                      name={r.actorName}
                      className="size-5 -mt-0.5 self-center"
                    />
                    <span className="font-medium">{r.actorName}</span>
                    <span className="text-muted-foreground">
                      {d.meta.phrase} {d.entityLabel.toLowerCase()}
                    </span>
                    <span className="text-muted-foreground/70">·</span>
                    <span
                      className="shrink-0 text-muted-foreground/70"
                      title={fullTime(r.createdAt)}
                    >
                      {relativeTime(r.createdAt)}
                    </span>
                  </div>
                  {r.detail && (
                    <div className="mt-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[13px] text-foreground/90">
                      {r.detail}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
