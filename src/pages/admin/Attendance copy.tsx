import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  Clock,
  LogOut,
  MoreHorizontal,
  Loader2,
  Plus,
  X,
  Coffee,
  Briefcase,
} from 'lucide-react'
import Panel from '@/components/admin/Panel'
import MetricCard from '@/components/admin/MetricCard'
import { EmployeeAvatar } from '@/lib/people'
import { DatePicker } from '@/components/ui/date-picker'
import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import {
  getAttendanceDay,
  markAttendance,
  type RosterSubject,
  type AttendanceStatus,
  type MarkEntry,
  type PunchSession,
  type Shift,
} from '@/lib/api'
import { genConfig, type AvatarFullConfig } from 'react-nice-avatar'

// ─── date helpers (local, timezone-safe) ───
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const longDate = (d: Date) =>
  d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })

// ─── time helpers ───
const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const span = (inT: string, outT: string) => {
  if (!inT || !outT) return 0
  const d = toMin(outT) - toMin(inT)
  // Equal marks = 0 (a same-minute punch), not a spurious 24h; only a genuinely
  // negative delta means the shift wrapped past midnight.
  return d >= 0 ? d : d + 24 * 60
}
const fmtDur = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
}
const sessionTotals = (sessions: PunchSession[]) => {
  let worked = 0
  let brk = 0
  for (const s of sessions) {
    const d = span(s.in, s.out)
    if (s.type === 'break') brk += d
    else worked += d
  }
  return { worked, brk }
}

// ─── status model ───
type Marked = '' | AttendanceStatus

interface Draft {
  status: Marked
  late: boolean
  earlyOut: boolean
  sessions: PunchSession[] // each work session carries its own shiftId
}

const PRIMARY: { key: AttendanceStatus; label: string; short: string; active: string }[] = [
  { key: 'present', label: 'Present', short: 'P', active: 'bg-emerald-500 text-white ring-emerald-500' },
  { key: 'halfday', label: 'Half day', short: 'H', active: 'bg-amber-500 text-white ring-amber-500' },
  { key: 'leave', label: 'Leave', short: 'L', active: 'bg-blue-500 text-white ring-blue-500' },
  { key: 'absent', label: 'Absent', short: 'A', active: 'bg-rose-500 text-white ring-rose-500' },
]
const MORE: { key: AttendanceStatus; label: string }[] = [
  { key: 'weekoff', label: 'Week off' },
  { key: 'holiday', label: 'Holiday' },
]
const ALL_STATUS = [...PRIMARY, ...MORE.map((m) => ({ ...m, short: '', active: '' }))]
const statusLabel = (s: Marked) => ALL_STATUS.find((x) => x.key === s)?.label ?? '—'

type Filter = 'all' | 'employee' | 'member'

const memberAvatar = (raw: string, name: string): AvatarFullConfig => {
  if (raw) {
    try {
      return JSON.parse(raw) as AvatarFullConfig
    } catch {
      /* fall through */
    }
  }
  return genConfig(name)
}

export default function Attendance() {
  const { firstTabActive } = useShell()
  const { activeWorkspace } = useAuth()
  const canMark = activeWorkspace?.role === 'Owner' || activeWorkspace?.role === 'Admin'

  const [date, setDate] = useState(() => new Date())
  const [subjects, setSubjects] = useState<RosterSubject[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  // working copy + the server baseline (to compute what's dirty)
  const [draft, setDraft] = useState<Record<string, Draft>>({})
  const baseline = useRef<Record<string, Draft>>({})

  const dstr = ymd(date)

  useEffect(() => {
    let live = true
    setLoading(true)
    getAttendanceDay(dstr)
      .then((day) => {
        if (!live) return
        setSubjects(day.subjects)
        setShifts(day.shifts)
        const init: Record<string, Draft> = {}
        for (const s of day.subjects) {
          init[s.id] = {
            status: (s.record?.status ?? '') as Marked,
            late: s.record?.late ?? false,
            earlyOut: s.record?.earlyOut ?? false,
            sessions: s.record?.sessions ?? [],
          }
        }
        baseline.current = init
        setDraft(structuredClone(init))
      })
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [dstr])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return subjects.filter((s) => {
      if (filter !== 'all' && s.kind !== filter) return false
      if (q && !s.name.toLowerCase().includes(q) && !s.subtitle.toLowerCase().includes(q))
        return false
      return true
    })
  }, [subjects, query, filter])

  const counts = useMemo(() => {
    const c = { present: 0, halfday: 0, leave: 0, absent: 0, off: 0, unmarked: 0, late: 0 }
    for (const s of subjects) {
      const st = draft[s.id]?.status ?? ''
      if (st === 'present') c.present++
      else if (st === 'halfday') c.halfday++
      else if (st === 'leave') c.leave++
      else if (st === 'absent') c.absent++
      else if (st === 'weekoff' || st === 'holiday') c.off++
      else c.unmarked++
      if ((st === 'present' || st === 'halfday') && draft[s.id]?.late) c.late++
    }
    return c
  }, [subjects, draft])

  const dirtyIds = useMemo(
    () =>
      Object.keys(draft).filter((id) => {
        const a = draft[id]
        const b = baseline.current[id]
        return (
          a.status !== b.status ||
          a.late !== b.late ||
          a.earlyOut !== b.earlyOut ||
          JSON.stringify(a.sessions) !== JSON.stringify(b.sessions)
        )
      }),
    [draft],
  )

  const setStatus = (id: string, status: AttendanceStatus) => {
    sound.click()
    setDraft((d) => {
      const cur: Draft = d[id] ?? { status: '', late: false, earlyOut: false, sessions: [] }
      // toggle off if re-tapping the same status
      const next = cur.status === status ? '' : status
      const present = next === 'present' || next === 'halfday'
      return {
        ...d,
        [id]: { ...cur, status: next, late: present && cur.late, earlyOut: present && cur.earlyOut },
      }
    })
  }

  const toggleFlag = (id: string, flag: 'late' | 'earlyOut') =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], [flag]: !d[id][flag] } }))

  const setSessions = (id: string, sessions: PunchSession[]) =>
    setDraft((d) => {
      const cur = d[id]
      // first punch implies the person was present
      const status = cur.status || (sessions.length ? 'present' : '')
      return { ...d, [id]: { ...cur, sessions, status } }
    })

  const markAllPresent = () => {
    sound.toggle()
    setDraft((d) => {
      const next = { ...d }
      for (const s of filtered) next[s.id] = { ...next[s.id], status: 'present' }
      return next
    })
  }

  const save = async () => {
    if (saving || !dirtyIds.length) return
    setSaving(true)
    const byId = new Map(subjects.map((s) => [s.id, s]))
    const entries: MarkEntry[] = dirtyIds
      .map((id) => {
        const s = byId.get(id)
        const dr = draft[id]
        if (!s) return null
        const status = dr.status || (dr.sessions.length ? 'present' : '')
        // each work session carries its own shiftId; for a no-punch "present"
        // fall back to the roster-planned shift so the day still records one
        const base: MarkEntry = status
          ? {
              status,
              late: dr.late,
              earlyOut: dr.earlyOut,
              sessions: dr.sessions,
              shiftId: s.rosterShiftId ?? null,
            }
          : { status: 'clear' } // un-marked → remove the saved record
        if (s.kind === 'employee') base.employeeId = s.employeeId
        else base.userId = s.userId
        return base
      })
      .filter((e): e is MarkEntry => e !== null)

    try {
      await markAttendance(dstr, entries)
      baseline.current = structuredClone(draft)
      // force dirty recompute
      setDraft((d) => ({ ...d }))
      sound.success()
    } catch {
      sound.error()
    } finally {
      setSaving(false)
    }
  }

  const isToday = dstr === ymd(new Date())

  return (
    <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
      {/* summary metrics for the selected day */}
      <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-border p-4 lg:grid-cols-4">
        <MetricCard label="Present" value={loading ? '—' : String(counts.present + counts.halfday)} />
        <MetricCard label="Absent" value={loading ? '—' : String(counts.absent)} />
        <MetricCard label="Late" value={loading ? '—' : String(counts.late)} />
        <MetricCard label="On leave" value={loading ? '—' : String(counts.leave)} />
      </div>

      {/* header: day navigation + actions */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-semibold tracking-tight">Attendance</h2>
          <span className="text-muted-foreground">·</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDate((d) => addDays(d, -1))}
              aria-label="Previous day"
              className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <DatePicker
              value={date}
              onChange={(d) => d && setDate(d)}
              className="h-8 w-[230px]"
            />
            <button
              onClick={() => setDate((d) => addDays(d, 1))}
              aria-label="Next day"
              className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
            {!isToday && (
              <button
                onClick={() => setDate(new Date())}
                className="ml-1 cursor-pointer rounded-md px-2 py-1 text-[13px] font-medium text-[#2f63d8] transition-colors hover:bg-[#2f63d8]/10"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {canMark && (
          <div className="flex items-center gap-2">
            <button
              onClick={markAllPresent}
              disabled={loading}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              Mark all present
            </button>
            <button
              onClick={save}
              disabled={saving || !dirtyIds.length}
              className="btn-3d inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-3.5 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              {saving ? 'Saving…' : dirtyIds.length ? `Save (${dirtyIds.length})` : 'Saved'}
            </button>
          </div>
        )}
      </div>

      {/* sub-header: date label + summary chips + search/filter */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-2.5">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="font-medium">{longDate(date)}</span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <Chip tone="emerald" label="Present" n={counts.present} />
            <Chip tone="amber" label="Half" n={counts.halfday} />
            <Chip tone="blue" label="Leave" n={counts.leave} />
            <Chip tone="rose" label="Absent" n={counts.absent} />
            {counts.unmarked > 0 && <Chip tone="gray" label="Unmarked" n={counts.unmarked} />}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5 text-[13px]">
            {(['all', 'employee', 'member'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'cursor-pointer rounded-md px-2.5 py-1 font-medium capitalize transition-colors',
                  filter === f ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f === 'all' ? 'All' : f === 'employee' ? 'Employees' : 'Members'}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people…"
              className="h-8 w-44 rounded-lg border border-border bg-card pl-8 pr-3 text-[13px] outline-none transition-colors focus:border-ring"
            />
          </div>
        </div>
      </div>

      {/* register */}
      {loading ? (
        <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">
          Loading register…
        </div>
      ) : filtered.length === 0 ? (
        <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">
          No people to show.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ul className="divide-y divide-border">
            {filtered.map((s) => (
              <Row
                key={s.id}
                subject={s}
                draft={draft[s.id]}
                canMark={canMark}
                shifts={shifts}
                onStatus={(st) => setStatus(s.id, st)}
                onFlag={(f) => toggleFlag(s.id, f)}
                onSessions={(ss) => setSessions(s.id, ss)}
              />
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

function Row({
  subject,
  draft,
  canMark,
  shifts,
  onStatus,
  onFlag,
  onSessions,
}: {
  subject: RosterSubject
  draft: Draft
  canMark: boolean
  shifts: Shift[]
  onStatus: (s: AttendanceStatus) => void
  onFlag: (f: 'late' | 'earlyOut') => void
  onSessions: (s: PunchSession[]) => void
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [punchOpen, setPunchOpen] = useState(false)
  const status = draft?.status ?? ''
  const present = status === 'present' || status === 'halfday'
  const isOff = status === 'weekoff' || status === 'holiday'
  const sessions = draft?.sessions ?? []
  const { worked, brk } = sessionTotals(sessions)

  return (
    <li className="px-5 py-2.5 transition-colors hover:bg-muted/40">
      <div className="flex items-center gap-3">
        {/* identity */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {subject.kind === 'member' ? (
            <EmployeeAvatar
              name={subject.name}
              config={memberAvatar(subject.avatar, subject.name)}
              className="size-8"
            />
          ) : (
            <EmployeeAvatar
              name={subject.name}
              sex={subject.gender === 'man' ? 'man' : subject.gender === 'woman' ? 'woman' : undefined}
              className="size-8"
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-medium">{subject.name}</span>
              {subject.kind === 'member' && (
                <span className="rounded bg-[#2f63d8]/10 px-1.5 py-px text-[10px] font-medium text-[#2f63d8]">
                  Member
                </span>
              )}
            </div>
            {subject.subtitle && (
              <div className="truncate text-[12px] text-muted-foreground">{subject.subtitle}</div>
            )}
          </div>
        </div>

        {/* punch summary / toggle */}
        {canMark && (
          <button
            onClick={() => setPunchOpen((o) => !o)}
            title="Punch times & breaks"
            className={cn(
              'hidden h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors sm:inline-flex',
              punchOpen
                ? 'border-[#2f63d8] bg-[#2f63d8]/5 text-[#2f63d8]'
                : 'border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            <Clock className="size-3" />
            {sessions.length ? (
              <span className="tabular-nums">
                {fmtDur(worked)}
                {brk > 0 && <span className="text-amber-600"> · {fmtDur(brk)} brk</span>}
              </span>
            ) : (
              'Punches'
            )}
          </button>
        )}

        {/* late / early flags (only when present-ish) */}
        {canMark && present && (
          <div className="hidden items-center gap-1.5 md:flex">
            <FlagToggle
              active={draft.late}
              onClick={() => onFlag('late')}
              icon={<Clock className="size-3" />}
              label="Late"
            />
            <FlagToggle
              active={draft.earlyOut}
              onClick={() => onFlag('earlyOut')}
              icon={<LogOut className="size-3" />}
              label="Early"
            />
          </div>
        )}

        {/* status control */}
        {canMark ? (
          <div className="flex items-center gap-1.5">
            {isOff ? (
              <span className="inline-flex h-7 items-center rounded-lg bg-slate-100 px-3 text-[12px] font-medium text-slate-600">
                {statusLabel(status)}
              </span>
            ) : (
              <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
                {PRIMARY.map((p) => (
                  <button
                    key={p.key}
                    title={p.label}
                    onClick={() => onStatus(p.key)}
                    className={cn(
                      'grid size-7 cursor-pointer place-items-center rounded-md text-[12px] font-semibold ring-1 ring-transparent transition-colors',
                      status === p.key
                        ? p.active
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {p.short}
                  </button>
                ))}
              </div>
            )}

            <div className="relative">
              <button
                onClick={() => setMoreOpen((o) => !o)}
                aria-label="More statuses"
                className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-lg border border-border bg-background py-1 shadow-lg">
                    {MORE.map((m) => (
                      <button
                        key={m.key}
                        onClick={() => {
                          onStatus(m.key)
                          setMoreOpen(false)
                        }}
                        className={cn(
                          'flex w-full cursor-pointer items-center px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-muted',
                          status === m.key && 'font-medium',
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <ReadOnlyStatus
            status={status}
            late={draft?.late}
            earlyOut={draft?.earlyOut}
            sessions={sessions}
          />
        )}
      </div>

      {/* punch / break editor */}
      {canMark && punchOpen && (
        <PunchEditor
          sessions={sessions}
          worked={worked}
          brk={brk}
          shifts={shifts}
          defaultShiftId={subject.rosterShiftId}
          onChange={onSessions}
        />
      )}
    </li>
  )
}

function PunchEditor({
  sessions,
  worked,
  brk,
  shifts,
  defaultShiftId,
  onChange,
}: {
  sessions: PunchSession[]
  worked: number
  brk: number
  shifts: Shift[]
  defaultShiftId: string | null
  onChange: (s: PunchSession[]) => void
}) {
  const update = (i: number, patch: Partial<PunchSession>) =>
    onChange(sessions.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  const remove = (i: number) => onChange(sessions.filter((_, idx) => idx !== i))
  // seed a new work session from its shift's start/end when known
  const add = (type: 'work' | 'break') => {
    sound.click()
    if (type === 'break') {
      onChange([...sessions, { type, in: '13:00', out: '14:00' }])
      return
    }
    const shiftId = defaultShiftId ?? shifts[0]?.id ?? null
    const sh = shiftId ? shifts.find((s) => s.id === shiftId) : null
    onChange([
      ...sessions,
      { type, in: sh?.startTime ?? '09:00', out: sh?.endTime ?? '18:00', shiftId },
    ])
  }
  const setType = (i: number, type: 'work' | 'break') =>
    update(i, type === 'work' ? { type, shiftId: defaultShiftId ?? shifts[0]?.id ?? null } : { type, shiftId: null })

  const timeCls =
    'h-8 rounded-md border border-border bg-card px-2 text-[13px] outline-none transition-colors focus:border-ring'

  return (
    <div className="mt-2.5 rounded-lg border border-border bg-muted/30 p-3">
      {sessions.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">
          No punches yet — add a work session or a break.
        </p>
      ) : (
        <div className="space-y-1.5">
          {sessions.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-md border border-border bg-card p-0.5">
                <button
                  onClick={() => setType(i, 'work')}
                  className={cn(
                    'flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors',
                    s.type === 'work'
                      ? 'bg-emerald-500 text-white'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Briefcase className="size-3" />
                  Work
                </button>
                <button
                  onClick={() => setType(i, 'break')}
                  className={cn(
                    'flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors',
                    s.type === 'break'
                      ? 'bg-amber-500 text-white'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Coffee className="size-3" />
                  Break
                </button>
              </div>
              <input
                type="time"
                value={s.in}
                onChange={(e) => update(i, { in: e.target.value })}
                className={timeCls}
              />
              <span className="text-muted-foreground">→</span>
              <input
                type="time"
                value={s.out}
                onChange={(e) => update(i, { out: e.target.value })}
                className={timeCls}
              />
              <span className="w-16 text-right text-[12px] tabular-nums text-muted-foreground">
                {fmtDur(span(s.in, s.out))}
              </span>
              {/* per-session shift (work only) — kept last so the time columns
                  stay aligned across work/break rows */}
              {s.type === 'work' && shifts.length > 0 ? (
                <select
                  value={s.shiftId ?? ''}
                  onChange={(e) => update(i, { shiftId: e.target.value || null })}
                  title="Shift for this session"
                  className="ml-auto h-8 cursor-pointer rounded-md border border-border bg-card px-1.5 text-[12px] outline-none transition-colors focus:border-ring"
                >
                  <option value="">No shift</option>
                  {shifts.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                onClick={() => remove(i)}
                aria-label="Remove"
                className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-rose-600"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
        <div className="flex gap-2">
          <button
            onClick={() => add('work')}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-medium transition-colors hover:bg-muted"
          >
            <Plus className="size-3" />
            Work session
          </button>
          <button
            onClick={() => add('break')}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-medium transition-colors hover:bg-muted"
          >
            <Plus className="size-3" />
            Break
          </button>
        </div>
        <div className="flex gap-3 text-[12px]">
          <span className="text-muted-foreground">
            Worked <span className="font-semibold tabular-nums text-foreground">{fmtDur(worked)}</span>
          </span>
          <span className="text-muted-foreground">
            Break <span className="font-semibold tabular-nums text-amber-600">{fmtDur(brk)}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function FlagToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors',
        active
          ? 'border-amber-400 bg-amber-50 text-amber-700'
          : 'border-border bg-card text-muted-foreground hover:bg-muted',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function ReadOnlyStatus({
  status,
  late,
  earlyOut,
  sessions = [],
}: {
  status: Marked
  late?: boolean
  earlyOut?: boolean
  sessions?: PunchSession[]
}) {
  const { worked, brk } = sessionTotals(sessions)
  const tone =
    status === 'present'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'halfday'
        ? 'bg-amber-50 text-amber-700'
        : status === 'leave'
          ? 'bg-blue-50 text-blue-700'
          : status === 'absent'
            ? 'bg-rose-50 text-rose-700'
            : status === 'weekoff' || status === 'holiday'
              ? 'bg-slate-100 text-slate-600'
              : 'bg-muted text-muted-foreground'
  return (
    <span className="flex items-center gap-1.5">
      {sessions.length > 0 && (
        <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:inline">
          {fmtDur(worked)}
          {brk > 0 && <span className="text-amber-600"> · {fmtDur(brk)} brk</span>}
        </span>
      )}
      <span className={cn('inline-flex h-7 items-center rounded-lg px-3 text-[12px] font-medium', tone)}>
        {status ? statusLabel(status) : 'Unmarked'}
      </span>
      {late && <span className="text-[11px] text-amber-600">Late</span>}
      {earlyOut && <span className="text-[11px] text-amber-600">Early</span>}
    </span>
  )
}

function Chip({
  tone,
  label,
  n,
}: {
  tone: 'emerald' | 'amber' | 'blue' | 'rose' | 'gray'
  label: string
  n: number
}) {
  const dot =
    tone === 'emerald'
      ? 'bg-emerald-500'
      : tone === 'amber'
        ? 'bg-amber-500'
        : tone === 'blue'
          ? 'bg-blue-500'
          : tone === 'rose'
            ? 'bg-rose-500'
            : 'bg-slate-400'
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[12px] text-muted-foreground">
      <span className={cn('size-1.5 rounded-full', dot)} />
      {label} <span className="font-semibold tabular-nums text-foreground">{n}</span>
    </span>
  )
}
