import { useEffect, useState } from 'react'
import { Plus, X, Loader2, Target, Star, MessageSquareQuote, CheckCircle2 } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import PageTabs from '@/components/admin/PageTabs'
import { sound } from '@/lib/sound'
import {
  getMyPerformance,
  createObjective,
  addKeyResult,
  updateKeyResult,
  submitReview,
  acknowledgeReview,
  type MyPerformancePayload,
  type KeyResult,
  type Review,
  type Feedback,
} from '@/lib/api'
import { Loading, EmptyState, PrimaryButton, GhostButton, Field, inputCls, StatusPill, fmtDateTime } from './ui'

type Tab = 'objectives' | 'reviews' | 'feedback'

export default function Performance() {
  const [tab, setTab] = useState<Tab>('objectives')
  const [data, setData] = useState<MyPerformancePayload | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    getMyPerformance()
      .then(setData)
      .catch(() => setData({ objectives: [], reviewsToFill: [], reviewsAboutMe: [], feedback: [] }))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  return (
    <Panel className="flex min-w-0 flex-1 flex-col">
      <PageTabs
        tabs={[
          { key: 'objectives', label: 'Objectives' },
          { key: 'reviews', label: 'Reviews' },
          { key: 'feedback', label: 'Feedback' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {loading || !data ? (
        <Loading />
      ) : tab === 'objectives' ? (
        <Objectives data={data} reload={load} />
      ) : tab === 'reviews' ? (
        <Reviews data={data} reload={load} />
      ) : (
        <FeedbackList feedback={data.feedback} />
      )}
    </Panel>
  )
}

function Objectives({ data, reload }: { data: MyPerformancePayload; reload: () => void }) {
  const [createOpen, setCreateOpen] = useState(false)
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="text-[13px] text-muted-foreground">{data.objectives.length} objective{data.objectives.length !== 1 && 's'}</span>
        <PrimaryButton onClick={() => setCreateOpen(true)} className="h-8 px-3 text-[12px]">
          <Plus className="size-3.5" /> New objective
        </PrimaryButton>
      </div>
      {data.objectives.length === 0 ? (
        <EmptyState icon={<Target className="size-6 opacity-40" />}>No objectives yet.</EmptyState>
      ) : (
        <div className="space-y-3 p-5">
          {data.objectives.map((o) => (
            <ObjectiveCard key={o.id} objective={o} reload={reload} />
          ))}
        </div>
      )}
      {createOpen && (
        <CreateObjectiveModal
          onClose={() => setCreateOpen(false)}
          onDone={() => {
            setCreateOpen(false)
            reload()
          }}
        />
      )}
    </div>
  )
}

function ObjectiveCard({ objective, reload }: { objective: MyPerformancePayload['objectives'][number]; reload: () => void }) {
  const [addOpen, setAddOpen] = useState(false)
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold">{objective.title}</span>
            <StatusPill status={objective.status} />
          </div>
          {objective.period && <div className="text-[12px] text-muted-foreground">{objective.period}</div>}
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold tabular-nums">{objective.progress}%</div>
          <div className="text-[11px] text-muted-foreground">progress</div>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-[#2f63d8]" style={{ width: `${objective.progress}%` }} />
      </div>

      <div className="mt-3 space-y-2">
        {objective.keyResults.map((kr) => (
          <KeyResultRow key={kr.id} kr={kr} reload={reload} />
        ))}
        {addOpen ? (
          <AddKeyResult objectiveId={objective.id} onClose={() => setAddOpen(false)} onDone={() => { setAddOpen(false); reload() }} />
        ) : (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="size-3.5" /> Add key result
          </button>
        )}
      </div>
    </div>
  )
}

function KeyResultRow({ kr, reload }: { kr: KeyResult; reload: () => void }) {
  const [value, setValue] = useState(String(kr.currentValue))
  const [busy, setBusy] = useState(false)
  const dirty = value !== String(kr.currentValue)

  const save = async () => {
    setBusy(true)
    try {
      await updateKeyResult(kr.id, { currentValue: Number(value) })
      sound.success()
      reload()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[13px]">{kr.title}</div>
        <div className="text-[11px] text-muted-foreground">
          {kr.currentValue} / {kr.targetValue} · {kr.progress}%
        </div>
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-20 rounded-lg border border-border bg-card px-2 text-[13px] outline-none focus:border-ring"
      />
      <GhostButton onClick={save} disabled={busy || !dirty} className="h-8 px-3 text-[12px]">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : 'Update'}
      </GhostButton>
    </div>
  )
}

function AddKeyResult({ objectiveId, onClose, onDone }: { objectiveId: string; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('100')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!title.trim()) return
    setBusy(true)
    try {
      await addKeyResult(objectiveId, { title: title.trim(), metricType: 'number', startValue: 0, targetValue: Number(target) || 100, currentValue: 0 })
      sound.success()
      onDone()
    } catch (e) {
      alert((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Key result" className="h-8 flex-1 rounded-lg border border-border bg-card px-2 text-[13px] outline-none focus:border-ring" />
      <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target" className="h-8 w-20 rounded-lg border border-border bg-card px-2 text-[13px] outline-none focus:border-ring" />
      <GhostButton onClick={save} disabled={busy} className="h-8 px-3 text-[12px]">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : 'Add'}
      </GhostButton>
      <button onClick={onClose} className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted">
        <X className="size-3.5" />
      </button>
    </div>
  )
}

function CreateObjectiveModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [period, setPeriod] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!title.trim()) {
      setError('Enter a title')
      return
    }
    setBusy(true)
    setError('')
    try {
      // ownerId omitted → server sets the caller's own employee as owner
      await createObjective({ title: title.trim(), description, period, status: 'active' })
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl duration-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">New objective</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} /></Field>
          <Field label="Description (optional)"><input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} /></Field>
          <Field label="Period (optional)"><input value={period} onChange={(e) => setPeriod(e.target.value)} className={inputCls} placeholder="e.g. 2026-Q2" /></Field>
          {error && <p className="text-[13px] text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <GhostButton onClick={onClose}>Cancel</GhostButton>
            <PrimaryButton onClick={submit} disabled={busy}>
              {busy && <Loader2 className="size-3.5 animate-spin" />} Create
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}

function Reviews({ data, reload }: { data: MyPerformancePayload; reload: () => void }) {
  const [fillTarget, setFillTarget] = useState<Review | null>(null)
  const [busy, setBusy] = useState('')

  const ack = async (id: string) => {
    setBusy(id)
    try {
      await acknowledgeReview(id)
      sound.success()
      reload()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  const pending = data.reviewsToFill.filter((r) => r.status === 'pending')
  const submittedByMe = data.reviewsToFill.filter((r) => r.status !== 'pending')

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {data.reviewsToFill.length === 0 && data.reviewsAboutMe.length === 0 ? (
        <EmptyState icon={<Star className="size-6 opacity-40" />}>No reviews assigned to you.</EmptyState>
      ) : (
        <div className="space-y-6 p-5">
          {/* reviews to fill */}
          <div>
            <h2 className="mb-2 text-[13px] font-semibold">To fill ({pending.length})</h2>
            {pending.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Nothing to fill right now.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {pending.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium">
                        {r.type === 'self' ? 'Self review' : `Review of ${r.employeeName}`}
                      </div>
                      <div className="text-[12px] text-muted-foreground">{r.cycleName}</div>
                    </div>
                    <PrimaryButton onClick={() => setFillTarget(r)} className="h-8 px-3 text-[12px]">Fill</PrimaryButton>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {submittedByMe.length > 0 && (
            <div>
              <h2 className="mb-2 text-[13px] font-semibold">Submitted by me</h2>
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {submittedByMe.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium">{r.type === 'self' ? 'Self review' : `Review of ${r.employeeName}`}</div>
                      <div className="text-[12px] text-muted-foreground">{r.cycleName} · rated {r.overallRating ?? '—'}/5</div>
                    </div>
                    <StatusPill status={r.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* reviews about me */}
          <div>
            <h2 className="mb-2 text-[13px] font-semibold">About me</h2>
            {data.reviewsAboutMe.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No reviews about you yet.</p>
            ) : (
              <ul className="space-y-3">
                {data.reviewsAboutMe.map((r) => (
                  <li key={r.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[13px] font-medium">
                        {r.cycleName} · by {r.reviewerName}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[13px] font-semibold">
                          <Star className="size-3.5 text-amber-500" /> {r.overallRating ?? '—'}/5
                        </span>
                        <StatusPill status={r.status} />
                      </div>
                    </div>
                    {r.strengths && <p className="mt-2 text-[12px] text-muted-foreground"><span className="font-medium text-foreground">Strengths:</span> {r.strengths}</p>}
                    {r.improvements && <p className="mt-1 text-[12px] text-muted-foreground"><span className="font-medium text-foreground">Improvements:</span> {r.improvements}</p>}
                    {r.comments && <p className="mt-1 text-[12px] text-muted-foreground">{r.comments}</p>}
                    {r.status === 'submitted' && (
                      <div className="mt-3">
                        <PrimaryButton onClick={() => ack(r.id)} disabled={busy === r.id} className="h-8 px-3 text-[12px]">
                          {busy === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} Acknowledge
                        </PrimaryButton>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {fillTarget && (
        <FillReviewModal
          review={fillTarget}
          onClose={() => setFillTarget(null)}
          onDone={() => {
            setFillTarget(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function FillReviewModal({ review, onClose, onDone }: { review: Review; onClose: () => void; onDone: () => void }) {
  const [rating, setRating] = useState(4)
  const [strengths, setStrengths] = useState('')
  const [improvements, setImprovements] = useState('')
  const [comments, setComments] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await submitReview(review.id, { overallRating: rating, strengths, improvements, comments })
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl duration-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {review.type === 'self' ? 'Self review' : `Review of ${review.employeeName}`}
          </h2>
          <button onClick={onClose} aria-label="Close" className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <Field label="Overall rating">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} className="cursor-pointer">
                  <Star className={`size-6 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
                </button>
              ))}
            </div>
          </Field>
          <Field label="Strengths"><textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={2} className={inputCls + ' h-auto py-2'} /></Field>
          <Field label="Improvements"><textarea value={improvements} onChange={(e) => setImprovements(e.target.value)} rows={2} className={inputCls + ' h-auto py-2'} /></Field>
          <Field label="Comments"><textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} className={inputCls + ' h-auto py-2'} /></Field>
          {error && <p className="text-[13px] text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <GhostButton onClick={onClose}>Cancel</GhostButton>
            <PrimaryButton onClick={submit} disabled={busy}>
              {busy && <Loader2 className="size-3.5 animate-spin" />} Submit review
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeedbackList({ feedback }: { feedback: Feedback[] }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {feedback.length === 0 ? (
        <EmptyState icon={<MessageSquareQuote className="size-6 opacity-40" />}>No feedback addressed to you yet.</EmptyState>
      ) : (
        <ul className="space-y-3 p-5">
          {feedback.map((f) => (
            <li key={f.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium">{f.fromName}</span>
                <StatusPill status={f.kind} />
              </div>
              <p className="mt-1.5 text-[13px] text-foreground">{f.body}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{fmtDateTime(f.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
