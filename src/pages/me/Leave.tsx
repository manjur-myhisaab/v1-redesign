import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, X, Loader2, CalendarDays, Ban } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import { sound } from '@/lib/sound'
import {
  getMyLeaveBalances,
  getMyLeaveRequests,
  applyMyLeave,
  cancelMyLeave,
  getLeaveTypes,
  type MyLeaveBalance,
  type MyLeaveRequest,
  type LeaveType,
} from '@/lib/api'
import { Loading, EmptyState, PrimaryButton, GhostButton, Field, inputCls, StatusPill, fmtDate } from './ui'

export default function Leave() {
  const [balances, setBalances] = useState<MyLeaveBalance[]>([])
  const [requests, setRequests] = useState<MyLeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [applyOpen, setApplyOpen] = useState(false)
  const [busy, setBusy] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getMyLeaveBalances().catch(() => []), getMyLeaveRequests().catch(() => [])])
      .then(([b, r]) => {
        setBalances(b)
        setRequests(r)
      })
      .finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  const cancel = async (id: string) => {
    setBusy(id)
    try {
      await cancelMyLeave(id)
      sound.success()
      load()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  return (
    <Panel className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h1 className="font-display text-base font-semibold tracking-tight">Leave</h1>
          <p className="text-[12px] text-muted-foreground">Your balances and requests</p>
        </div>
        <PrimaryButton onClick={() => setApplyOpen(true)}>
          <Plus className="size-4" /> Apply leave
        </PrimaryButton>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-6 p-5">
          {/* balances */}
          <div>
            <h2 className="mb-2 text-[13px] font-semibold">Balances</h2>
            {balances.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No leave balances allocated.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {balances.map((b) => (
                  <div key={b.leaveTypeId} className="rounded-xl border border-border bg-card p-4">
                    <div className="text-[13px] font-medium">{b.type}</div>
                    <div className="mt-2 text-2xl font-semibold tabular-nums">{b.available}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {b.used} used of {b.allocated}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* requests */}
          <div>
            <h2 className="mb-2 text-[13px] font-semibold">My requests</h2>
            {requests.length === 0 ? (
              <EmptyState icon={<CalendarDays className="size-6 opacity-40" />}>No leave requests yet.</EmptyState>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {requests.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">{r.typeName || r.type}</span>
                        <StatusPill status={r.status} />
                      </div>
                      <div className="text-[12px] text-muted-foreground">
                        {fmtDate(r.fromDate)}
                        {r.toDate !== r.fromDate && ` – ${fmtDate(r.toDate)}`} · {r.days} day{r.days !== 1 && 's'}
                        {r.reason && ` · ${r.reason}`}
                      </div>
                    </div>
                    {r.status === 'pending' && (
                      <GhostButton onClick={() => cancel(r.id)} disabled={busy === r.id} className="h-8 px-3 text-[12px]">
                        {busy === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />} Cancel
                      </GhostButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {applyOpen && (
        <ApplyLeaveModal
          onClose={() => setApplyOpen(false)}
          onDone={() => {
            setApplyOpen(false)
            load()
          }}
        />
      )}
    </Panel>
  )
}

function ApplyLeaveModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [types, setTypes] = useState<LeaveType[]>([])
  const [leaveTypeId, setLeaveTypeId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [halfDay, setHalfDay] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const idemKey = useRef(crypto.randomUUID())

  useEffect(() => {
    getLeaveTypes()
      .then((t) => {
        const active = t.filter((x) => x.active)
        setTypes(active)
        if (active[0]) setLeaveTypeId(active[0].id)
      })
      .catch(() => {})
  }, [])

  const submit = async () => {
    if (!leaveTypeId || !fromDate) {
      setError('Pick a leave type and start date')
      return
    }
    setBusy(true)
    setError('')
    try {
      await applyMyLeave({ leaveTypeId, fromDate, toDate: toDate || fromDate, halfDay, reason }, idemKey.current)
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const single = !toDate || toDate === fromDate

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl duration-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">Apply leave</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <Field label="Leave type">
            <select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} className={inputCls}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From"><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} /></Field>
            <Field label="To"><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} /></Field>
          </div>
          {single && (
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input type="checkbox" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} className="size-3.5 cursor-pointer accent-[#2f63d8]" />
              Half day
            </label>
          )}
          <Field label="Reason (optional)">
            <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
          </Field>
          {error && <p className="text-[13px] text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <GhostButton onClick={onClose}>Cancel</GhostButton>
            <PrimaryButton onClick={submit} disabled={busy}>
              {busy && <Loader2 className="size-3.5 animate-spin" />} Submit
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}
