import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Loader2, X, Plus, Trash2, Star, ChevronLeft, ChevronRight, UserCheck, Calendar, Briefcase } from 'lucide-react'
import MetricCard from '@/components/admin/MetricCard'
import Panel from '@/components/admin/Panel'
import PageTabs from '@/components/admin/PageTabs'
import DetailPanel, { Field as DetailField } from '@/components/admin/DetailPanel'
import DataGrid, { type GridColumn, type BadgeTone } from '@/components/admin/DataGrid'
import GridToolbar from '@/components/admin/GridToolbar'
import { useListView } from '@/lib/useListView'
import { EmployeeAvatar } from '@/lib/people'
import StatusBadge, { type StatusTone } from '@/components/admin/StatusBadge'
import UpgradeModal from '@/components/admin/UpgradeModal'
import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import {
  listEmployees,
  getJobs,
  createJob,
  updateJob,
  deleteJob,
  getCandidates,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  getApplicationBoard,
  createApplication,
  updateApplication,
  deleteApplication,
  hireApplication,
  getInterviews,
  createInterview,
  updateInterview,
  deleteInterview,
  getOffers,
  createOffer,
  updateOffer,
  getOffboardings,
  getOffboarding,
  createOffboarding,
  updateOffboarding,
  deleteOffboarding,
  suggestFnf,
  saveFnf,
  approveFnf,
  markFnfPaid,
  type Job,
  type JobStatus,
  type EmploymentType,
  type Candidate,
  type CandidateSource,
  type Application,
  type ApplicationBoard,
  type AppStage,
  type Interview,
  type InterviewMode,
  type InterviewResult,
  type Offer,
  type OfferStatus,
  type Offboarding,
  type OffboardingDetail,
  type OffboardType,
  type OffboardStatus,
  type FnfStatus,
  type Paywall,
} from '@/lib/api'
import { type Employee } from '@/lib/employees'

// ─── constants / helpers ───
const rupee = (p: number) => '₹' + Math.round(p / 100).toLocaleString('en-IN')
const fmtDate = (s: string) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return s
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

const JOB_STATUSES: JobStatus[] = ['open', 'on_hold', 'closed']
const EMPLOYMENT_TYPES: EmploymentType[] = ['full_time', 'part_time', 'contract', 'intern']
const SOURCES: CandidateSource[] = ['referral', 'job_board', 'website', 'agency', 'other']
const INTERVIEW_MODES: InterviewMode[] = ['in_person', 'phone', 'video']
const OFFER_STATUSES: OfferStatus[] = ['draft', 'sent', 'accepted', 'declined']
const OFFBOARD_TYPES: OffboardType[] = ['resignation', 'termination', 'retirement']

// pipeline stages in order (rejected handled separately)
const STAGES: { key: AppStage; label: string }[] = [
  { key: 'applied', label: 'Applied' },
  { key: 'screening', label: 'Screening' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Offer' },
  { key: 'hired', label: 'Hired' },
  { key: 'rejected', label: 'Rejected' },
]
const STAGE_LABEL: Record<AppStage, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
}
// order used by the move buttons (rejected is a terminal side-state)
const MOVE_ORDER: AppStage[] = ['applied', 'screening', 'interview', 'offer', 'hired']

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function jobTone(s: JobStatus): StatusTone {
  return s === 'open' ? 'green' : s === 'on_hold' ? 'amber' : 'gray'
}
function stageTone(s: AppStage): StatusTone {
  return s === 'hired' ? 'green' : s === 'rejected' ? 'rose' : s === 'offer' ? 'violet' : s === 'interview' ? 'blue' : s === 'screening' ? 'amber' : 'gray'
}
function interviewTone(r: InterviewResult): StatusTone {
  return r === 'pass' ? 'green' : r === 'fail' ? 'rose' : 'amber'
}
function offboardTone(s: OffboardStatus): StatusTone {
  return s === 'completed' ? 'green' : s === 'in_progress' ? 'amber' : 'blue'
}
function fnfTone(s: FnfStatus): StatusTone {
  return s === 'paid' ? 'green' : s === 'approved' ? 'blue' : 'gray'
}

const inputCls =
  'h-9 w-full rounded-lg border border-border bg-card px-2.5 text-[13px] outline-none transition-colors focus:border-ring'

type Tab = 'jobs' | 'pipeline' | 'candidates' | 'offboarding'

export default function Hiring() {
  const { firstTabActive } = useShell()
  const { activeWorkspace } = useAuth()
  const canManage =
    activeWorkspace?.role === 'Owner' || activeWorkspace?.role === 'Admin' || activeWorkspace?.role === 'Manager'
  const isOwnerAdmin = activeWorkspace?.role === 'Owner' || activeWorkspace?.role === 'Admin'

  const [tab, setTab] = useState<Tab>('jobs')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [paywall, setPaywall] = useState<Paywall | null>(null)
  useEffect(() => {
    listEmployees().then(setEmployees)
  }, [])

  const tabs = (
    <PageTabs
      tabs={[
        { key: 'jobs', label: 'Jobs' },
        { key: 'pipeline', label: 'Pipeline' },
        { key: 'candidates', label: 'Candidates' },
        { key: 'offboarding', label: 'Offboarding' },
      ]}
      active={tab}
      onChange={setTab}
    />
  )

  return (
    <>
      {tab === 'jobs' && (
        <JobsTab tabs={tabs} firstTabActive={firstTabActive} employees={employees} canManage={canManage} onPaywall={setPaywall} />
      )}
      {tab === 'pipeline' && (
        <PipelineTab tabs={tabs} firstTabActive={firstTabActive} employees={employees} canManage={canManage} />
      )}
      {tab === 'candidates' && (
        <CandidatesTab tabs={tabs} firstTabActive={firstTabActive} canManage={canManage} />
      )}
      {tab === 'offboarding' && (
        <OffboardingTab
          tabs={tabs}
          firstTabActive={firstTabActive}
          employees={employees}
          canManage={canManage}
          isOwnerAdmin={isOwnerAdmin}
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

// ─── Jobs tab ───
function JobsTab({
  tabs,
  firstTabActive,
  employees,
  canManage,
  onPaywall,
}: {
  tabs: ReactNode
  firstTabActive: boolean
  employees: Employee[]
  canManage: boolean
  onPaywall: (p: Paywall) => void
}) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getJobs()
      .then(setJobs)
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const openJob = jobs.find((j) => j.id === openId) ?? null

  // summary metrics computed from the loaded jobs list
  const metrics = useMemo(() => {
    const open = jobs.filter((j) => j.status === 'open')
    const openRoles = open.length
    const openPositions = open.reduce((s, j) => s + (j.openings || 0), 0)
    const applicants = jobs.reduce((s, j) => s + (j.applicantCount || 0), 0)
    const onHold = jobs.filter((j) => j.status === 'on_hold').length
    return { openRoles, openPositions, applicants, onHold }
  }, [jobs])

  const lv = useListView<Job>({
    rows: jobs,
    search: (j) => `${j.title} ${j.department}`,
    filters: [{ id: 'status', label: 'Status', get: (j) => titleCase(j.status) }],
    sorts: [
      { key: 'title', label: 'Title', get: (j) => j.title },
      { key: 'department', label: 'Department', get: (j) => j.department || '' },
      { key: 'status', label: 'Status', get: (j) => j.status },
    ],
  })

  const columns: GridColumn<Job>[] = [
    { id: 'title', title: 'Title', kind: 'text', width: 220, get: (j) => j.title },
    { id: 'department', title: 'Department', kind: 'text', width: 160, get: (j) => j.department || '—' },
    { id: 'type', title: 'Type', kind: 'text', width: 130, get: (j) => titleCase(j.employmentType) },
    { id: 'manager', title: 'Hiring manager', kind: 'person', width: 180, get: (j) => j.hiringManagerName || '—' },
    { id: 'openings', title: 'Openings', kind: 'number', width: 100, get: (j) => j.openings },
    { id: 'applicants', title: 'Applicants', kind: 'number', width: 110, get: (j) => j.applicantCount },
    {
      id: 'status',
      title: 'Status',
      kind: 'badge',
      width: 120,
      get: (j) => titleCase(j.status),
      badgeTone: (j) => jobTone(j.status) as BadgeTone,
    },
  ]

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
        {tabs}
        {/* summary metrics */}
        <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-border p-4 lg:grid-cols-4">
          <MetricCard label="Open roles" value={String(metrics.openRoles)} />
          <MetricCard label="Open positions" value={String(metrics.openPositions)} />
          <MetricCard label="Applicants" value={String(metrics.applicants)} />
          <MetricCard label="On hold" value={String(metrics.onHold)} />
        </div>
        <GridToolbar
          total={jobs.length}
          searchPlaceholder="Search jobs…"
          {...lv.toolbar}
          primaryAction={{ label: 'New job', onClick: () => setCreateOpen(true) }}
        />
        <div className="min-h-0 flex-1 border-t border-border">
          {loading ? (
            <div className="grid h-full place-items-center text-[13px] text-muted-foreground">Loading…</div>
          ) : (
            <DataGrid
              rows={lv.view}
              columns={columns}
              getRowId={(r) => r.id}
              onRowClick={(r) => setOpenId(r.id)}
              emptyMessage="No jobs yet."
            />
          )}
        </div>

        {createOpen && (
          <JobModal
            employees={employees}
            onClose={() => setCreateOpen(false)}
            onPaywall={(p) => {
              setCreateOpen(false)
              onPaywall(p)
            }}
            onDone={() => {
              setCreateOpen(false)
              load()
            }}
          />
        )}
      </Panel>
      <JobDetailPanel
        job={openJob}
        employees={employees}
        canManage={canManage}
        open={!!openId}
        onClose={() => setOpenId(null)}
        onChanged={load}
        onDeleted={() => {
          setOpenId(null)
          load()
        }}
      />
    </div>
  )
}

function JobModal({ employees, onClose, onDone, onPaywall }: { employees: Employee[]; onClose: () => void; onDone: () => void; onPaywall: (p: Paywall) => void }) {
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [location, setLocation] = useState('')
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full_time')
  const [openings, setOpenings] = useState('1')
  const [hiringManagerId, setHiringManagerId] = useState('')
  const [description, setDescription] = useState('')
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
      await createJob({
        title,
        department,
        location,
        employmentType,
        openings: Math.max(1, Number(openings) || 1),
        hiringManagerId: hiringManagerId || null,
        description,
      })
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
    <ModalShell title="New job" onClose={onClose}>
      <Field label="Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. Senior Engineer" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Department">
          <input value={department} onChange={(e) => setDepartment(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Location">
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Employment type">
          <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)} className={inputCls}>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Openings">
          <input type="number" min={1} value={openings} onChange={(e) => setOpenings(e.target.value)} className={inputCls} />
        </Field>
        <div className="col-span-2">
          <Field label="Hiring manager">
            <select value={hiringManagerId} onChange={(e) => setHiringManagerId(e.target.value)} className={inputCls}>
              <option value="">Unassigned</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={cn(inputCls, 'h-auto resize-none py-2')} />
          </Field>
        </div>
      </div>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Create" />
    </ModalShell>
  )
}

function JobDetailPanel({
  job,
  employees,
  canManage,
  open,
  onClose,
  onChanged,
  onDeleted,
}: {
  job: Job | null
  employees: Employee[]
  canManage: boolean
  open: boolean
  onClose: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)

  const patch = async (data: Parameters<typeof updateJob>[1]) => {
    if (!job) return
    setBusy(true)
    try {
      await updateJob(job.id, data)
      onChanged()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!job) return
    if (!confirm('Delete this job? Its applications, interviews and offers will be removed.')) return
    setBusy(true)
    try {
      await deleteJob(job.id)
      sound.success()
      onDeleted()
    } catch (e) {
      alert((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <DetailPanel
      open={open}
      onClose={onClose}
      width="w-80"
      icon={<Briefcase className="size-4" />}
      title={job?.title ?? 'Job'}
      subtitle={job ? titleCase(job.status) : undefined}
      footer={
        job ? (
          <>
            {canManage && (
              <button
                onClick={remove}
                disabled={busy}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
            )}
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
      {job ? (
        <div className="space-y-3">
          <Field label="Status">
            <select value={job.status} onChange={(e) => patch({ status: e.target.value as JobStatus })} disabled={busy} className={cn(inputCls, 'capitalize')}>
              {JOB_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Openings">
              <input
                key={`openings-${job.id}`}
                type="number"
                min={1}
                defaultValue={job.openings}
                onBlur={(e) => {
                  const v = Math.max(1, Number(e.target.value) || 1)
                  if (v !== job.openings) patch({ openings: v })
                }}
                disabled={busy}
                className={inputCls}
              />
            </Field>
            <Field label="Employment type">
              <select value={job.employmentType} onChange={(e) => patch({ employmentType: e.target.value as EmploymentType })} disabled={busy} className={inputCls}>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {titleCase(t)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Department">
            <input
              key={`dept-${job.id}`}
              defaultValue={job.department}
              onBlur={(e) => {
                if (e.target.value !== job.department) patch({ department: e.target.value })
              }}
              disabled={busy}
              className={inputCls}
            />
          </Field>
          <Field label="Location">
            <input
              key={`loc-${job.id}`}
              defaultValue={job.location}
              onBlur={(e) => {
                if (e.target.value !== job.location) patch({ location: e.target.value })
              }}
              disabled={busy}
              className={inputCls}
            />
          </Field>
          <Field label="Hiring manager">
            <select value={job.hiringManagerId ?? ''} onChange={(e) => patch({ hiringManagerId: e.target.value || null })} disabled={busy} className={inputCls}>
              <option value="">Unassigned</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <textarea
              key={`desc-${job.id}`}
              defaultValue={job.description}
              onBlur={(e) => {
                if (e.target.value !== job.description) patch({ description: e.target.value })
              }}
              disabled={busy}
              rows={3}
              className={cn(inputCls, 'h-auto resize-none py-2')}
            />
          </Field>
          <div className="space-y-2 border-t border-border pt-3">
            <DetailField label="Applicants">{String(job.applicantCount)}</DetailField>
            <DetailField label="Created">
              {new Date(job.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
            </DetailField>
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-[13px] text-muted-foreground">Loading…</div>
      )}
    </DetailPanel>
  )
}

// ─── Pipeline tab ───
function PipelineTab({
  tabs,
  firstTabActive,
  employees,
  canManage,
}: {
  tabs: ReactNode
  firstTabActive: boolean
  employees: Employee[]
  canManage: boolean
}) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobId, setJobId] = useState('')
  const [board, setBoard] = useState<ApplicationBoard | null>(null)
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<AppStage | null>(null)

  useEffect(() => {
    getJobs().then((js) => {
      setJobs(js)
      setJobId((prev) => prev || js[0]?.id || '')
    })
  }, [])
  useEffect(() => {
    getCandidates().then(setCandidates)
  }, [])

  const load = useCallback(() => {
    if (!jobId) {
      setBoard(null)
      return
    }
    setLoading(true)
    getApplicationBoard(jobId)
      .then(setBoard)
      .finally(() => setLoading(false))
  }, [jobId])
  useEffect(() => {
    load()
  }, [load])

  const allApps = board?.stages.flatMap((s) => s.applications) ?? []
  const openApp = allApps.find((a) => a.id === openId) ?? null

  const moveStage = async (app: Application, dir: -1 | 1) => {
    const idx = MOVE_ORDER.indexOf(app.stage)
    if (idx === -1) return
    const next = MOVE_ORDER[idx + dir]
    if (!next) return
    try {
      await updateApplication(app.id, { stage: next })
      load()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  // drag an application card between stage columns to change its stage
  const handleDropToColumn = async (id: string, newStage: AppStage) => {
    setDraggingId(null)
    setOverStage(null)
    if (!board) return
    const moved = board.stages.flatMap((s) => s.applications).find((a) => a.id === id)
    if (!moved || moved.stage === newStage) return
    const prev = board
    setBoard({
      ...board,
      stages: board.stages.map((s) => {
        let applications = s.applications.filter((a) => a.id !== id)
        if (s.stage === newStage) applications = [...applications, { ...moved, stage: newStage }]
        return { ...s, applications, count: applications.length }
      }),
    })
    try {
      await updateApplication(id, { stage: newStage })
      load() // reconcile counts/derived state
    } catch (e) {
      setBoard(prev)
      alert((e as Error).message)
    }
  }

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
        {tabs}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <select value={jobId} onChange={(e) => setJobId(e.target.value)} className={cn(inputCls, 'w-64')}>
          <option value="">Select a job…</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
        {jobId && (
          <button
            onClick={() => setAddOpen(true)}
            className="btn-3d ml-auto inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" /> Add candidate
          </button>
        )}
      </div>

      {!jobId ? (
        <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">Select a job to view its pipeline.</div>
      ) : loading ? (
        <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">Loading…</div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
          {(board?.stages ?? []).map((col) => (
            <div
              key={col.stage}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (overStage !== col.stage) setOverStage(col.stage)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node))
                  setOverStage((s) => (s === col.stage ? null : s))
              }}
              onDrop={(e) => {
                e.preventDefault()
                handleDropToColumn(e.dataTransfer.getData('text/plain'), col.stage)
              }}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30 transition-colors',
                overStage === col.stage && 'border-ring bg-muted/60 ring-2 ring-ring',
              )}
            >
              <div className="flex shrink-0 items-center justify-between gap-1 px-3 py-2.5">
                <StatusBadge tone={stageTone(col.stage)}>{STAGE_LABEL[col.stage]}</StatusBadge>
                <span className="text-[11px] tabular-nums text-muted-foreground">{col.count}</span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {col.applications.map((a) => (
                  <ApplicationCard
                    key={a.id}
                    app={a}
                    onClick={() => setOpenId(a.id)}
                    onMove={moveStage}
                    dragging={draggingId === a.id}
                    onDragStart={() => setDraggingId(a.id)}
                    onDragEnd={() => {
                      setDraggingId(null)
                      setOverStage(null)
                    }}
                  />
                ))}
                {col.applications.length === 0 && <div className="px-1 py-4 text-center text-[12px] text-muted-foreground">—</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <AddApplicationModal
          jobId={jobId}
          candidates={candidates}
          employees={employees}
          existing={allApps}
          onClose={() => setAddOpen(false)}
          onDone={() => {
            setAddOpen(false)
            load()
          }}
        />
      )}
      {openApp && (
        <ApplicationDrawer
          app={openApp}
          employees={employees}
          canManage={canManage}
          onClose={() => setOpenId(null)}
          onChanged={load}
          onDeleted={() => {
            setOpenId(null)
            load()
          }}
        />
      )}
      </Panel>
    </div>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('size-3.5', n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
      ))}
    </div>
  )
}

function ApplicationCard({
  app,
  onClick,
  onMove,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  app: Application
  onClick: () => void
  onMove: (a: Application, dir: -1 | 1) => void
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const idx = MOVE_ORDER.indexOf(app.stage)
  const canPrev = idx > 0
  const canNext = idx >= 0 && idx < MOVE_ORDER.length - 1
  return (
    <button
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', app.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'cursor-grab rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-ring active:cursor-grabbing',
        dragging && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium leading-snug">{app.candidateName}</div>
          {app.candidateEmail && <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{app.candidateEmail}</div>}
        </div>
        {app.ownerName && <EmployeeAvatar name={app.ownerName} className="size-5 shrink-0" />}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <Stars value={app.rating} />
        <div className="flex items-center gap-0.5">
          {canPrev && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onMove(app, -1)
              }}
              className="grid size-6 cursor-pointer place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" />
            </span>
          )}
          {canNext && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onMove(app, 1)
              }}
              className="grid size-6 cursor-pointer place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="size-3.5" />
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function AddApplicationModal({
  jobId,
  candidates,
  employees,
  existing,
  onClose,
  onDone,
}: {
  jobId: string
  candidates: Candidate[]
  employees: Employee[]
  existing: Application[]
  onClose: () => void
  onDone: () => void
}) {
  const [candidateId, setCandidateId] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const taken = new Set(existing.map((a) => a.candidateId))
  const available = candidates.filter((c) => !taken.has(c.id))

  const submit = async () => {
    if (!candidateId) {
      setError('Pick a candidate')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createApplication({ jobId, candidateId, ownerId: ownerId || null })
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Add candidate to pipeline" onClose={onClose}>
      <Field label="Candidate">
        <select value={candidateId} onChange={(e) => setCandidateId(e.target.value)} className={inputCls} autoFocus>
          <option value="">Select…</option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.email ? ` (${c.email})` : ''}
            </option>
          ))}
        </select>
      </Field>
      {available.length === 0 && <p className="text-[12px] text-muted-foreground">All candidates are already in this pipeline. Add new ones in the Candidates tab.</p>}
      <Field label="Recruiter (owner)">
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputCls}>
          <option value="">Unassigned</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </Field>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Add" />
    </ModalShell>
  )
}

function ApplicationDrawer({
  app,
  employees,
  canManage,
  onClose,
  onChanged,
  onDeleted,
}: {
  app: Application
  employees: Employee[]
  canManage: boolean
  onClose: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [loadingSub, setLoadingSub] = useState(true)

  const reload = useCallback(() => {
    setLoadingSub(true)
    Promise.all([getInterviews(app.id), getOffers(app.id)])
      .then(([iv, of]) => {
        setInterviews(iv)
        setOffers(of)
      })
      .finally(() => setLoadingSub(false))
  }, [app.id])
  useEffect(() => {
    reload()
  }, [reload])

  const patch = async (data: Parameters<typeof updateApplication>[1]) => {
    setBusy(true)
    try {
      await updateApplication(app.id, data)
      onChanged()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm('Remove this application from the pipeline?')) return
    setBusy(true)
    try {
      await deleteApplication(app.id)
      sound.success()
      onDeleted()
    } catch (e) {
      alert((e as Error).message)
      setBusy(false)
    }
  }

  const hire = async () => {
    if (!confirm('Hire this candidate? This creates a workspace employee from the candidate + offer.')) return
    setBusy(true)
    try {
      const r = await hireApplication(app.id)
      sound.success()
      alert(r.alreadyHired ? 'Already hired — employee exists.' : `Hired! New employee ${r.empCode ?? r.employeeId} created.`)
      onChanged()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const canHire = (app.stage === 'offer' || app.stage === 'hired') && !app.hiredEmployeeId

  // ── interview scheduler ──
  const [ivDate, setIvDate] = useState('')
  const [ivMode, setIvMode] = useState<InterviewMode>('in_person')
  const [ivInterviewer, setIvInterviewer] = useState('')
  const [savingIv, setSavingIv] = useState(false)
  const addInterview = async () => {
    setSavingIv(true)
    try {
      await createInterview(app.id, { scheduledAt: ivDate, mode: ivMode, interviewerId: ivInterviewer || null })
      setIvDate('')
      setIvInterviewer('')
      sound.success()
      reload()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSavingIv(false)
    }
  }

  // ── offer creator ──
  const [ctc, setCtc] = useState('')
  const [joining, setJoining] = useState('')
  const [savingOffer, setSavingOffer] = useState(false)
  const addOffer = async () => {
    const ctcPaise = Math.max(0, Math.round(Number(ctc) || 0)) * 100
    if (!ctcPaise) {
      alert('Enter an annual CTC')
      return
    }
    setSavingOffer(true)
    try {
      await createOffer(app.id, { ctcPaise, joiningDate: joining })
      setCtc('')
      setJoining('')
      sound.success()
      reload()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSavingOffer(false)
    }
  }

  return (
    <DrawerShell title={app.candidateName} subtitle={app.jobTitle} onClose={onClose} onDelete={canManage ? remove : undefined} busy={busy}>
      <div className="grid grid-cols-2 gap-3 border-b border-border p-5">
        <Field label="Stage">
          <select value={app.stage} onChange={(e) => patch({ stage: e.target.value as AppStage })} disabled={busy} className={inputCls}>
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Rating">
          <select value={app.rating} onChange={(e) => patch({ rating: Number(e.target.value) })} disabled={busy} className={inputCls}>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} ★
              </option>
            ))}
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="Recruiter (owner)">
            <select value={app.ownerId ?? ''} onChange={(e) => patch({ ownerId: e.target.value || null })} disabled={busy} className={inputCls}>
              <option value="">Unassigned</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {app.candidateEmail && (
          <div className="col-span-2 text-[12px] text-muted-foreground">{app.candidateEmail}</div>
        )}
        <div className="col-span-2">
          <Field label="Notes">
            <textarea
              defaultValue={app.notes}
              onBlur={(e) => {
                if (e.target.value !== app.notes) patch({ notes: e.target.value })
              }}
              disabled={busy}
              rows={2}
              className={cn(inputCls, 'h-auto resize-none py-2')}
            />
          </Field>
        </div>
        {canManage && (
          <div className="col-span-2">
            {app.hiredEmployeeId ? (
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[13px] font-medium text-emerald-700">
                <UserCheck className="size-4" /> Converted to employee
              </div>
            ) : (
              <button
                onClick={hire}
                disabled={busy || !canHire}
                title={canHire ? '' : 'Move to the Offer stage to hire'}
                className="btn-3d inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                <UserCheck className="size-4" /> Hire candidate
              </button>
            )}
          </div>
        )}
      </div>

      {/* offers */}
      <div className="border-b border-border p-5">
        <div className="mb-3 text-[12px] font-medium text-muted-foreground">Offers</div>
        <div className="mb-3 space-y-2 rounded-xl border border-border bg-muted/30 p-3">
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min={0} value={ctc} onChange={(e) => setCtc(e.target.value)} placeholder="Annual CTC (₹)" className={inputCls} />
            <input type="date" value={joining} onChange={(e) => setJoining(e.target.value)} className={inputCls} />
          </div>
          <div className="flex justify-end">
            <button
              onClick={addOffer}
              disabled={savingOffer}
              className="btn-3d inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-3 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-60"
            >
              {savingOffer ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Create offer
            </button>
          </div>
        </div>
        {loadingSub ? (
          <div className="py-2 text-center text-[13px] text-muted-foreground">Loading…</div>
        ) : offers.length === 0 ? (
          <div className="py-2 text-center text-[13px] text-muted-foreground">No offers yet.</div>
        ) : (
          <ul className="space-y-2">
            {offers.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <div>
                  <div className="text-[13px] font-medium tabular-nums">{rupee(o.ctcPaise)}/yr</div>
                  <div className="text-[12px] text-muted-foreground">Joins {fmtDate(o.joiningDate)}</div>
                </div>
                <select
                  value={o.status}
                  onChange={async (e) => {
                    try {
                      const upd = await updateOffer(o.id, { status: e.target.value as OfferStatus })
                      setOffers((prev) => prev.map((x) => (x.id === o.id ? upd : x)))
                    } catch (err) {
                      alert((err as Error).message)
                    }
                  }}
                  className={cn(inputCls, 'h-8 w-32')}
                >
                  {OFFER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {titleCase(s)}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* interviews */}
      <div className="p-5">
        <div className="mb-3 text-[12px] font-medium text-muted-foreground">Interviews</div>
        <div className="mb-3 space-y-2 rounded-xl border border-border bg-muted/30 p-3">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={ivDate} onChange={(e) => setIvDate(e.target.value)} className={inputCls} />
            <select value={ivMode} onChange={(e) => setIvMode(e.target.value as InterviewMode)} className={inputCls}>
              {INTERVIEW_MODES.map((m) => (
                <option key={m} value={m}>
                  {titleCase(m)}
                </option>
              ))}
            </select>
          </div>
          <select value={ivInterviewer} onChange={(e) => setIvInterviewer(e.target.value)} className={inputCls}>
            <option value="">Interviewer…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <div className="flex justify-end">
            <button
              onClick={addInterview}
              disabled={savingIv}
              className="btn-3d inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-3 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-60"
            >
              {savingIv ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Schedule
            </button>
          </div>
        </div>
        {loadingSub ? (
          <div className="py-2 text-center text-[13px] text-muted-foreground">Loading…</div>
        ) : interviews.length === 0 ? (
          <div className="py-2 text-center text-[13px] text-muted-foreground">No interviews scheduled.</div>
        ) : (
          <ul className="space-y-2">
            {interviews.map((iv) => (
              <li key={iv.id} className="rounded-lg border border-border bg-card px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                    <Calendar className="size-3" /> {fmtDate(iv.scheduledAt)} · {titleCase(iv.mode)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={iv.result}
                      onChange={async (e) => {
                        try {
                          const upd = await updateInterview(iv.id, { result: e.target.value as InterviewResult })
                          setInterviews((prev) => prev.map((x) => (x.id === iv.id ? upd : x)))
                        } catch (err) {
                          alert((err as Error).message)
                        }
                      }}
                      className={cn(inputCls, 'h-7 w-24 text-[12px]')}
                    >
                      <option value="pending">Pending</option>
                      <option value="pass">Pass</option>
                      <option value="fail">Fail</option>
                    </select>
                    {canManage && (
                      <button
                        onClick={async () => {
                          try {
                            await deleteInterview(iv.id)
                            setInterviews((prev) => prev.filter((x) => x.id !== iv.id))
                          } catch (err) {
                            alert((err as Error).message)
                          }
                        }}
                        aria-label="Delete interview"
                        className="grid size-6 cursor-pointer place-items-center rounded text-muted-foreground hover:text-rose-600"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {iv.interviewerName && <div className="mt-1 text-[12px] text-muted-foreground">Interviewer: {iv.interviewerName}</div>}
                <textarea
                  defaultValue={iv.feedback}
                  onBlur={async (e) => {
                    if (e.target.value !== iv.feedback) {
                      try {
                        await updateInterview(iv.id, { feedback: e.target.value })
                      } catch (err) {
                        alert((err as Error).message)
                      }
                    }
                  }}
                  placeholder="Feedback…"
                  rows={1}
                  className={cn(inputCls, 'mt-2 h-auto resize-none py-1.5 text-[12px]')}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {interviews.map((iv) => (
            <StatusBadge key={`b-${iv.id}`} tone={interviewTone(iv.result)}>
              {titleCase(iv.result)}
            </StatusBadge>
          ))}
        </div>
      </div>
    </DrawerShell>
  )
}

// ─── Candidates tab ───
function CandidatesTab({
  tabs,
  firstTabActive,
  canManage,
}: {
  tabs: ReactNode
  firstTabActive: boolean
  canManage: boolean
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ candidate: Candidate | null } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getCandidates()
      .then(setCandidates)
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const lv = useListView<Candidate>({
    rows: candidates,
    search: (c) => `${c.name} ${c.email ?? ''}`,
    filters: [{ id: 'source', label: 'Source', get: (c) => (c.source ? titleCase(c.source) : '') }],
    sorts: [
      { key: 'name', label: 'Name', get: (c) => c.name },
      { key: 'email', label: 'Email', get: (c) => c.email ?? '' },
    ],
  })

  const columns: GridColumn<Candidate>[] = [
    { id: 'name', title: 'Name', kind: 'person', width: 220, get: (c) => c.name },
    { id: 'email', title: 'Email', kind: 'text', width: 240, get: (c) => c.email || '—' },
    { id: 'phone', title: 'Phone', kind: 'text', width: 150, get: (c) => c.phone || '—' },
    { id: 'source', title: 'Source', kind: 'text', width: 140, get: (c) => (c.source ? titleCase(c.source) : '—') },
  ]

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
        {tabs}
        <GridToolbar
          total={candidates.length}
          searchPlaceholder="Search candidates…"
          {...lv.toolbar}
          primaryAction={{ label: 'New candidate', onClick: () => setModal({ candidate: null }) }}
        />
        <div className="min-h-0 flex-1 border-t border-border">
          {loading ? (
            <div className="grid h-full place-items-center text-[13px] text-muted-foreground">Loading…</div>
          ) : (
            <DataGrid
              rows={lv.view}
              columns={columns}
              getRowId={(r) => r.id}
              onRowClick={(r) => setModal({ candidate: r })}
              emptyMessage="No candidates yet."
            />
          )}
        </div>

        {modal && (
          <CandidateModal
            candidate={modal.candidate}
            canManage={canManage}
            onClose={() => setModal(null)}
            onDone={() => {
              setModal(null)
              load()
            }}
          />
        )}
      </Panel>
    </div>
  )
}

function CandidateModal({
  candidate,
  canManage,
  onClose,
  onDone,
}: {
  candidate: Candidate | null
  canManage: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [name, setName] = useState(candidate?.name ?? '')
  const [email, setEmail] = useState(candidate?.email ?? '')
  const [phone, setPhone] = useState(candidate?.phone ?? '')
  const [resumeUrl, setResumeUrl] = useState(candidate?.resumeUrl ?? '')
  const [source, setSource] = useState<CandidateSource>(candidate?.source ?? '')
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
      const payload = { name, email, phone, resumeUrl, source }
      if (candidate) await updateCandidate(candidate.id, payload)
      else await createCandidate(payload)
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!candidate || !confirm('Delete this candidate? Their applications will be removed.')) return
    setBusy(true)
    try {
      await deleteCandidate(candidate.id)
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title={candidate ? 'Edit candidate' : 'New candidate'} onClose={onClose}>
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Source">
          <select value={source} onChange={(e) => setSource(e.target.value as CandidateSource)} className={inputCls}>
            <option value="">—</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="Resume URL">
            <input value={resumeUrl} onChange={(e) => setResumeUrl(e.target.value)} className={inputCls} placeholder="https://" />
          </Field>
        </div>
      </div>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label={candidate ? 'Save' : 'Create'} onDelete={candidate && canManage ? remove : undefined} />
    </ModalShell>
  )
}

// ─── Offboarding tab ───
function OffboardingTab({
  tabs,
  firstTabActive,
  employees,
  canManage,
  isOwnerAdmin,
}: {
  tabs: ReactNode
  firstTabActive: boolean
  employees: Employee[]
  canManage: boolean
  isOwnerAdmin: boolean
}) {
  const [rows, setRows] = useState<Offboarding[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getOffboardings()
      .then(setRows)
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const lv = useListView<Offboarding>({
    rows,
    search: (r) => r.employeeName ?? '',
    filters: [{ id: 'status', label: 'Status', get: (r) => titleCase(r.status) }],
    sorts: [
      { key: 'employee', label: 'Employee', get: (r) => r.employeeName ?? '' },
      { key: 'type', label: 'Type', get: (r) => titleCase(r.type) },
      { key: 'lwd', label: 'Last working day', get: (r) => r.lastWorkingDay ?? '' },
    ],
  })

  const columns: GridColumn<Offboarding>[] = [
    { id: 'employee', title: 'Employee', kind: 'person', width: 220, get: (r) => r.employeeName || '—' },
    { id: 'type', title: 'Type', kind: 'text', width: 150, get: (r) => titleCase(r.type) },
    { id: 'lwd', title: 'Last working day', kind: 'date', width: 160, get: (r) => r.lastWorkingDay },
    {
      id: 'status',
      title: 'Status',
      kind: 'badge',
      width: 140,
      get: (r) => titleCase(r.status),
      badgeTone: (r) => offboardTone(r.status) as BadgeTone,
    },
  ]

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
        {tabs}
        <GridToolbar
          total={rows.length}
          searchPlaceholder="Search employee…"
          {...lv.toolbar}
          primaryAction={{ label: 'New exit', onClick: () => setCreateOpen(true) }}
        />
        <div className="min-h-0 flex-1 border-t border-border">
          {loading ? (
            <div className="grid h-full place-items-center text-[13px] text-muted-foreground">Loading…</div>
          ) : (
            <DataGrid
              rows={lv.view}
              columns={columns}
              getRowId={(r) => r.id}
              onRowClick={(r) => setOpenId(r.id)}
              emptyMessage="No exits recorded."
            />
          )}
        </div>

        {createOpen && (
          <ExitModal
            employees={employees}
            onClose={() => setCreateOpen(false)}
            onDone={() => {
              setCreateOpen(false)
              load()
            }}
          />
        )}
      </Panel>
      <OffboardingDetailPanel
        offboardingId={openId}
        open={!!openId}
        canManage={canManage}
        isOwnerAdmin={isOwnerAdmin}
        onClose={() => setOpenId(null)}
        onChanged={load}
        onDeleted={() => {
          setOpenId(null)
          load()
        }}
      />
    </div>
  )
}

function ExitModal({ employees, onClose, onDone }: { employees: Employee[]; onClose: () => void; onDone: () => void }) {
  const [employeeId, setEmployeeId] = useState('')
  const [type, setType] = useState<OffboardType>('resignation')
  const [reason, setReason] = useState('')
  const [noticeDate, setNoticeDate] = useState('')
  const [lastWorkingDay, setLastWorkingDay] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!employeeId) {
      setError('Pick an employee')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createOffboarding({ employeeId, type, reason, noticeDate, lastWorkingDay })
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title="New exit" onClose={onClose}>
      <Field label="Employee">
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputCls} autoFocus>
          <option value="">Select…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value as OffboardType)} className={inputCls}>
            {OFFBOARD_TYPES.map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notice date">
          <input type="date" value={noticeDate} onChange={(e) => setNoticeDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Last working day">
          <input type="date" value={lastWorkingDay} onChange={(e) => setLastWorkingDay(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Field label="Reason">
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={cn(inputCls, 'h-auto resize-none py-2')} />
      </Field>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Create" />
    </ModalShell>
  )
}

// FnF worksheet rows (edited in rupees for usability; converted to paise on save)
const FNF_EARNINGS: { key: keyof FnfFields; label: string }[] = [
  { key: 'unpaidSalaryPaise', label: 'Unpaid salary' },
  { key: 'leaveEncashPaise', label: 'Leave encashment' },
  { key: 'bonusIncentivePaise', label: 'Bonus / incentives' },
  { key: 'gratuityPaise', label: 'Gratuity' },
  { key: 'otherEarningsPaise', label: 'Other earnings' },
]
const FNF_DEDUCTIONS: { key: keyof FnfFields; label: string }[] = [
  { key: 'ptPaise', label: 'Professional tax' },
  { key: 'tdsPaise', label: 'TDS' },
  { key: 'loanRecoveryPaise', label: 'Loan / advance recovery' },
  { key: 'noticeShortfallPaise', label: 'Notice shortfall' },
  { key: 'otherDeductionsPaise', label: 'Other deductions' },
]
interface FnfFields {
  unpaidSalaryPaise: number
  leaveEncashPaise: number
  bonusIncentivePaise: number
  gratuityPaise: number
  otherEarningsPaise: number
  ptPaise: number
  tdsPaise: number
  loanRecoveryPaise: number
  noticeShortfallPaise: number
  otherDeductionsPaise: number
}
const ZERO_FNF: FnfFields = {
  unpaidSalaryPaise: 0,
  leaveEncashPaise: 0,
  bonusIncentivePaise: 0,
  gratuityPaise: 0,
  otherEarningsPaise: 0,
  ptPaise: 0,
  tdsPaise: 0,
  loanRecoveryPaise: 0,
  noticeShortfallPaise: 0,
  otherDeductionsPaise: 0,
}

function OffboardingDetailPanel({
  offboardingId,
  open,
  canManage,
  isOwnerAdmin,
  onClose,
  onChanged,
  onDeleted,
}: {
  offboardingId: string | null
  open: boolean
  canManage: boolean
  isOwnerAdmin: boolean
  onClose: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const [detail, setDetail] = useState<OffboardingDetail | null>(null)
  const [busy, setBusy] = useState(false)
  // FnF worksheet fields, held in PAISE
  const [fields, setFields] = useState<FnfFields>(ZERO_FNF)
  const [note, setNote] = useState('')

  const reload = useCallback(() => {
    if (!offboardingId) {
      setDetail(null)
      return
    }
    getOffboarding(offboardingId).then((d) => {
      setDetail(d)
      if (d.fnf) {
        setFields({
          unpaidSalaryPaise: d.fnf.unpaidSalaryPaise,
          leaveEncashPaise: d.fnf.leaveEncashPaise,
          bonusIncentivePaise: d.fnf.bonusIncentivePaise,
          gratuityPaise: d.fnf.gratuityPaise,
          otherEarningsPaise: d.fnf.otherEarningsPaise,
          ptPaise: d.fnf.ptPaise,
          tdsPaise: d.fnf.tdsPaise,
          loanRecoveryPaise: d.fnf.loanRecoveryPaise,
          noticeShortfallPaise: d.fnf.noticeShortfallPaise,
          otherDeductionsPaise: d.fnf.otherDeductionsPaise,
        })
        setNote(d.fnf.note)
      }
    })
  }, [offboardingId])
  useEffect(() => {
    reload()
  }, [reload])

  const fnf = detail?.fnf ?? null
  const locked = fnf ? fnf.status !== 'draft' : false

  const earnings = FNF_EARNINGS.reduce((s, r) => s + fields[r.key], 0)
  const deductions = FNF_DEDUCTIONS.reduce((s, r) => s + fields[r.key], 0)
  const net = earnings - deductions

  const setField = (key: keyof FnfFields, rupees: string) => {
    setFields((prev) => ({ ...prev, [key]: Math.max(0, Math.round(Number(rupees) || 0)) * 100 }))
  }

  const suggest = async () => {
    if (!offboardingId) return
    setBusy(true)
    try {
      const s = await suggestFnf(offboardingId)
      setFields({
        unpaidSalaryPaise: s.unpaidSalaryPaise,
        leaveEncashPaise: s.leaveEncashPaise,
        bonusIncentivePaise: s.bonusIncentivePaise,
        gratuityPaise: s.gratuityPaise,
        otherEarningsPaise: s.otherEarningsPaise,
        ptPaise: s.ptPaise,
        tdsPaise: s.tdsPaise,
        loanRecoveryPaise: s.loanRecoveryPaise,
        noticeShortfallPaise: s.noticeShortfallPaise,
        otherDeductionsPaise: s.otherDeductionsPaise,
      })
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!offboardingId) return
    setBusy(true)
    try {
      await saveFnf(offboardingId, { ...fields, note })
      sound.success()
      reload()
      onChanged()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const doApprove = async () => {
    if (!fnf) return
    setBusy(true)
    try {
      await approveFnf(fnf.id)
      sound.success()
      reload()
      onChanged()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const doMarkPaid = async () => {
    if (!fnf) return
    setBusy(true)
    try {
      await markFnfPaid(fnf.id)
      sound.success()
      reload()
      onChanged()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!offboardingId) return
    if (!confirm('Delete this exit and its settlement?')) return
    setBusy(true)
    try {
      await deleteOffboarding(offboardingId)
      sound.success()
      onDeleted()
    } catch (e) {
      alert((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <DetailPanel
      open={open}
      onClose={onClose}
      width="w-80"
      avatar={{ name: detail?.employeeName ?? '' }}
      title={detail?.employeeName || 'Exit'}
      subtitle={detail ? `${titleCase(detail.type)} · ${titleCase(detail.status)}` : undefined}
      footer={
        detail ? (
          <>
            {canManage && (
              <button
                onClick={remove}
                disabled={busy}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
            )}
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
      {!detail ? (
        <div className="py-6 text-center text-[13px] text-muted-foreground">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Type">
              <select
                value={detail.type}
                onChange={async (e) => {
                  await updateOffboarding(offboardingId!, { type: e.target.value as OffboardType })
                  reload()
                  onChanged()
                }}
                disabled={busy}
                className={inputCls}
              >
                {OFFBOARD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {titleCase(t)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={detail.status}
                onChange={async (e) => {
                  await updateOffboarding(offboardingId!, { status: e.target.value as OffboardStatus })
                  reload()
                  onChanged()
                }}
                disabled={busy}
                className={inputCls}
              >
                <option value="initiated">Initiated</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
            <Field label="Notice date">
              <input
                key={`nd-${offboardingId}`}
                type="date"
                defaultValue={detail.noticeDate}
                onBlur={async (e) => {
                  if (e.target.value !== detail.noticeDate) {
                    await updateOffboarding(offboardingId!, { noticeDate: e.target.value })
                    reload()
                  }
                }}
                disabled={busy}
                className={inputCls}
              />
            </Field>
            <Field label="Last working day">
              <input
                key={`lwd-${offboardingId}`}
                type="date"
                defaultValue={detail.lastWorkingDay}
                onBlur={async (e) => {
                  if (e.target.value !== detail.lastWorkingDay) {
                    await updateOffboarding(offboardingId!, { lastWorkingDay: e.target.value })
                    reload()
                  }
                }}
                disabled={busy}
                className={inputCls}
              />
            </Field>
            {detail.reason && <div className="col-span-2 text-[12px] text-muted-foreground">{detail.reason}</div>}
          </div>

          {/* FnF worksheet */}
          <div className="mt-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
                Full &amp; Final settlement
                {fnf && <StatusBadge tone={fnfTone(fnf.status)}>{titleCase(fnf.status)}</StatusBadge>}
              </div>
              {!locked && (
                <button
                  onClick={suggest}
                  disabled={busy}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12px] font-medium hover:bg-muted disabled:opacity-60"
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} Suggest
                </button>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
              <div>
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-emerald-700">Earnings</div>
                <div className="space-y-1.5">
                  {FNF_EARNINGS.map((r) => (
                    <FnfRow key={r.key} label={r.label} paise={fields[r.key]} disabled={locked} onChange={(v) => setField(r.key, v)} />
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-rose-700">Deductions</div>
                <div className="space-y-1.5">
                  {FNF_DEDUCTIONS.map((r) => (
                    <FnfRow key={r.key} label={r.label} paise={fields[r.key]} disabled={locked} onChange={(v) => setField(r.key, v)} />
                  ))}
                </div>
              </div>
              <div className="space-y-1 border-t border-border pt-2 text-[13px]">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Total earnings</span>
                  <span className="tabular-nums">{rupee(earnings)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Total deductions</span>
                  <span className="tabular-nums">−{rupee(deductions)}</span>
                </div>
                <div className="flex items-center justify-between text-[15px] font-semibold">
                  <span>Net payable</span>
                  <span className={cn('tabular-nums', net >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{rupee(net)}</span>
                </div>
              </div>
              {!locked && (
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Settlement note…" className={cn(inputCls, 'h-auto resize-none py-2')} />
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!locked && (
                <button
                  onClick={save}
                  disabled={busy}
                  className="btn-3d inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} Save draft
                </button>
              )}
              {isOwnerAdmin && fnf && fnf.status === 'draft' && (
                <button
                  onClick={doApprove}
                  disabled={busy}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-[13px] font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                >
                  Approve
                </button>
              )}
              {isOwnerAdmin && fnf && fnf.status === 'approved' && (
                <button
                  onClick={doMarkPaid}
                  disabled={busy}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-[13px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                >
                  Mark paid
                </button>
              )}
            </div>
            {fnf && fnf.status === 'paid' && <p className="mt-2 text-[12px] text-emerald-700">Settlement paid — exit completed.</p>}
          </div>
        </>
      )}
    </DetailPanel>
  )
}

function FnfRow({ label, paise, disabled, onChange }: { label: string; paise: number; disabled: boolean; onChange: (rupees: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-foreground/80">{label}</span>
      <div className="relative w-36">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">₹</span>
        <input
          type="number"
          min={0}
          value={paise ? Math.round(paise / 100) : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="0"
          className={cn(inputCls, 'h-8 pl-6 text-right tabular-nums disabled:opacity-60')}
        />
      </div>
    </label>
  )
}

// ─── shared UI primitives ───
function DrawerShell({
  title,
  subtitle,
  titleOnBlur,
  onClose,
  onDelete,
  busy,
  children,
}: {
  title: string
  subtitle?: string
  titleOnBlur?: (v: string) => void
  onClose: () => void
  onDelete?: () => void
  busy: boolean
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col border-l border-border bg-background shadow-2xl duration-200 animate-in slide-in-from-right">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            {titleOnBlur ? (
              <input
                defaultValue={title}
                onBlur={(e) => titleOnBlur(e.target.value.trim())}
                className="w-full bg-transparent text-[15px] font-semibold tracking-tight outline-none"
              />
            ) : (
              <div className="truncate text-[15px] font-semibold tracking-tight">{title}</div>
            )}
            {subtitle && <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-1">
            {onDelete && (
              <button
                onClick={onDelete}
                disabled={busy}
                aria-label="Delete"
                className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                <Trash2 className="size-4" />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
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
  onDelete,
}: {
  busy: boolean
  onClose: () => void
  onSubmit: () => void
  label: string
  onDelete?: () => void
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      {onDelete && (
        <button
          onClick={onDelete}
          disabled={busy}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
        >
          <Trash2 className="size-4" /> Delete
        </button>
      )}
      <button onClick={onClose} className="ml-auto h-9 cursor-pointer rounded-lg border border-border bg-card px-4 text-[13px] font-medium hover:bg-muted">
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
