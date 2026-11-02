import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  CalendarPlus,
  Repeat,
  Loader2,
  X,
  Plus,
  Trash2,
} from 'lucide-react'
import Panel from '@/components/admin/Panel'
import MetricCard from '@/components/admin/MetricCard'
import { EmployeeAvatar } from '@/lib/people'
import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import {
  getRoster,
  setRosterCells,
  copyRosterWeek,
  createShiftAssignment,
  createRotationPattern,
  deleteRotationPattern,
  assignRotation,
  type RosterGrid,
  type RosterRow,
  type RosterCell,
  type Shift,
  type RotationPatternRow,
} from '@/lib/api'

// ─── date helpers (local) ───
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
// Monday-start week containing `d`
const weekStart = (d: Date) => {
  const x = new Date(d)
  const dow = (x.getDay() + 6) % 7 // Mon=0 … Sun=6
  return addDays(x, -dow)
}
// group roster rows by department, departments sorted A→Z (Unassigned last)
function groupByDepartment(rows: RosterRow[]): [string, RosterRow[]][] {
  const m = new Map<string, RosterRow[]>()
  for (const r of rows) {
    const dept = r.department || 'Unassigned'
    if (!m.has(dept)) m.set(dept, [])
    m.get(dept)!.push(r)
  }
  return [...m.entries()].sort(([a], [b]) => {
    if (a === 'Unassigned') return 1
    if (b === 'Unassigned') return -1
    return a.localeCompare(b)
  })
}

const dowShort = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' })
const dayNum = (d: Date) => d.getDate()
const monthLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

// deterministic color palette per shift (by index)
const PALETTE = [
  'bg-blue-100 text-blue-700 ring-blue-600/20',
  'bg-emerald-100 text-emerald-700 ring-emerald-600/20',
  'bg-violet-100 text-violet-700 ring-violet-600/20',
  'bg-amber-100 text-amber-700 ring-amber-600/20',
  'bg-rose-100 text-rose-700 ring-rose-600/20',
  'bg-cyan-100 text-cyan-700 ring-cyan-600/20',
  'bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-600/20',
  'bg-lime-100 text-lime-700 ring-lime-600/20',
]

export default function Roster() {
  const { firstTabActive } = useShell()
  const { activeWorkspace } = useAuth()
  const canEdit = activeWorkspace?.role === 'Owner' || activeWorkspace?.role === 'Admin'

  const [start, setStart] = useState(() => weekStart(new Date()))
  const [grid, setGrid] = useState<RosterGrid | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [rotOpen, setRotOpen] = useState(false)

  const from = ymd(start)
  const to = ymd(addDays(start, 6))

  const shiftColor = useMemo(() => {
    const m = new Map<string, string>()
    grid?.shifts.forEach((s, i) => m.set(s.id ?? '', PALETTE[i % PALETTE.length] ?? PALETTE[0]))
    return m
  }, [grid?.shifts])
  const shiftById = useMemo(() => {
    const m = new Map<string, Shift>()
    grid?.shifts.forEach((s) => m.set(s.id ?? '', s))
    return m
  }, [grid?.shifts])

  const load = useCallback(() => {
    setLoading(true)
    getRoster(from, to)
      .then(setGrid)
      .finally(() => setLoading(false))
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start])

  // summary metrics over the visible week, computed from the loaded grid
  const metrics = useMemo(() => {
    if (!grid) return null
    let assigned = 0
    let unassigned = 0
    const rostered = new Set<string>()
    const usedShifts = new Set<string>()
    for (const row of grid.rows) {
      let hasShift = false
      for (const cell of row.cells) {
        if (cell.shiftId) {
          assigned++
          usedShifts.add(cell.shiftId)
          hasShift = true
        } else if (!cell.isWeekOff && !cell.isHoliday) {
          unassigned++
        }
      }
      if (hasShift) rostered.add(row.employeeId)
    }
    return { assigned, rostered: rostered.size, unassigned, shifts: usedShifts.size }
  }, [grid])

  const applyCell = async (employeeId: string, date: string, value: string | null | 'clear') => {
    setBusy(true)
    try {
      if (value === 'clear') await setRosterCells([{ employeeId, date, clear: true }])
      else if (value === null) await setRosterCells([{ employeeId, date, off: true }])
      else await setRosterCells([{ employeeId, date, shiftId: value }])
      sound.click()
      load()
    } finally {
      setBusy(false)
    }
  }

  const copyLastWeek = async () => {
    setBusy(true)
    try {
      await copyRosterWeek(ymd(addDays(start, -7)), from, 7)
      sound.success()
      load()
    } finally {
      setBusy(false)
    }
  }

  const isThisWeek = from === ymd(weekStart(new Date()))

  return (
    <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
      {/* summary metrics for the visible week */}
      <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-border p-4 lg:grid-cols-4">
        <MetricCard label="Shifts assigned" value={metrics ? String(metrics.assigned) : '—'} />
        <MetricCard label="Employees rostered" value={metrics ? String(metrics.rostered) : '—'} />
        <MetricCard label="Unassigned slots" value={metrics ? String(metrics.unassigned) : '—'} />
        <MetricCard label="Distinct shifts used" value={metrics ? String(metrics.shifts) : '—'} />
      </div>

      {/* header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-semibold tracking-tight">Roster</h2>
          <span className="text-muted-foreground">·</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setStart((s) => addDays(s, -7))}
              aria-label="Previous week"
              className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-[150px] text-center text-[13px] font-medium tabular-nums">
              {dayNum(start)}–{dayNum(addDays(start, 6))} {monthLabel(start)}
            </span>
            <button
              onClick={() => setStart((s) => addDays(s, 7))}
              aria-label="Next week"
              className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
            {!isThisWeek && (
              <button
                onClick={() => setStart(weekStart(new Date()))}
                className="ml-1 cursor-pointer rounded-md px-2 py-1 text-[13px] font-medium text-[#2f63d8] transition-colors hover:bg-[#2f63d8]/10"
              >
                This week
              </button>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            <ToolbarBtn icon={Copy} label="Copy last week" onClick={copyLastWeek} />
            <ToolbarBtn icon={CalendarPlus} label="Assign shift" onClick={() => setAssignOpen(true)} />
            <ToolbarBtn icon={Repeat} label="Rotations" onClick={() => setRotOpen(true)} />
          </div>
        )}
      </div>

      {/* legend */}
      {grid && grid.shifts.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-5 py-2 text-[12px]">
          <span className="text-muted-foreground">Shifts:</span>
          {grid.shifts.map((s) => (
            <span
              key={s.id}
              className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 ring-1 ring-inset', shiftColor.get(s.id ?? ""))}
            >
              {s.name}
              <span className="opacity-60">
                {s.startTime}–{s.endTime}
              </span>
            </span>
          ))}
          <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground">
            <span className="inline-block size-2.5 rounded-sm bg-muted ring-1 ring-inset ring-border" /> Off
          </span>
        </div>
      )}

      {/* grid */}
      {loading || !grid ? (
        <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">
          {loading ? 'Loading roster…' : 'No data'}
        </div>
      ) : grid.rows.length === 0 ? (
        <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">
          No employees yet.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="min-w-[760px]">
            {/* header row */}
            <div className="sticky top-0 z-10 grid grid-cols-[200px_repeat(7,1fr)] border-b border-border bg-background">
              <div className="px-4 py-2 text-[12px] font-medium text-muted-foreground">Employee</div>
              {days.map((d) => {
                const isToday = ymd(d) === ymd(new Date())
                return (
                  <div
                    key={ymd(d)}
                    className={cn('border-l border-border px-2 py-2 text-center', isToday && 'bg-[#2f63d8]/5')}
                  >
                    <div className="text-[11px] uppercase text-muted-foreground">{dowShort(d)}</div>
                    <div className={cn('text-[13px] font-semibold tabular-nums', isToday && 'text-[#2f63d8]')}>
                      {dayNum(d)}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* employee rows — clubbed by department */}
            {groupByDepartment(grid.rows).map(([dept, rows]) => (
              <div key={dept}>
                <div className="sticky top-[42px] z-[5] flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                  {dept}
                  <span className="rounded-full bg-background px-1.5 text-[10px] font-medium text-muted-foreground">{rows.length}</span>
                </div>
                {rows.map((row) => (
                  <RosterRowView
                    key={row.employeeId}
                    row={row}
                    canEdit={canEdit}
                    shifts={grid.shifts}
                    shiftColor={shiftColor}
                    shiftById={shiftById}
                    onSet={applyCell}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {assignOpen && grid && (
        <AssignShiftModal
          rows={grid.rows}
          shifts={grid.shifts}
          defaultStart={from}
          onClose={() => setAssignOpen(false)}
          onDone={() => {
            setAssignOpen(false)
            load()
          }}
        />
      )}
      {rotOpen && grid && (
        <RotationsModal
          rows={grid.rows}
          shifts={grid.shifts}
          patterns={grid.patterns}
          defaultStart={from}
          onClose={() => setRotOpen(false)}
          onChanged={load}
        />
      )}
    </Panel>
  )
}

function RosterRowView({
  row,
  canEdit,
  shifts,
  shiftColor,
  shiftById,
  onSet,
}: {
  row: RosterRow
  canEdit: boolean
  shifts: Shift[]
  shiftColor: Map<string, string>
  shiftById: Map<string, Shift>
  onSet: (employeeId: string, date: string, value: string | null | 'clear') => void
}) {
  const [openDate, setOpenDate] = useState<string | null>(null)
  return (
    <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-border last:border-0 hover:bg-muted/20">
      <div className="flex min-w-0 items-center gap-2 px-4 py-2">
        <EmployeeAvatar
          name={row.name}
          sex={row.gender === 'man' ? 'man' : row.gender === 'woman' ? 'woman' : undefined}
          className="size-7"
        />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">{row.name}</div>
          {(row.role || row.department) && (
            <div className="truncate text-[11px] text-muted-foreground">{row.role || row.department}</div>
          )}
        </div>
      </div>
      {row.cells.map((cell) => (
        <CellView
          key={cell.date}
          cell={cell}
          canEdit={canEdit}
          shifts={shifts}
          shiftColor={shiftColor}
          shiftById={shiftById}
          open={openDate === cell.date}
          onOpen={() => setOpenDate((d) => (d === cell.date ? null : cell.date))}
          onClose={() => setOpenDate(null)}
          onSet={(value) => {
            onSet(row.employeeId, cell.date, value)
            setOpenDate(null)
          }}
        />
      ))}
    </div>
  )
}

function CellView({
  cell,
  canEdit,
  shifts,
  shiftColor,
  shiftById,
  open,
  onOpen,
  onClose,
  onSet,
}: {
  cell: RosterCell
  canEdit: boolean
  shifts: Shift[]
  shiftColor: Map<string, string>
  shiftById: Map<string, Shift>
  open: boolean
  onOpen: () => void
  onClose: () => void
  onSet: (value: string | null | 'clear') => void
}) {
  const shift = cell.shiftId ? shiftById.get(cell.shiftId) : null
  const isManual = cell.source === 'roster'
  const isOff = cell.isWeekOff || (!cell.shiftId && cell.source === 'roster')

  let chip
  if (shift) {
    chip = (
      <span
        className={cn(
          'inline-flex max-w-full items-center gap-1 truncate rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset',
          shiftColor.get(shift.id ?? ""),
          isManual && 'ring-2',
        )}
        title={`${shift.name} ${shift.startTime}–${shift.endTime} (${cell.source})`}
      >
        {shift.name}
      </span>
    )
  } else if (isOff) {
    chip = (
      <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
        Off
      </span>
    )
  } else {
    chip = <span className="text-[13px] text-muted-foreground/40">—</span>
  }

  return (
    <div className="relative border-l border-border p-1.5">
      <button
        onClick={canEdit ? onOpen : undefined}
        className={cn(
          'flex h-9 w-full items-center justify-center rounded-md transition-colors',
          canEdit && 'cursor-pointer hover:bg-muted',
        )}
      >
        {chip}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div className="absolute left-1 top-full z-50 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-background py-1 shadow-lg">
            <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Set shift
            </div>
            {shifts.map((s) => (
              <button
                key={s.id}
                onClick={() => onSet(s.id ?? "")}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-muted"
              >
                <span className={cn('size-2.5 rounded-sm ring-1 ring-inset', shiftColor.get(s.id ?? ""))} />
                {s.name}
              </button>
            ))}
            <button
              onClick={() => onSet(null)}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-muted"
            >
              <span className="size-2.5 rounded-sm bg-muted ring-1 ring-inset ring-border" />
              Week off
            </button>
            {cell.source === 'roster' && (
              <button
                onClick={() => onSet('clear')}
                className="mt-1 flex w-full cursor-pointer items-center gap-2 border-t border-border px-3 py-1.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted"
              >
                Clear (use rule)
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ToolbarBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-muted"
    >
      <Icon className="size-3.5 text-muted-foreground" />
      {label}
    </button>
  )
}

// ─── Assign shift (effective-dated) ───
function AssignShiftModal({
  rows,
  shifts,
  defaultStart,
  onClose,
  onDone,
}: {
  rows: RosterRow[]
  shifts: Shift[]
  defaultStart: string
  onClose: () => void
  onDone: () => void
}) {
  const [shiftId, setShiftId] = useState(shifts[0]?.id ?? '')
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const submit = async () => {
    if (!shiftId || !selected.size) {
      setError('Pick a shift and at least one employee')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createShiftAssignment({
        employeeIds: [...selected],
        shiftId,
        startDate,
        endDate: endDate || null,
      })
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Assign a fixed shift" onClose={onClose}>
      <p className="text-[13px] text-muted-foreground">
        Assign a shift to employees for a date range. Applies until a manual roster cell or another
        assignment overrides it.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Shift">
          <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className={selectCls}>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.startTime}–{s.endTime})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start date">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={selectCls} />
        </Field>
        <Field label="End date (optional)">
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={selectCls} />
        </Field>
      </div>
      <EmployeePicker rows={rows} selected={selected} onToggle={toggle} onAll={(ids) => setSelected(new Set(ids))} />
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onCancel={onClose} onSubmit={submit} submitLabel="Assign" />
    </ModalShell>
  )
}

// ─── Rotation patterns ───
function RotationsModal({
  rows,
  shifts,
  patterns,
  defaultStart,
  onClose,
  onChanged,
}: {
  rows: RosterRow[]
  shifts: Shift[]
  patterns: RotationPatternRow[]
  defaultStart: string
  onClose: () => void
  onChanged: () => void
}) {
  const [tab, setTab] = useState<'assign' | 'create'>(patterns.length ? 'assign' : 'create')

  return (
    <ModalShell title="Shift rotations" onClose={onClose} wide>
      <div className="flex gap-1 rounded-lg border border-border bg-card p-0.5 text-[13px]">
        {(['assign', 'create'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 cursor-pointer rounded-md px-3 py-1.5 font-medium capitalize transition-colors',
              tab === t ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'assign' ? 'Assign rotation' : 'Create pattern'}
          </button>
        ))}
      </div>
      {tab === 'create' ? (
        <CreatePattern shifts={shifts} defaultStart={defaultStart} onCreated={onChanged} />
      ) : (
        <AssignRotation
          rows={rows}
          patterns={patterns}
          defaultStart={defaultStart}
          onChanged={onChanged}
          onClose={onClose}
        />
      )}
    </ModalShell>
  )
}

function CreatePattern({
  shifts,
  defaultStart,
  onCreated,
}: {
  shifts: Shift[]
  defaultStart: string
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [anchorDate, setAnchorDate] = useState(defaultStart)
  const [slots, setSlots] = useState<(string | null)[]>([shifts[0]?.id ?? null, null])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const setSlot = (i: number, v: string | null) => setSlots((s) => s.map((x, idx) => (idx === i ? v : x)))

  const submit = async () => {
    if (!name.trim()) {
      setError('Name the pattern')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createRotationPattern({ name: name.trim(), cycleLength: slots.length, anchorDate, slots })
      sound.success()
      setName('')
      setSlots([shifts[0]?.id ?? null, null])
      onCreated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        Define a repeating cycle. Each day in the cycle is a shift or a rest day. The anchor date is
        day 1 of the cycle.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pattern name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Day / Night 2-2"
            className={selectCls}
          />
        </Field>
        <Field label="Anchor (cycle day 1)">
          <input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} className={selectCls} />
        </Field>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[13px] font-medium text-muted-foreground">
            Cycle ({slots.length} day{slots.length > 1 ? 's' : ''})
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setSlots((s) => [...s, null])}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border bg-card px-2 text-[12px] font-medium hover:bg-muted"
            >
              <Plus className="size-3" /> Day
            </button>
            <button
              onClick={() => setSlots((s) => (s.length > 1 ? s.slice(0, -1) : s))}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border bg-card px-2 text-[12px] font-medium hover:bg-muted disabled:opacity-50"
              disabled={slots.length <= 1}
            >
              <Trash2 className="size-3" /> Day
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {slots.map((slot, i) => (
            <div key={i} className="rounded-lg border border-border p-2">
              <div className="mb-1 text-[11px] font-medium text-muted-foreground">Day {i + 1}</div>
              <select
                value={slot ?? ''}
                onChange={(e) => setSlot(i, e.target.value || null)}
                className="h-8 w-full cursor-pointer rounded-md border border-border bg-card px-1.5 text-[12px] outline-none focus:border-ring"
              >
                <option value="">Off</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={busy}
          className="btn-3d inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          Create pattern
        </button>
      </div>
    </div>
  )
}

function AssignRotation({
  rows,
  patterns,
  defaultStart,
  onChanged,
  onClose,
}: {
  rows: RosterRow[]
  patterns: RotationPatternRow[]
  defaultStart: string
  onChanged: () => void
  onClose: () => void
}) {
  const [patternId, setPatternId] = useState(patterns[0]?.id ?? '')
  const [startDate, setStartDate] = useState(defaultStart)
  const [crewOffset, setCrewOffset] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const delPattern = async (id: string) => {
    setBusy(true)
    try {
      await deleteRotationPattern(id)
      if (patternId === id) setPatternId('')
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!patternId || !selected.size) {
      setError('Pick a pattern and at least one employee')
      return
    }
    setBusy(true)
    setError('')
    try {
      await assignRotation({ employeeIds: [...selected], patternId, startDate, crewOffset })
      sound.success()
      onChanged()
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  if (!patterns.length) {
    return (
      <p className="py-6 text-center text-[13px] text-muted-foreground">
        No rotation patterns yet. Create one first.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Pattern">
          <select value={patternId} onChange={(e) => setPatternId(e.target.value)} className={selectCls}>
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.cycleLength}d)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start date">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={selectCls} />
        </Field>
        <Field label="Crew offset">
          <input
            type="number"
            min={0}
            value={crewOffset}
            onChange={(e) => setCrewOffset(Math.max(0, Number(e.target.value) || 0))}
            className={selectCls}
          />
        </Field>
      </div>
      <p className="text-[12px] text-muted-foreground">
        Crew offset shifts a team's starting position in the cycle (e.g. crew B starts where crew A
        is on day 2).
      </p>
      <EmployeePicker rows={rows} selected={selected} onToggle={toggle} onAll={(ids) => setSelected(new Set(ids))} />
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onCancel={onClose} onSubmit={submit} submitLabel="Assign rotation" />

      <div className="border-t border-border pt-2">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Existing patterns
        </div>
        {patterns.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-1 text-[13px]">
            <span>
              {p.name} <span className="text-muted-foreground">· {p.cycleLength}-day cycle</span>
            </span>
            <button
              onClick={() => delPattern(p.id)}
              className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-rose-600"
              aria-label="Delete pattern"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── shared modal bits ───
const selectCls =
  'h-9 w-full rounded-lg border border-border bg-card px-2.5 text-[13px] outline-none transition-colors focus:border-ring'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function EmployeePicker({
  rows,
  selected,
  onToggle,
  onAll,
}: {
  rows: RosterRow[]
  selected: Set<string>
  onToggle: (id: string) => void
  onAll: (ids: string[]) => void
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted-foreground">
          Employees ({selected.size} selected)
        </span>
        <div className="flex gap-2 text-[12px]">
          <button onClick={() => onAll(rows.map((r) => r.employeeId))} className="cursor-pointer text-[#2f63d8] hover:underline">
            All
          </button>
          <button onClick={() => onAll([])} className="cursor-pointer text-muted-foreground hover:underline">
            None
          </button>
        </div>
      </div>
      <div className="max-h-44 overflow-y-auto rounded-lg border border-border">
        {rows.map((r) => (
          <label
            key={r.employeeId}
            className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-1.5 last:border-0 hover:bg-muted"
          >
            <input
              type="checkbox"
              checked={selected.has(r.employeeId)}
              onChange={() => onToggle(r.employeeId)}
              className="size-3.5 cursor-pointer accent-[#2f63d8]"
            />
            <span className="text-[13px]">{r.name}</span>
            {(r.role || r.department) && (
              <span className="text-[11px] text-muted-foreground">· {r.role || r.department}</span>
            )}
          </label>
        ))}
      </div>
    </div>
  )
}

function ModalShell({
  title,
  onClose,
  wide,
  children,
}: {
  title: string
  onClose: () => void
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          'relative max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl duration-200 animate-in fade-in zoom-in-95',
          wide ? 'max-w-2xl' : 'max-w-lg',
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">{children}</div>
      </div>
    </div>
  )
}

function ModalActions({
  busy,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  busy: boolean
  onCancel: () => void
  onSubmit: () => void
  submitLabel: string
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        onClick={onCancel}
        className="h-9 cursor-pointer rounded-lg border border-border bg-card px-4 text-[13px] font-medium transition-colors hover:bg-muted"
      >
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={busy}
        className="btn-3d inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy && <Loader2 className="size-3.5 animate-spin" />}
        {submitLabel}
      </button>
    </div>
  )
}
