import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Loader2,
  X,
  Plus,
  ChevronRight,
  Lock,
  CheckCircle2,
  FileText,
  Trash2,
  IndianRupee,
  Download,
  Share2,
} from 'lucide-react'
import Panel from '@/components/admin/Panel'
import StatusBadge from '@/components/admin/StatusBadge'
import DetailPanel, { Field as PanelField } from '@/components/admin/DetailPanel'
import DataGrid, { type GridColumn, type BadgeTone } from '@/components/admin/DataGrid'
import GridToolbar from '@/components/admin/GridToolbar'
import { useListView } from '@/lib/useListView'
import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import {
  getPayrollPreview,
  finalizePayroll,
  getPayrollRuns,
  getPayrollRun,
  getPayslip,
  getPayslipPdfBlob,
  addAdjustment,
  listAdvances,
  createAdvance,
  closeAdvance,
  deleteAdvance,
  listEmployees,
  type PayrollPreview,
  type PaySlipResult,
  type PayLine,
  type PayrollRunRow,
  type PayslipDetail,
  type LoanRow,
} from '@/lib/api'
import { type Employee } from '@/lib/employees'

const rupee = (p: number) => '₹' + Math.round(p / 100).toLocaleString('en-IN')
const rupee2 = (p: number) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const thisMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const monthLabel = (period: string) => {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

type Tab = 'run' | 'advances' | 'history'

type SlipView = { slip: PaySlipResult; finalized: boolean; period: string }

export default function Payroll() {
  const { firstTabActive } = useShell()
  const { activeWorkspace } = useAuth()
  const canRun = activeWorkspace?.role === 'Owner' || activeWorkspace?.role === 'Admin'
  const [tab, setTab] = useState<Tab>('run')

  // Pay-run detail state lifted here so the payslip panel sits inline beside
  // the tabbed panel (matching the Employees right-side panel layout).
  const [slipView, setSlipView] = useState<SlipView | null>(null)
  const [slipOpen, setSlipOpen] = useState(false)
  const [adjFor, setAdjFor] = useState<{ slip: PaySlipResult; period: string } | null>(null)
  const reloadRunRef = useRef<() => void>(() => {})

  const openSlip = (payload: SlipView) => {
    setSlipView(payload)
    setSlipOpen(true)
  }

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
        <div className="flex shrink-0 items-center gap-5 border-b border-border px-5">
          {([
            ['run', 'Pay run'],
            ['advances', 'Advances & loans'],
            ['history', 'History'],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'relative -mb-px cursor-pointer py-3 text-[13px] font-medium transition-colors',
                tab === t
                  ? 'text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'run' && <PayRun canRun={canRun} onOpenSlip={openSlip} reloadRef={reloadRunRef} />}
        {tab === 'advances' && <Advances canRun={canRun} />}
        {tab === 'history' && <History />}
      </Panel>

      <DetailPanel
        open={slipOpen}
        onClose={() => {
          setSlipOpen(false)
          setSlipView(null)
        }}
        width="w-80"
        title={slipView?.slip.empName ?? ''}
        subtitle={slipView?.slip.designation || undefined}
        avatar={{ name: slipView?.slip.empName ?? '' }}
        footer={
          slipView && canRun && !slipView.finalized ? (
            <button
              type="button"
              onClick={() => {
                setAdjFor({ slip: slipView.slip, period: slipView.period })
                setSlipOpen(false)
              }}
              className="inline-flex h-7 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-card text-[13px] font-medium transition-colors hover:bg-muted"
            >
              <Plus className="size-3.5" /> Add adjustment
            </button>
          ) : undefined
        }
      >
        {slipView && (
          <>
            <PanelField label="Paid days">
              {`${slipView.slip.paidDays}/${slipView.slip.totalDays}${slipView.slip.lopDays > 0 ? ` · LOP ${slipView.slip.lopDays}` : ''}`}
            </PanelField>
            <PanelField label="Gross">{rupee(slipView.slip.gross)}</PanelField>
            <PanelField label="Deductions">{rupee(slipView.slip.deductions)}</PanelField>
            <PanelField label="Net pay">{rupee(slipView.slip.net)}</PanelField>
            <PanelField label="Status">
              <StatusBadge tone={slipView.finalized ? 'green' : 'amber'}>
                {slipView.finalized ? 'Paid' : 'Pending'}
              </StatusBadge>
            </PanelField>
            <div className="mt-1 border-t border-border pt-3">
              <PayslipBreakup
                lines={slipView.slip.lines}
                net={slipView.slip.net}
                employerContrib={slipView.slip.employerContrib}
              />
            </div>
          </>
        )}
      </DetailPanel>

      {adjFor && (
        <AdjustmentModal
          slip={adjFor.slip}
          period={adjFor.period}
          onClose={() => setAdjFor(null)}
          onDone={() => {
            setAdjFor(null)
            reloadRunRef.current()
          }}
        />
      )}
    </div>
  )
}

// ─── Pay run ───────────────────────────────────────────────────
function PayRun({
  canRun,
  onOpenSlip,
  reloadRef,
}: {
  canRun: boolean
  onOpenSlip: (payload: SlipView) => void
  reloadRef: React.MutableRefObject<() => void>
}) {
  const [period, setPeriod] = useState(thisMonth())
  const [data, setData] = useState<PayrollPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [gridKey, setGridKey] = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    getPayrollPreview(period)
      .then(setData)
      .finally(() => setLoading(false))
  }, [period])

  // expose the latest reload to the parent so the adjustment modal (rendered
  // beside the tabbed panel) can refresh this tab after saving.
  useEffect(() => {
    reloadRef.current = load
  }, [load, reloadRef])

  useEffect(() => {
    setSelectedIds([])
    setGridKey((k) => k + 1)
    load()
  }, [load])

  const finalizedSet = new Set(data?.finalizedIds ?? [])
  const slips = data?.slips ?? []
  const pending = slips.filter((s) => !finalizedSet.has(s.employeeId))

  const lv = useListView<PaySlipResult>({
    rows: slips,
    search: (s) => s.empName,
    filters: [
      {
        id: 'status',
        label: 'Status',
        options: [
          { value: 'pending', label: 'Pending' },
          { value: 'finalized', label: 'Finalized' },
        ],
        get: (s) => (finalizedSet.has(s.employeeId) ? 'finalized' : 'pending'),
      },
    ],
    sorts: [
      { key: 'employee', label: 'Employee', get: (s) => s.empName },
      { key: 'gross', label: 'Gross', get: (s) => s.gross },
      { key: 'net', label: 'Net pay', get: (s) => s.net },
    ],
  })

  const columns: GridColumn<PaySlipResult>[] = [
    { id: 'employee', title: 'Employee', kind: 'person', width: 200, get: (s) => s.empName },
    { id: 'paidDays', title: 'Paid days', kind: 'number', width: 100, get: (s) => s.paidDays },
    { id: 'gross', title: 'Gross', kind: 'money', width: 120, get: (s) => s.gross },
    { id: 'deductions', title: 'Deductions', kind: 'money', width: 120, get: (s) => s.deductions },
    { id: 'net', title: 'Net pay', kind: 'money', width: 130, get: (s) => s.net },
    {
      id: 'status',
      title: 'Status',
      kind: 'badge',
      width: 120,
      get: (s) => (finalizedSet.has(s.employeeId) ? 'Paid' : 'Pending'),
      badgeTone: (s) => (finalizedSet.has(s.employeeId) ? 'green' : 'amber') as BadgeTone,
    },
  ]

  const clearSelection = () => {
    setSelectedIds([])
    setGridKey((k) => k + 1)
  }

  // Keep a ref so the view-change effect below can read the latest selectedIds
  // without becoming a dep of the effect (which would create an infinite loop).
  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds

  // Clear stale row-index selections whenever the visible row order changes.
  // DataGrid holds selection as indices internally; if lv.view reorders due to
  // a filter or sort change without a key-bump the same indices now point at
  // different employees — the wrong employees would be finalized.
  useEffect(() => {
    if (selectedIdsRef.current.length > 0) {
      setSelectedIds([])
      setGridKey((k) => k + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lv.view])

  const finalize = async (ids?: string[]) => {
    if (!data || busy) return
    const targets = ids ?? pending.map((s) => s.employeeId)
    if (!targets.length) return
    const who = ids ? `${ids.length} selected employee(s)` : 'all remaining employees'
    if (!confirm(`Finalize payroll for ${who} (${monthLabel(period)})? Their payslips are locked and advances recovered.`)) return
    setBusy(true)
    try {
      await finalizePayroll(period, targets)
      sound.success()
      clearSelection()
      load()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const selectedPending = selectedIds.filter((id) => !finalizedSet.has(id))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={period}
            onChange={(e) => e.target.value && setPeriod(e.target.value)}
            className="h-9 cursor-pointer rounded-lg border border-border bg-card px-2.5 text-[13px] outline-none focus:border-ring"
          />
          {data?.locked ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[12px] font-medium text-emerald-700">
              <Lock className="size-3" /> Finalized
            </span>
          ) : data && finalizedSet.size > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[12px] font-medium text-amber-700">
              {finalizedSet.size} of {data.totals.count} done
            </span>
          ) : null}
        </div>
        {canRun && data && pending.length > 0 && (
          <button
            onClick={() => finalize()}
            disabled={busy}
            className="btn-3d inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Finalize all ({pending.length})
          </button>
        )}
      </div>

      {/* totals */}
      {data && (
        <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-4">
          <Stat label="Employees" value={String(data.totals.count)} />
          <Stat label="Gross" value={rupee(data.totals.gross)} />
          <Stat label="Deductions" value={rupee(data.totals.deductions)} />
          <Stat label="Net payable" value={rupee(data.totals.net)} accent />
        </div>
      )}

      {/* toolbar (swaps to bulk bar on selection) + grid */}
      <GridToolbar
        total={slips.length}
        {...lv.toolbar}
        searchPlaceholder="Search employee…"
        selectedCount={canRun ? selectedIds.length : 0}
        onClearSelection={clearSelection}
        bulkActions={
          canRun
            ? [
                {
                  id: 'finalize',
                  label: `Finalize selected (${selectedPending.length})`,
                  icon: CheckCircle2,
                  disabled: busy || selectedPending.length === 0,
                  onClick: () => finalize(selectedPending),
                },
              ]
            : undefined
        }
      />
      <div className="min-h-0 flex-1 border-t border-border">
        {loading ? (
          <div className="grid h-full place-items-center text-[13px] text-muted-foreground">Computing payroll…</div>
        ) : (
          <DataGrid
            key={gridKey}
            rows={lv.view}
            columns={columns}
            getRowId={(s) => s.employeeId}
            onRowClick={(s) =>
              onOpenSlip({ slip: s, finalized: finalizedSet.has(s.employeeId), period })
            }
            onSelectionChange={canRun ? setSelectedIds : undefined}
            emptyMessage="No employees to pay."
          />
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-background px-5 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('mt-0.5 text-lg font-semibold tabular-nums', accent && 'text-[#2f63d8]')}>{value}</div>
    </div>
  )
}

function PayslipBreakup({ lines = [], net, employerContrib }: { lines?: PayLine[]; net: number; employerContrib: number }) {
  const earnings = lines.filter((l) => l.type === 'earning')
  const reimbursements = lines.filter((l) => l.type === 'reimbursement')
  const deductions = lines.filter((l) => l.type === 'deduction')
  const employer = lines.filter((l) => l.type === 'employer_contribution')
  const grossEarn =
    earnings.reduce((s, l) => s + l.amount, 0) +
    reimbursements.reduce((s, l) => s + l.amount, 0)
  const totalDed = deductions.reduce((s, l) => s + l.amount, 0)

  // single column so long reimbursement labels have room and never collide
  return (
    <div className="space-y-3">
      <Section title="Earnings" total={grossEarn}>
        {earnings.map((l, i) => (
          <Line key={i} name={l.name} amount={l.amount} />
        ))}
        {reimbursements.map((l, i) => (
          <Line key={`r${i}`} name={l.name} amount={l.amount} tag="Reimbursement" />
        ))}
      </Section>

      <Section title="Deductions" total={totalDed} minus>
        {deductions.length === 0 ? (
          <div className="py-0.5 text-[12px] text-muted-foreground">None</div>
        ) : (
          deductions.map((l, i) => (
            <Line key={i} name={l.name} amount={l.amount} minus />
          ))
        )}
      </Section>

      <div className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2 text-[14px] font-semibold">
        <span>Net pay</span>
        <span className="tabular-nums text-primary">{rupee2(net)}</span>
      </div>
      {employer.length > 0 && (
        <div className="text-[11px] text-muted-foreground">
          + Employer contribution (CTC): {rupee(employerContrib)}
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  total,
  minus,
  children,
}: {
  title: string
  total: number
  minus?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        <span className={cn('text-[12px] font-semibold tabular-nums', minus && 'text-rose-600')}>
          {minus ? '−' : ''}
          {rupee2(total)}
        </span>
      </div>
      <div className="divide-y divide-border/60 px-3 py-1">{children}</div>
    </div>
  )
}

function Line({ name, amount, minus, tag }: { name: string; amount: number; minus?: boolean; tag?: string }) {
  // split a "Primary — detail (date)" label into a primary line + muted sub-line
  const dash = name.indexOf(' — ')
  const primary = dash >= 0 ? name.slice(0, dash) : name
  const detail = dash >= 0 ? name.slice(dash + 3) : ''
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-[13px]">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {tag && (
            <span className="shrink-0 rounded bg-violet-50 px-1 text-[10px] font-medium text-violet-700 ring-1 ring-inset ring-violet-600/15">
              {tag}
            </span>
          )}
          <span className="min-w-0 break-words text-foreground/90">{primary}</span>
        </span>
        {detail && (
          <span className="mt-0.5 block break-words text-[11px] text-muted-foreground">
            {detail}
          </span>
        )}
      </span>
      <span className={cn('shrink-0 tabular-nums', minus && 'text-rose-600')}>
        {minus ? '−' : ''}
        {rupee2(amount)}
      </span>
    </div>
  )
}

function AdjustmentModal({
  slip,
  period,
  onClose,
  onDone,
}: {
  slip: PaySlipResult
  period: string
  onClose: () => void
  onDone: () => void
}) {
  const [type, setType] = useState<'earning' | 'deduction'>('earning')
  const [label, setLabel] = useState('')
  const [rupees, setRupees] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    const amount = Math.round(Number(rupees) * 100)
    if (!label.trim() || !amount) {
      setError('Enter a label and amount')
      return
    }
    setBusy(true)
    setError('')
    try {
      await addAdjustment({ employeeId: slip.employeeId, period, type, label: label.trim(), amount })
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title={`Adjustment · ${slip.empName}`} onClose={onClose}>
      <p className="text-[13px] text-muted-foreground">
        Add a one-off earning or deduction for {monthLabel(period)}. It appears on this month's payslip.
      </p>
      <div className="flex gap-1 rounded-lg border border-border bg-card p-0.5 text-[13px]">
        {(['earning', 'deduction'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              'flex-1 cursor-pointer rounded-md px-3 py-1.5 font-medium capitalize transition-colors',
              type === t ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <Field label="Label">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={type === 'earning' ? 'e.g. Diwali bonus' : 'e.g. Damage recovery'}
          className={inputCls}
        />
      </Field>
      <Field label="Amount (₹)">
        <input value={rupees} onChange={(e) => setRupees(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={inputCls} />
      </Field>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onCancel={onClose} onSubmit={submit} submitLabel="Add adjustment" />
    </ModalShell>
  )
}

// ─── Advances & loans ──────────────────────────────────────────
function Advances({ canRun }: { canRun: boolean }) {
  const [loans, setLoans] = useState<LoanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    listAdvances()
      .then(setLoans)
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const close = async (id: string) => {
    if (!confirm('Close this advance/loan? Remaining installments are waived.')) return
    await closeAdvance(id)
    sound.click()
    load()
  }
  const del = async (id: string) => {
    try {
      await deleteAdvance(id)
      load()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="text-[13px] text-muted-foreground">Company advances & loans — auto-recovered from payroll each month.</p>
        {canRun && (
          <button
            onClick={() => setAddOpen(true)}
            className="btn-3d inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" /> New advance / loan
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">Loading…</div>
      ) : loans.length === 0 ? (
        <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">No advances or loans yet.</div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-background text-[12px] text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-5 py-2 text-left font-medium">Employee</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Principal</th>
                <th className="px-3 py-2 text-left font-medium">Interest</th>
                <th className="px-3 py-2 text-right font-medium">Installment</th>
                <th className="px-3 py-2 text-right font-medium">Outstanding</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => (
                <LoanRowView
                  key={l.id}
                  loan={l}
                  open={expanded === l.id}
                  onToggle={() => setExpanded((e) => (e === l.id ? null : l.id))}
                  canRun={canRun}
                  onClose={() => close(l.id)}
                  onDelete={() => del(l.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <AddAdvanceModal
          onClose={() => setAddOpen(false)}
          onDone={() => {
            setAddOpen(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function LoanRowView({
  loan,
  open,
  onToggle,
  canRun,
  onClose,
  onDelete,
}: {
  loan: LoanRow
  open: boolean
  onToggle: () => void
  canRun: boolean
  onClose: () => void
  onDelete: () => void
}) {
  const interest =
    loan.interestType === 'none' ? 'Interest-free' : `${loan.interestType} · ${(loan.rateBps / 100).toFixed(1)}% p.a.`
  return (
    <>
      <tr className="border-b border-border hover:bg-muted/30">
        <td className="px-5 py-2.5">
          <button onClick={onToggle} className="flex cursor-pointer items-center gap-1.5 font-medium">
            <ChevronRight className={cn('size-3.5 text-muted-foreground transition-transform', open && 'rotate-90')} />
            {loan.employeeName}
          </button>
        </td>
        <td className="px-3 py-2.5 capitalize">{loan.kind}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{rupee(loan.principal)}</td>
        <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{interest}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{rupee(loan.installment)}</td>
        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{rupee(loan.outstanding)}</td>
        <td className="px-3 py-2.5">
          <span
            className={cn(
              'rounded-md px-2 py-0.5 text-[11px] font-medium',
              loan.status === 'active' ? 'bg-blue-50 text-blue-700' : 'bg-muted text-muted-foreground',
            )}
          >
            {loan.status}
          </span>
        </td>
        <td className="px-5 py-2.5 text-right">
          {canRun && loan.status === 'active' && (
            <button onClick={onClose} className="cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              Close
            </button>
          )}
          {canRun && loan.outstanding === loan.totalPayable && (
            <button onClick={onDelete} aria-label="Delete" className="ml-1 cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-rose-600">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr className="bg-muted/20">
          <td colSpan={8} className="px-5 py-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recovery schedule</div>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {loan.installments.map((i) => (
                <div key={i.id} className="flex items-center justify-between rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px]">
                  <span className="text-muted-foreground">{monthLabel(i.period)}</span>
                  <span className="tabular-nums">{rupee(i.amount)}</span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium',
                      i.status === 'recovered'
                        ? 'bg-emerald-50 text-emerald-700'
                        : i.status === 'scheduled'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-amber-50 text-amber-700',
                    )}
                  >
                    {i.status}
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function AddAdvanceModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeId, setEmployeeId] = useState('')
  const [kind, setKind] = useState<'advance' | 'loan'>('advance')
  const [principal, setPrincipal] = useState('')
  const [interestType, setInterestType] = useState<'none' | 'flat' | 'reducing'>('none')
  const [rate, setRate] = useState('')
  const [tenure, setTenure] = useState('3')
  const [startPeriod, setStartPeriod] = useState(thisMonth())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const idemKey = useRef(crypto.randomUUID())

  useEffect(() => {
    listEmployees().then((e) => {
      setEmployees(e)
      if (e[0]) setEmployeeId(e[0].id)
    })
  }, [])

  const submit = async () => {
    const p = Math.round(Number(principal) * 100)
    if (!employeeId || !p) {
      setError('Pick an employee and principal amount')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createAdvance({
        employeeId,
        kind,
        principal: p,
        interestType,
        rateBps: interestType === 'none' ? 0 : Math.round(Number(rate) * 100),
        tenureMonths: Math.max(1, Number(tenure) || 1),
        startPeriod,
      }, idemKey.current)
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title="New advance / loan" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Employee">
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputCls}>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select value={kind} onChange={(e) => setKind(e.target.value as 'advance' | 'loan')} className={inputCls}>
            <option value="advance">Advance (short-term)</option>
            <option value="loan">Loan</option>
          </select>
        </Field>
        <Field label="Principal (₹)">
          <input value={principal} onChange={(e) => setPrincipal(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={inputCls} />
        </Field>
        <Field label="Recover over (months)">
          <input value={tenure} onChange={(e) => setTenure(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={inputCls} />
        </Field>
        <Field label="Interest">
          <select value={interestType} onChange={(e) => setInterestType(e.target.value as 'none' | 'flat' | 'reducing')} className={inputCls}>
            <option value="none">Interest-free</option>
            <option value="flat">Flat rate</option>
            <option value="reducing">Reducing balance (EMI)</option>
          </select>
        </Field>
        <Field label="Rate (% p.a.)">
          <input
            value={rate}
            onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))}
            disabled={interestType === 'none'}
            inputMode="decimal"
            className={cn(inputCls, interestType === 'none' && 'opacity-50')}
          />
        </Field>
        <Field label="First recovery month">
          <input type="month" value={startPeriod} onChange={(e) => e.target.value && setStartPeriod(e.target.value)} className={inputCls} />
        </Field>
      </div>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onCancel={onClose} onSubmit={submit} submitLabel="Create" />
    </ModalShell>
  )
}

// ─── History ───────────────────────────────────────────────────
function History() {
  const [runs, setRuns] = useState<PayrollRunRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openRun, setOpenRun] = useState<(PayrollRunRow & { payslips: PayslipDetail[] }) | null>(null)
  const [slip, setSlip] = useState<PayslipDetail | null>(null)

  useEffect(() => {
    getPayrollRuns()
      .then(setRuns)
      .finally(() => setLoading(false))
  }, [])

  const openRunDetail = async (id: string) => {
    setOpenRun(await getPayrollRun(id))
  }

  if (loading) return <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">Loading…</div>
  if (runs.length === 0)
    return <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">No finalized payroll yet.</div>

  return (
    <div className="min-h-0 flex-1 overflow-auto p-5">
      <div className="space-y-2">
        {runs.map((r) => (
          <button
            key={r.id}
            onClick={() => openRunDetail(r.id)}
            className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-[#2f63d8]/10 text-[#2f63d8]">
                <IndianRupee className="size-4" />
              </div>
              <div>
                <div className="text-[13px] font-medium">{monthLabel(r.period)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {r._count?.payslips ?? 0} payslips · {r.lockedAt ? 'Finalized' : r.status}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[13px] font-semibold tabular-nums">{rupee(r.netTotal)}</div>
              <div className="text-[11px] text-muted-foreground">net</div>
            </div>
          </button>
        ))}
      </div>

      {openRun && (
        <ModalShell title={monthLabel(openRun.period)} onClose={() => setOpenRun(null)} wide>
          <div className="space-y-1">
            {openRun.payslips.map((p) => (
              <button
                key={p.id}
                onClick={() => getPayslip(p.id).then(setSlip)}
                className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-[13px] transition-colors hover:bg-muted"
              >
                <span className="flex items-center gap-2">
                  <FileText className="size-3.5 text-muted-foreground" />
                  {p.empName}
                </span>
                <span className="font-semibold tabular-nums">{rupee(p.net)}</span>
              </button>
            ))}
          </div>
        </ModalShell>
      )}

      {slip && <PayslipModal slip={slip} onClose={() => setSlip(null)} />}
    </div>
  )
}

function PayslipModal({ slip, onClose }: { slip: PayslipDetail; onClose: () => void }) {
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      const blob = await getPayslipPdfBlob(slip.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payslip-${slip.period}-${slip.empName.replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      sound.success()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const shareWhatsApp = () => {
    const msg = `Hi ${slip.empName}, your payslip for ${monthLabel(slip.period)} is ready. Net pay: ${rupee(slip.net)}. (Payslip PDF attached.)`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <ModalShell title={`Payslip · ${slip.empName}`} onClose={onClose}>
      <div className="text-[12px] text-muted-foreground">
        {monthLabel(slip.period)} · Paid {slip.paidDays}/{slip.totalDays} days
      </div>
      <PayslipBreakup lines={slip.lines} net={slip.net} employerContrib={slip.employerContrib} />
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <button
          onClick={shareWhatsApp}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-[13px] font-medium transition-colors hover:bg-muted"
        >
          <Share2 className="size-4 text-emerald-600" /> WhatsApp
        </button>
        <button
          onClick={download}
          disabled={busy}
          className="btn-3d inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Download PDF
        </button>
      </div>
    </ModalShell>
  )
}

// ─── shared bits ───────────────────────────────────────────────
const inputCls =
  'h-9 w-full rounded-lg border border-border bg-card px-2.5 text-[13px] outline-none transition-colors focus:border-ring'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
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
          wide ? 'max-w-xl' : 'max-w-md',
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
