import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Loader2, X, Plus, Trash2, Send, Rocket, Check } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import PageTabs from '@/components/admin/PageTabs'
import DetailPanel, { Field as DetailField } from '@/components/admin/DetailPanel'
import MetricCard from '@/components/admin/MetricCard'
import StatusBadge, { type StatusTone } from '@/components/admin/StatusBadge'
import { EmployeeAvatar } from '@/lib/people'
import DataGrid, { type GridColumn, type BadgeTone } from '@/components/admin/DataGrid'
import GridToolbar from '@/components/admin/GridToolbar'
import UpgradeModal from '@/components/admin/UpgradeModal'
import { useListView } from '@/lib/useListView'
import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import {
  listEmployees,
  getObjectives,
  getObjective,
  createObjective,
  updateObjective,
  deleteObjective,
  addKeyResult,
  updateKeyResult,
  deleteKeyResult,
  getCycles,
  createCycle,
  updateCycle,
  deleteCycle,
  launchCycle,
  getReviews,
  getReview,
  updateReview,
  submitReview,
  acknowledgeReview,
  getFeedback,
  createFeedback,
  deleteFeedback,
  getPerformanceSummary,
  type Objective,
  type ObjectiveDetail,
  type ObjectiveStatus,
  type KeyResult,
  type KrMetricType,
  type KrStatus,
  type ReviewCycle,
  type CycleType,
  type Review,
  type ReviewType,
  type Feedback,
  type FeedbackKind,
  type FeedbackVisibility,
  type PerformanceSummary,
  type Paywall,
} from '@/lib/api'
import { type Employee } from '@/lib/employees'

// ─── shared constants / helpers ───
const OBJECTIVE_STATUSES: ObjectiveStatus[] = ['draft', 'active', 'completed', 'cancelled']
const OBJECTIVE_STATUS_LABEL: Record<ObjectiveStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
function objectiveStatusTone(s: ObjectiveStatus): StatusTone {
  return s === 'active' ? 'blue' : s === 'completed' ? 'green' : s === 'cancelled' ? 'rose' : 'gray'
}

const KR_METRICS: KrMetricType[] = ['percent', 'number', 'currency', 'boolean']
const KR_METRIC_LABEL: Record<KrMetricType, string> = {
  percent: 'Percent',
  number: 'Number',
  currency: 'Currency (₹)',
  boolean: 'Done / not done',
}
const KR_STATUSES: KrStatus[] = ['on_track', 'at_risk', 'off_track', 'done']
const KR_STATUS_LABEL: Record<KrStatus, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  off_track: 'Off track',
  done: 'Done',
}
function krStatusTone(s: KrStatus): StatusTone {
  return s === 'done' ? 'green' : s === 'on_track' ? 'blue' : s === 'at_risk' ? 'amber' : 'rose'
}

const CYCLE_TYPES: CycleType[] = ['annual', 'quarterly', 'monthly', 'probation']
const CYCLE_TYPE_LABEL: Record<CycleType, string> = {
  annual: 'Annual',
  quarterly: 'Quarterly',
  monthly: 'Monthly',
  probation: 'Probation',
}
function cycleStatusTone(s: ReviewCycle['status']): StatusTone {
  return s === 'active' ? 'blue' : s === 'closed' ? 'gray' : 'amber'
}

const REVIEW_TYPE_LABEL: Record<ReviewType, string> = { self: 'Self', manager: 'Manager', peer: 'Peer' }
function reviewTypeTone(t: ReviewType): StatusTone {
  return t === 'self' ? 'violet' : t === 'manager' ? 'blue' : 'gray'
}
function reviewStatusTone(s: Review['status']): StatusTone {
  return s === 'pending' ? 'amber' : s === 'submitted' ? 'blue' : 'green'
}
const REVIEW_STATUS_LABEL: Record<Review['status'], string> = {
  pending: 'Pending',
  submitted: 'Submitted',
  acknowledged: 'Acknowledged',
}

const FEEDBACK_KINDS: FeedbackKind[] = ['praise', 'constructive', 'general']
const FEEDBACK_KIND_LABEL: Record<FeedbackKind, string> = { praise: 'Praise', constructive: 'Constructive', general: 'General' }
function feedbackKindTone(k: FeedbackKind): StatusTone {
  return k === 'praise' ? 'green' : k === 'constructive' ? 'amber' : 'gray'
}
const FEEDBACK_VISIBILITY: FeedbackVisibility[] = ['private', 'manager', 'public']
const FEEDBACK_VIS_LABEL: Record<FeedbackVisibility, string> = { private: 'Private', manager: 'Manager', public: 'Public' }

const fmtTime = (s: string) =>
  new Date(s).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

const inputCls =
  'h-9 w-full rounded-lg border border-border bg-card px-2.5 text-[13px] outline-none transition-colors focus:border-ring'

function stars(rating: number | null): string {
  if (!rating) return '—'
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

type Tab = 'goals' | 'reviews' | 'feedback'

export default function Performance() {
  const { firstTabActive } = useShell()
  const { activeWorkspace, user } = useAuth()
  const canManage =
    activeWorkspace?.role === 'Owner' || activeWorkspace?.role === 'Admin' || activeWorkspace?.role === 'Manager'

  const [tab, setTab] = useState<Tab>('goals')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [summary, setSummary] = useState<PerformanceSummary | null>(null)
  const [paywall, setPaywall] = useState<Paywall | null>(null)

  useEffect(() => {
    listEmployees().then(setEmployees).catch(() => {})
  }, [])

  const loadSummary = useCallback(() => {
    getPerformanceSummary().then(setSummary).catch(() => {})
  }, [])
  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  // resolve the caller's own employee id (phone match — same rule the server uses)
  const myEmployeeId = useMemo(() => {
    if (!user?.phone) return ''
    return employees.find((e) => e.phone && e.phone === user.phone)?.id ?? ''
  }, [employees, user])

  const header = (
    <>
      <PageTabs
        tabs={[
          { key: 'goals', label: 'Goals' },
          { key: 'reviews', label: 'Reviews' },
          { key: 'feedback', label: 'Feedback' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-border p-4 lg:grid-cols-4">
        <MetricCard label="Active objectives" value={summary ? String(summary.activeObjectives) : '—'} />
        <MetricCard label="Avg progress" value={summary ? `${summary.avgObjectiveProgress}%` : '—'} />
        <MetricCard label="Reviews pending" value={summary ? String(summary.pendingReviews) : '—'} />
        <MetricCard label="Feedback this month" value={summary ? String(summary.feedbackThisMonth) : '—'} />
      </div>
    </>
  )

  return (
    <>
      {tab === 'goals' && (
        <GoalsTab header={header} firstTabActive={firstTabActive} employees={employees} canManage={canManage} onChanged={loadSummary} onPaywall={setPaywall} />
      )}
      {tab === 'reviews' && (
        <ReviewsTab
          header={header}
          firstTabActive={firstTabActive}
          employees={employees}
          canManage={canManage}
          myEmployeeId={myEmployeeId}
          onChanged={loadSummary}
        />
      )}
      {tab === 'feedback' && (
        <FeedbackTab
          header={header}
          firstTabActive={firstTabActive}
          employees={employees}
          canManage={canManage}
          myEmployeeId={myEmployeeId}
          onChanged={loadSummary}
        />
      )}
      {paywall && (
        <UpgradeModal
          workspaceId={activeWorkspace?.id ?? ''}
          workspaceName={activeWorkspace?.name}
          paywall={paywall}
          onClose={() => setPaywall(null)}
          onSuccess={() => setPaywall(null)}
        />
      )}
    </>
  )
}

// ─── Goals tab ───────────────────────────────────────────────────────────────
function GoalsTab({
  header,
  firstTabActive,
  employees,
  canManage,
  onChanged,
  onPaywall,
}: {
  header: ReactNode
  firstTabActive: boolean
  employees: Employee[]
  canManage: boolean
  onChanged: () => void
  onPaywall: (p: Paywall) => void
}) {
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [loading, setLoading] = useState(true)
  const [mine, setMine] = useState(!canManage)
  const [createOpen, setCreateOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getObjectives({ mine: mine || undefined })
      .then(setObjectives)
      .finally(() => setLoading(false))
  }, [mine])
  useEffect(() => {
    load()
  }, [load])

  // shared search + status filter + sort, identical to Employees
  const lv = useListView<Objective>({
    rows: objectives,
    search: (o) => `${o.title} ${o.ownerName} ${o.period}`,
    filters: [{ id: 'status', label: 'Status', get: (o) => OBJECTIVE_STATUS_LABEL[o.status] }],
    sorts: [
      { key: 'title', label: 'Objective', get: (o) => o.title },
      { key: 'status', label: 'Status', get: (o) => OBJECTIVE_STATUS_LABEL[o.status] },
      { key: 'progress', label: 'Progress', get: (o) => o.progress },
      { key: 'owner', label: 'Owner', get: (o) => o.ownerName },
    ],
  })

  const columns: GridColumn<Objective>[] = [
    { id: 'owner', title: 'Owner', kind: 'person', width: 170, get: (r) => r.ownerName || '—' },
    { id: 'title', title: 'Objective', kind: 'text', width: 280, get: (r) => r.title },
    {
      id: 'period',
      title: 'Period',
      kind: 'badge',
      width: 120,
      get: (r) => r.period || '',
      badgeTone: () => 'violet' as BadgeTone,
    },
    { id: 'progress', title: 'Progress', kind: 'text', width: 100, get: (r) => `${r.progress}%` },
    { id: 'krs', title: 'KRs', kind: 'number', width: 70, get: (r) => r.keyResultCount ?? 0 },
    {
      id: 'status',
      title: 'Status',
      kind: 'badge',
      width: 120,
      get: (r) => OBJECTIVE_STATUS_LABEL[r.status],
      badgeTone: (r) => objectiveStatusTone(r.status) as BadgeTone,
    },
  ]

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
        {header}
        <GridToolbar
          total={objectives.length}
          {...lv.toolbar}
          searchPlaceholder="Search objectives…"
          extraActions={
            <label className="flex cursor-pointer items-center gap-1.5 px-2 text-[13px] text-muted-foreground">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Mine
            </label>
          }
          primaryAction={{ label: 'New objective', onClick: () => setCreateOpen(true), icon: Plus }}
        />

        {loading ? (
          <div className="grid flex-1 place-items-center border-t border-border text-[13px] text-muted-foreground">
            Loading…
          </div>
        ) : objectives.length === 0 ? (
          <div className="grid flex-1 place-items-center border-t border-border px-4 text-center text-[13px] text-muted-foreground">
            No objectives yet. Click “New objective” to set a goal.
          </div>
        ) : (
          <div className="min-h-0 flex-1 border-t border-border">
            <DataGrid
              rows={lv.view}
              columns={columns}
              getRowId={(r) => r.id}
              onRowClick={(r) => setOpenId(r.id)}
              onAddRow={() => setCreateOpen(true)}
              emptyMessage="No objectives"
            />
          </div>
        )}

        {createOpen && (
          <ObjectiveModal
            employees={employees}
            canManage={canManage}
            onClose={() => setCreateOpen(false)}
            onPaywall={(p) => {
              setCreateOpen(false)
              onPaywall(p)
            }}
            onDone={() => {
              setCreateOpen(false)
              load()
              onChanged()
            }}
          />
        )}
      </Panel>
      <ObjectiveDetailPanel
        objectiveId={openId}
        open={!!openId}
        onClose={() => setOpenId(null)}
        onChanged={() => {
          load()
          onChanged()
        }}
        onDeleted={() => {
          setOpenId(null)
          load()
          onChanged()
        }}
      />
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-foreground transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

function ObjectiveDetailPanel({
  objectiveId,
  open,
  onClose,
  onChanged,
  onDeleted,
}: {
  objectiveId: string | null
  open: boolean
  onClose: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const [obj, setObj] = useState<ObjectiveDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const load = useCallback(() => {
    if (!objectiveId) {
      setObj(null)
      return
    }
    getObjective(objectiveId)
      .then(setObj)
      .catch((e) => setError((e as Error).message))
  }, [objectiveId])
  useEffect(() => {
    load()
  }, [load])

  const changeStatus = async (s: ObjectiveStatus) => {
    if (!objectiveId) return
    setBusy(true)
    setError('')
    try {
      await updateObjective(objectiveId, { status: s })
      sound.success()
      load()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const saveKr = async (kr: KeyResult, currentValue: number) => {
    setBusy(true)
    setError('')
    try {
      await updateKeyResult(kr.id, { currentValue })
      sound.success()
      load()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const changeKrStatus = async (kr: KeyResult, status: KrStatus) => {
    setBusy(true)
    setError('')
    try {
      await updateKeyResult(kr.id, { status })
      load()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const removeKr = async (kr: KeyResult) => {
    if (!confirm('Delete this key result?')) return
    setBusy(true)
    try {
      await deleteKeyResult(kr.id)
      load()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!objectiveId) return
    if (!confirm('Delete this objective and all its key results?')) return
    setBusy(true)
    setError('')
    try {
      await deleteObjective(objectiveId)
      sound.success()
      onDeleted()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <>
      <DetailPanel
        open={open}
        onClose={onClose}
        width="w-80"
        avatar={{ name: obj?.ownerName ?? '' }}
        title={obj?.title ?? 'Objective'}
        subtitle={obj ? `${obj.progress}% · ${obj.period || '—'}` : undefined}
        footer={
          obj ? (
            <>
              <button
                onClick={remove}
                disabled={busy}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
              <button
                onClick={onClose}
                className="ml-auto inline-flex h-8 cursor-pointer items-center rounded-lg border border-border bg-card px-3 text-[13px] font-medium hover:bg-muted"
              >
                Close
              </button>
            </>
          ) : undefined
        }
      >
        {!obj ? (
          <div className="py-6 text-center text-[13px] text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <DetailField label="Owner">{obj.ownerName || '—'}</DetailField>
              <DetailField label="Status">
                <StatusBadge tone={objectiveStatusTone(obj.status)}>{OBJECTIVE_STATUS_LABEL[obj.status]}</StatusBadge>
              </DetailField>
              <DetailField label="Period">{obj.period || '—'}</DetailField>
            </div>
            {obj.description && (
              <p className="whitespace-pre-wrap text-[13px] text-foreground/90">{obj.description}</p>
            )}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[12px] font-medium text-muted-foreground">
                <span>Overall progress</span>
                <span>{obj.progress}%</span>
              </div>
              <ProgressBar value={obj.progress} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {OBJECTIVE_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  disabled={busy || s === obj.status}
                  className={cn(
                    'inline-flex h-7 cursor-pointer items-center rounded-lg border px-3 text-[12px] font-medium transition-colors disabled:cursor-default',
                    s === obj.status
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted',
                  )}
                >
                  {OBJECTIVE_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <div className="border-t border-border pt-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[12px] font-medium text-muted-foreground">Key results</div>
                <button
                  onClick={() => setAddOpen(true)}
                  className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-[12px] font-medium text-muted-foreground hover:bg-muted"
                >
                  <Plus className="size-3.5" /> Add KR
                </button>
              </div>
              {obj.keyResults.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No key results yet.</p>
              ) : (
                <ul className="space-y-3">
                  {obj.keyResults.map((kr) => (
                    <KeyResultRow
                      key={kr.id}
                      kr={kr}
                      busy={busy}
                      onSave={(v) => saveKr(kr, v)}
                      onStatus={(s) => changeKrStatus(kr, s)}
                      onDelete={() => removeKr(kr)}
                    />
                  ))}
                </ul>
              )}
            </div>
            {error && <p className="text-[13px] text-rose-600">{error}</p>}
          </div>
        )}
      </DetailPanel>

      {addOpen && obj && (
        <KeyResultModal
          objectiveId={obj.id}
          onClose={() => setAddOpen(false)}
          onDone={() => {
            setAddOpen(false)
            load()
            onChanged()
          }}
        />
      )}
    </>
  )
}

function fmtKrValue(kr: KeyResult, v: number): string {
  if (kr.metricType === 'currency') return `₹${Math.round(v / 100).toLocaleString('en-IN')}`
  if (kr.metricType === 'percent') return `${v}%`
  if (kr.metricType === 'boolean') return v >= 1 ? 'Done' : 'Not done'
  return String(v)
}

function KeyResultRow({
  kr,
  busy,
  onSave,
  onStatus,
  onDelete,
}: {
  kr: KeyResult
  busy: boolean
  onSave: (currentValue: number) => void
  onStatus: (status: KrStatus) => void
  onDelete: () => void
}) {
  // currency KRs are stored in paise but the user always enters/sees rupees (same unit as the
  // create modal). Convert to rupees for display and multiply back to paise on save.
  const isCurrency = kr.metricType === 'currency'
  const toDisplay = (paise: number) => (isCurrency ? paise / 100 : paise)
  const toStorage = (display: number) => Math.max(0, Math.trunc(display || 0)) * (isCurrency ? 100 : 1)

  const [val, setVal] = useState(String(toDisplay(kr.currentValue)))
  useEffect(() => {
    setVal(String(toDisplay(kr.currentValue)))
  }, [kr.currentValue]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = Number(val) !== toDisplay(kr.currentValue)

  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{kr.title}</div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            {fmtKrValue(kr, kr.startValue)} → {fmtKrValue(kr, kr.targetValue)} · {KR_METRIC_LABEL[kr.metricType]}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <StatusBadge tone={krStatusTone(kr.status)}>{KR_STATUS_LABEL[kr.status]}</StatusBadge>
          <button
            onClick={onDelete}
            disabled={busy}
            aria-label="Delete key result"
            className="grid size-6 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[12px] text-muted-foreground">
          <span>Progress</span>
          <span>{kr.progress}%</span>
        </div>
        <ProgressBar value={kr.progress} />
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        {kr.metricType === 'boolean' ? (
          <select
            value={Number(val) >= 1 ? '1' : '0'}
            onChange={(e) => setVal(e.target.value)}
            className={cn(inputCls, 'h-8 w-32')}
          >
            <option value="0">Not done</option>
            <option value="1">Done</option>
          </select>
        ) : (
          <input
            type="number"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className={cn(inputCls, 'h-8 w-32')}
          />
        )}
        <button
          onClick={() => onSave(toStorage(Number(val)))}
          disabled={busy || !dirty}
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg bg-foreground px-3 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          Update
        </button>
        <select
          value={kr.status}
          onChange={(e) => onStatus(e.target.value as KrStatus)}
          disabled={busy}
          className={cn(inputCls, 'ml-auto h-8 w-32')}
        >
          {KR_STATUSES.map((s) => (
            <option key={s} value={s}>
              {KR_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
    </li>
  )
}

function ObjectiveModal({
  employees,
  canManage,
  onClose,
  onDone,
  onPaywall,
}: {
  employees: Employee[]
  canManage: boolean
  onClose: () => void
  onDone: () => void
  onPaywall: (p: Paywall) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [period, setPeriod] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createObjective({ title, description, period, ownerId: canManage && ownerId ? ownerId : undefined })
      sound.success()
      onDone()
    } catch (e) {
      const err = e as Error & { status?: number; payload?: { paywall?: Paywall } }
      if (err.status === 402 && err.payload?.paywall) {
        onPaywall(err.payload.paywall)
        return
      }
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title="New objective" onClose={onClose}>
      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputCls}
          placeholder="e.g. Grow MRR to ₹10L"
          autoFocus
        />
      </Field>
      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What does success look like?"
          className={cn(inputCls, 'h-auto resize-none py-2')}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Period">
          <input value={period} onChange={(e) => setPeriod(e.target.value)} className={inputCls} placeholder="2026-Q2 / FY2026" />
        </Field>
        {canManage && (
          <Field label="Owner">
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputCls}>
              <option value="">Me</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Create objective" />
    </ModalShell>
  )
}

function KeyResultModal({
  objectiveId,
  onClose,
  onDone,
}: {
  objectiveId: string
  onClose: () => void
  onDone: () => void
}) {
  const [title, setTitle] = useState('')
  const [metricType, setMetricType] = useState<KrMetricType>('percent')
  const [startValue, setStartValue] = useState('0')
  const [targetValue, setTargetValue] = useState('100')
  const [currentValue, setCurrentValue] = useState('0')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isBool = metricType === 'boolean'
  const hint = metricType === 'currency' ? ' (in ₹, stored as paise ×100)' : ''

  const submit = async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setBusy(true)
    setError('')
    try {
      const mul = metricType === 'currency' ? 100 : 1
      await addKeyResult(objectiveId, {
        title,
        metricType,
        startValue: isBool ? 0 : Math.max(0, Math.trunc(Number(startValue) || 0)) * mul,
        targetValue: isBool ? 1 : Math.max(0, Math.trunc(Number(targetValue) || 0)) * mul,
        currentValue: isBool ? 0 : Math.max(0, Math.trunc(Number(currentValue) || 0)) * mul,
      })
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Add key result" onClose={onClose}>
      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputCls}
          placeholder="e.g. Close 20 enterprise deals"
          autoFocus
        />
      </Field>
      <Field label="Metric type">
        <select value={metricType} onChange={(e) => setMetricType(e.target.value as KrMetricType)} className={inputCls}>
          {KR_METRICS.map((m) => (
            <option key={m} value={m}>
              {KR_METRIC_LABEL[m]}
            </option>
          ))}
        </select>
      </Field>
      {!isBool && (
        <div className="grid grid-cols-3 gap-3">
          <Field label={`Start${hint}`}>
            <input type="number" value={startValue} onChange={(e) => setStartValue(e.target.value)} className={inputCls} />
          </Field>
          <Field label={`Target${hint}`}>
            <input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className={inputCls} />
          </Field>
          <Field label={`Current${hint}`}>
            <input type="number" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} className={inputCls} />
          </Field>
        </div>
      )}
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Add key result" />
    </ModalShell>
  )
}

// ─── Reviews tab ───────────────────────────────────────────────────────────────
function ReviewsTab({
  header,
  firstTabActive,
  employees,
  canManage,
  myEmployeeId,
  onChanged,
}: {
  header: ReactNode
  firstTabActive: boolean
  employees: Employee[]
  canManage: boolean
  myEmployeeId: string
  onChanged: () => void
}) {
  const [cycles, setCycles] = useState<ReviewCycle[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [cycleId, setCycleId] = useState('')
  const [scope, setScope] = useState<'all' | 'mine' | 'about'>(canManage ? 'all' : 'mine')
  const [cycleOpen, setCycleOpen] = useState(false)
  const [launchCycleObj, setLaunchCycleObj] = useState<ReviewCycle | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const loadCycles = useCallback(() => {
    getCycles().then(setCycles).catch(() => {})
  }, [])
  useEffect(() => {
    loadCycles()
  }, [loadCycles])

  const load = useCallback(() => {
    setLoading(true)
    getReviews({
      cycleId: cycleId || undefined,
      mine: scope === 'mine' || undefined,
      about: scope === 'about' || undefined,
    })
      .then(setReviews)
      .finally(() => setLoading(false))
  }, [cycleId, scope])
  useEffect(() => {
    load()
  }, [load])

  const columns: GridColumn<Review>[] = [
    { id: 'employee', title: 'Reviewee', kind: 'person', width: 160, get: (r) => r.employeeName || '—' },
    { id: 'reviewer', title: 'Reviewer', kind: 'person', width: 160, get: (r) => r.reviewerName || '—' },
    { id: 'cycle', title: 'Cycle', kind: 'text', width: 180, get: (r) => r.cycleName },
    {
      id: 'type',
      title: 'Type',
      kind: 'badge',
      width: 110,
      get: (r) => REVIEW_TYPE_LABEL[r.type],
      badgeTone: (r) => reviewTypeTone(r.type) as BadgeTone,
    },
    { id: 'rating', title: 'Rating', kind: 'text', width: 120, get: (r) => stars(r.overallRating) },
    {
      id: 'status',
      title: 'Status',
      kind: 'badge',
      width: 130,
      get: (r) => REVIEW_STATUS_LABEL[r.status],
      badgeTone: (r) => reviewStatusTone(r.status) as BadgeTone,
    },
  ]

  // shared search + filter (type / status) + sort over the server-scoped reviews
  const lv = useListView<Review>({
    rows: reviews,
    search: (r) => `${r.employeeName} ${r.reviewerName} ${r.cycleName}`,
    filters: [
      { id: 'type', label: 'Type', get: (r) => REVIEW_TYPE_LABEL[r.type] },
      { id: 'status', label: 'Status', get: (r) => REVIEW_STATUS_LABEL[r.status] },
    ],
    sorts: [
      { key: 'employee', label: 'Reviewee', get: (r) => r.employeeName },
      { key: 'reviewer', label: 'Reviewer', get: (r) => r.reviewerName },
      { key: 'cycle', label: 'Cycle', get: (r) => r.cycleName },
      { key: 'type', label: 'Type', get: (r) => REVIEW_TYPE_LABEL[r.type] },
      { key: 'rating', label: 'Rating', get: (r) => r.overallRating ?? 0 },
      { key: 'status', label: 'Status', get: (r) => REVIEW_STATUS_LABEL[r.status] },
    ],
  })

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
        {header}
      {canManage && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground">Cycles:</span>
          {cycles.length === 0 ? (
            <span className="text-[13px] text-muted-foreground">None yet</span>
          ) : (
            cycles.map((c) => (
              <CycleChip
                key={c.id}
                cycle={c}
                onLaunch={() => setLaunchCycleObj(c)}
                onClose={async () => {
                  await updateCycle(c.id, { status: 'closed' }).catch(() => {})
                  loadCycles()
                }}
                onDelete={async () => {
                  if (!confirm(`Delete cycle "${c.name}" and its reviews?`)) return
                  await deleteCycle(c.id).catch(() => {})
                  loadCycles()
                  load()
                  onChanged()
                }}
              />
            ))
          )}
          <button
            onClick={() => setCycleOpen(true)}
            className="btn-3d ml-auto inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background hover:opacity-90"
          >
            <Plus className="size-4" /> New cycle
          </button>
        </div>
      )}

      <GridToolbar
        total={reviews.length}
        {...lv.toolbar}
        searchPlaceholder="Search reviews…"
        extraActions={
          <>
            <select
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              className="h-7 rounded-md border border-border bg-card px-2 text-[13px] outline-none transition-colors focus:border-ring"
            >
              <option value="">All cycles</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="inline-flex overflow-hidden rounded-md border border-border">
              {(['all', 'mine', 'about'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={cn(
                    'h-7 cursor-pointer px-2.5 text-[12px] font-medium transition-colors',
                    scope === s ? 'bg-foreground text-background' : 'bg-card text-muted-foreground hover:bg-muted',
                  )}
                >
                  {s === 'all' ? 'All' : s === 'mine' ? 'To review' : 'About me'}
                </button>
              ))}
            </div>
          </>
        }
      />

      {loading ? (
        <div className="grid flex-1 place-items-center border-t border-border text-[13px] text-muted-foreground">
          Loading…
        </div>
      ) : reviews.length === 0 ? (
        <div className="grid flex-1 place-items-center border-t border-border px-4 text-center text-[13px] text-muted-foreground">
          {canManage
            ? 'No reviews yet. Create a cycle and launch it to generate reviews.'
            : 'No reviews assigned to you yet.'}
        </div>
      ) : (
        <div className="min-h-0 flex-1 border-t border-border">
          <DataGrid
            rows={lv.view}
            columns={columns}
            getRowId={(r) => r.id}
            onRowClick={(r) => setOpenId(r.id)}
            emptyMessage="No reviews"
          />
        </div>
      )}

      {cycleOpen && (
        <CycleModal
          onClose={() => setCycleOpen(false)}
          onDone={() => {
            setCycleOpen(false)
            loadCycles()
          }}
        />
      )}
      {launchCycleObj && (
        <LaunchModal
          cycle={launchCycleObj}
          employees={employees}
          onClose={() => setLaunchCycleObj(null)}
          onDone={() => {
            setLaunchCycleObj(null)
            loadCycles()
            load()
            onChanged()
          }}
        />
      )}
      </Panel>
      <ReviewDetailPanel
        reviewId={openId}
        open={!!openId}
        canManage={canManage}
        myEmployeeId={myEmployeeId}
        onClose={() => setOpenId(null)}
        onChanged={() => {
          load()
          onChanged()
        }}
      />
    </div>
  )
}

function CycleChip({
  cycle,
  onLaunch,
  onClose,
  onDelete,
}: {
  cycle: ReviewCycle
  onLaunch: () => void
  onClose: () => void
  onDelete: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card py-1 pl-2.5 pr-1.5 text-[12px]">
      <span className="font-medium">{cycle.name}</span>
      <StatusBadge tone={cycleStatusTone(cycle.status)}>{cycle.status}</StatusBadge>
      <span className="text-muted-foreground">{cycle.reviewCount ?? 0}</span>
      {cycle.status !== 'closed' && (
        <button
          onClick={onLaunch}
          title="Launch"
          className="grid size-6 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-blue-50 hover:text-blue-600"
        >
          <Rocket className="size-3.5" />
        </button>
      )}
      {cycle.status === 'active' && (
        <button
          onClick={onClose}
          title="Close cycle"
          className="grid size-6 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Check className="size-3.5" />
        </button>
      )}
      <button
        onClick={onDelete}
        title="Delete"
        className="grid size-6 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
      >
        <Trash2 className="size-3.5" />
      </button>
    </span>
  )
}

function CycleModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [period, setPeriod] = useState('')
  const [type, setType] = useState<CycleType>('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createCycle({ name, period, type, startDate, endDate })
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title="New review cycle" onClose={onClose}>
      <Field label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
          placeholder="e.g. 2026 Annual"
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Period">
          <input value={period} onChange={(e) => setPeriod(e.target.value)} className={inputCls} placeholder="FY2026" />
        </Field>
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value as CycleType)} className={inputCls}>
            {CYCLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {CYCLE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start date">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="End date">
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
        </Field>
      </div>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Create cycle" />
    </ModalShell>
  )
}

function LaunchModal({
  cycle,
  employees,
  onClose,
  onDone,
}: {
  cycle: ReviewCycle
  employees: Employee[]
  onClose: () => void
  onDone: () => void
}) {
  const [allEmployees, setAllEmployees] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [includeSelf, setIncludeSelf] = useState(true)
  const [includeManager, setIncludeManager] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const submit = async () => {
    if (!includeSelf && !includeManager) {
      setError('Pick at least one of self / manager reviews')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await launchCycle(cycle.id, {
        employeeIds: allEmployees ? undefined : selected,
        includeSelf,
        includeManager,
      })
      sound.success()
      alert(`${res.created} review(s) created (${res.reviewCount} total in this cycle).`)
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title={`Launch "${cycle.name}"`} onClose={onClose}>
      <p className="text-[13px] text-muted-foreground">
        Generates pending reviews for the selected employees. Re-launching is safe — existing reviews are not duplicated.
      </p>
      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input type="radio" checked={allEmployees} onChange={() => setAllEmployees(true)} /> All active employees
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input type="radio" checked={!allEmployees} onChange={() => setAllEmployees(false)} /> Pick employees
        </label>
      </div>
      {!allEmployees && (
        <div className="max-h-48 overflow-auto rounded-lg border border-border">
          {employees.map((emp) => (
            <label key={emp.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-muted">
              <input type="checkbox" checked={selected.includes(emp.id)} onChange={() => toggle(emp.id)} />
              {emp.name}
            </label>
          ))}
        </div>
      )}
      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input type="checkbox" checked={includeSelf} onChange={(e) => setIncludeSelf(e.target.checked)} /> Self reviews
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input type="checkbox" checked={includeManager} onChange={(e) => setIncludeManager(e.target.checked)} /> Manager
          reviews (for employees with a manager)
        </label>
      </div>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Launch cycle" />
    </ModalShell>
  )
}

function ReviewDetailPanel({
  reviewId,
  open,
  canManage,
  myEmployeeId,
  onClose,
  onChanged,
}: {
  reviewId: string | null
  open: boolean
  canManage: boolean
  myEmployeeId: string
  onClose: () => void
  onChanged: () => void
}) {
  const [review, setReview] = useState<Review | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rating, setRating] = useState(0)
  const [strengths, setStrengths] = useState('')
  const [improvements, setImprovements] = useState('')
  const [comments, setComments] = useState('')

  const load = useCallback(() => {
    if (!reviewId) {
      setReview(null)
      return
    }
    getReview(reviewId)
      .then((r) => {
        setReview(r)
        setRating(r.overallRating ?? 0)
        setStrengths(r.strengths)
        setImprovements(r.improvements)
        setComments(r.comments)
      })
      .catch((e) => setError((e as Error).message))
  }, [reviewId])
  useEffect(() => {
    load()
  }, [load])

  const isReviewer = !!review && !!myEmployeeId && review.reviewerId === myEmployeeId
  const isReviewee = !!review && !!myEmployeeId && review.employeeId === myEmployeeId
  const editable = isReviewer && review?.status === 'pending'
  const canAcknowledge = isReviewee && review?.status === 'submitted'

  const save = async () => {
    if (!reviewId) return
    setBusy(true)
    setError('')
    try {
      await updateReview(reviewId, { overallRating: rating || null, strengths, improvements, comments })
      sound.success()
      load()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!reviewId) return
    if (!(rating >= 1 && rating <= 5)) {
      setError('Pick an overall rating (1-5) before submitting')
      return
    }
    setBusy(true)
    setError('')
    try {
      await submitReview(reviewId, { overallRating: rating, strengths, improvements, comments })
      sound.success()
      load()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const ack = async () => {
    if (!reviewId) return
    setBusy(true)
    setError('')
    try {
      await acknowledgeReview(reviewId)
      sound.success()
      load()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DetailPanel
      open={open}
      onClose={onClose}
      width="w-80"
      avatar={{ name: review?.employeeName ?? '' }}
      title={review ? `${REVIEW_TYPE_LABEL[review.type]} review` : 'Review'}
      subtitle={review ? REVIEW_STATUS_LABEL[review.status] : undefined}
      footer={
        review ? (
          editable ? (
            <>
              <button
                onClick={save}
                disabled={busy}
                className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border bg-card px-3 text-[13px] font-medium hover:bg-muted disabled:opacity-60"
              >
                Save draft
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className="btn-3d ml-auto inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-3 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Submit
              </button>
            </>
          ) : canAcknowledge ? (
            <button
              onClick={ack}
              disabled={busy}
              className="btn-3d ml-auto inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-3 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Acknowledge
            </button>
          ) : undefined
        ) : undefined
      }
    >
      {!review ? (
        <div className="py-6 text-center text-[13px] text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <DetailField label="Reviewee">{review.employeeName || '—'}</DetailField>
            <DetailField label="Reviewer">{review.reviewerName || '—'}</DetailField>
            <DetailField label="Cycle">{review.cycleName || '—'}</DetailField>
            <DetailField label="Type">
              <StatusBadge tone={reviewTypeTone(review.type)}>{REVIEW_TYPE_LABEL[review.type]}</StatusBadge>
            </DetailField>
            <DetailField label="Overall rating">{stars(review.overallRating)}</DetailField>
          </div>

          {editable ? (
            <div className="space-y-4 border-t border-border pt-4">
              <Field label="Overall rating (1-5)">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setRating(n)}
                      className={cn(
                        'grid size-9 cursor-pointer place-items-center rounded-lg border text-[15px] transition-colors',
                        n <= rating ? 'border-amber-300 bg-amber-50 text-amber-600' : 'border-border bg-card text-muted-foreground hover:bg-muted',
                      )}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Strengths">
                <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3} className={cn(inputCls, 'h-auto resize-none py-2')} />
              </Field>
              <Field label="Areas to improve">
                <textarea value={improvements} onChange={(e) => setImprovements(e.target.value)} rows={3} className={cn(inputCls, 'h-auto resize-none py-2')} />
              </Field>
              <Field label="Comments">
                <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} className={cn(inputCls, 'h-auto resize-none py-2')} />
              </Field>
            </div>
          ) : (
            <div className="space-y-4 border-t border-border pt-4 text-[13px]">
              <ReadOnly label="Strengths" value={review.strengths} />
              <ReadOnly label="Areas to improve" value={review.improvements} />
              <ReadOnly label="Comments" value={review.comments} />
              {review.status === 'pending' && (
                <p className="text-[13px] text-muted-foreground">
                  {canManage ? 'Awaiting the reviewer’s submission.' : 'This review has not been submitted yet.'}
                </p>
              )}
            </div>
          )}

          {error && <p className="text-[13px] text-rose-600">{error}</p>}
        </div>
      )}
    </DetailPanel>
  )
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-foreground/90">{value || '—'}</div>
    </div>
  )
}

// ─── Feedback tab ───────────────────────────────────────────────────────────────
function FeedbackTab({
  header,
  firstTabActive,
  employees,
  canManage,
  myEmployeeId,
  onChanged,
}: {
  header: ReactNode
  firstTabActive: boolean
  employees: Employee[]
  canManage: boolean
  myEmployeeId: string
  onChanged: () => void
}) {
  const [items, setItems] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<'all' | 'mine'>('all')
  const [composeOpen, setComposeOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getFeedback({ mine: scope === 'mine' || undefined })
      .then(setItems)
      .finally(() => setLoading(false))
  }, [scope])
  useEffect(() => {
    load()
  }, [load])

  const remove = async (f: Feedback) => {
    if (!confirm('Delete this feedback?')) return
    try {
      await deleteFeedback(f.id)
      load()
      onChanged()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
        {header}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-border">
          {(['all', 'mine'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={cn(
                'h-9 cursor-pointer px-3 text-[12px] font-medium transition-colors',
                scope === s ? 'bg-foreground text-background' : 'bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              {s === 'all' ? 'All visible' : 'To me'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setComposeOpen(true)}
          className="btn-3d ml-auto inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background hover:opacity-90"
        >
          <Plus className="size-4" /> Give feedback
        </button>
      </div>

      {loading ? (
        <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="grid flex-1 place-items-center px-4 text-center text-[13px] text-muted-foreground">
          No feedback yet. Click “Give feedback” to recognise a colleague.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-5">
          <ul className="mx-auto max-w-2xl space-y-3">
            {items.map((f) => (
              <li key={f.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <EmployeeAvatar name={f.fromName} />
                  <span className="text-[13px] font-medium">{f.fromName || '—'}</span>
                  <span className="text-[12px] text-muted-foreground">→</span>
                  <EmployeeAvatar name={f.toName} />
                  <span className="text-[13px] font-medium">{f.toName || '—'}</span>
                  <StatusBadge tone={feedbackKindTone(f.kind)}>{FEEDBACK_KIND_LABEL[f.kind]}</StatusBadge>
                  <StatusBadge tone="gray">{FEEDBACK_VIS_LABEL[f.visibility]}</StatusBadge>
                  <span className="ml-auto text-[12px] text-muted-foreground">{fmtTime(f.createdAt)}</span>
                  {(canManage || f.fromEmployeeId === myEmployeeId) && (
                    <button
                      onClick={() => remove(f)}
                      aria-label="Delete"
                      className="grid size-6 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[13px] text-foreground/90">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {composeOpen && (
        <FeedbackModal
          employees={employees}
          myEmployeeId={myEmployeeId}
          onClose={() => setComposeOpen(false)}
          onDone={() => {
            setComposeOpen(false)
            load()
            onChanged()
          }}
        />
      )}
      </Panel>
    </div>
  )
}

function FeedbackModal({
  employees,
  myEmployeeId,
  onClose,
  onDone,
}: {
  employees: Employee[]
  myEmployeeId: string
  onClose: () => void
  onDone: () => void
}) {
  const [toEmployeeId, setToEmployeeId] = useState('')
  const [kind, setKind] = useState<FeedbackKind>('praise')
  const [visibility, setVisibility] = useState<FeedbackVisibility>('private')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const recipients = employees.filter((e) => e.id !== myEmployeeId)

  const submit = async () => {
    if (!toEmployeeId) {
      setError('Pick a recipient')
      return
    }
    if (!body.trim()) {
      setError('Write a message')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createFeedback({ toEmployeeId, kind, visibility, body })
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Give feedback" onClose={onClose}>
      <Field label="To">
        <select value={toEmployeeId} onChange={(e) => setToEmployeeId(e.target.value)} className={inputCls} autoFocus>
          <option value="">Select colleague…</option>
          {recipients.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kind">
          <select value={kind} onChange={(e) => setKind(e.target.value as FeedbackKind)} className={inputCls}>
            {FEEDBACK_KINDS.map((k) => (
              <option key={k} value={k}>
                {FEEDBACK_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Visibility">
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as FeedbackVisibility)} className={inputCls}>
            {FEEDBACK_VISIBILITY.map((v) => (
              <option key={v} value={v}>
                {FEEDBACK_VIS_LABEL[v]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Message">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Share specific, helpful feedback…"
          className={cn(inputCls, 'h-auto resize-none py-2')}
        />
      </Field>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Send feedback" />
    </ModalShell>
  )
}

// ─── shared UI primitives ───
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl duration-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 p-5">{children}</div>
      </div>
    </div>
  )
}

function ModalActions({
  busy,
  onClose,
  onSubmit,
  label,
}: {
  busy: boolean
  onClose: () => void
  onSubmit: () => void
  label: string
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <button
        onClick={onClose}
        className="ml-auto h-9 cursor-pointer rounded-lg border border-border bg-card px-4 text-[13px] font-medium hover:bg-muted"
      >
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={busy}
        className="btn-3d inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-60"
      >
        {busy && <Loader2 className="size-3.5 animate-spin" />} {label}
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

