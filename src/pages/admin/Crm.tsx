import { useCallback, useEffect, useState } from 'react'
import { Loader2, X, Plus, Trash2, Calendar, Check } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import PageTabs from '@/components/admin/PageTabs'
import { EmployeeAvatar } from '@/lib/people'
import StatusBadge, { type StatusTone } from '@/components/admin/StatusBadge'
import DataGrid, { type GridColumn } from '@/components/admin/DataGrid'
import GridToolbar from '@/components/admin/GridToolbar'
import { useListView } from '@/lib/useListView'
import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import {
  listEmployees,
  getPipeline,
  getContacts,
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  createContact,
  updateContact,
  deleteContact,
  createDeal,
  updateDeal,
  deleteDeal,
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  type Company,
  type Contact,
  type Deal,
  type DealStage,
  type DealSource,
  type Activity,
  type ActivityType,
  type Pipeline,
} from '@/lib/api'
import { type Employee } from '@/lib/employees'

// ─── shared constants / helpers ───
const STAGES: { key: DealStage; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'proposal', label: 'Proposal' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
]
const STAGE_LABEL: Record<DealStage, string> = {
  new: 'New',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
}
const SOURCES: DealSource[] = ['referral', 'website', 'cold', 'event', 'other']
const ACTIVITY_TYPES: ActivityType[] = ['call', 'email', 'meeting', 'note']

function stageTone(s: DealStage): StatusTone {
  return s === 'won'
    ? 'green'
    : s === 'lost'
      ? 'rose'
      : s === 'negotiation'
        ? 'amber'
        : s === 'proposal'
          ? 'violet'
          : s === 'qualified'
            ? 'blue'
            : 'gray'
}

const rupee = (p: number) => '₹' + Math.round(p / 100).toLocaleString('en-IN')
const fmtDate = (s: string) => {
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

const inputCls =
  'h-9 w-full rounded-lg border border-border bg-card px-2.5 text-[13px] outline-none transition-colors focus:border-ring'

type Tab = 'pipeline' | 'contacts' | 'companies'

export default function Crm() {
  const { firstTabActive } = useShell()
  const { activeWorkspace } = useAuth()
  const canManage =
    activeWorkspace?.role === 'Owner' || activeWorkspace?.role === 'Admin' || activeWorkspace?.role === 'Manager'

  const [tab, setTab] = useState<Tab>('pipeline')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [companies, setCompanies] = useState<Company[]>([])

  useEffect(() => {
    listEmployees().then(setEmployees)
  }, [])
  // companies list is shared across tabs (used for deal/contact pickers)
  const loadCompanies = useCallback(() => {
    getCompanies().then(setCompanies)
  }, [])
  useEffect(() => {
    loadCompanies()
  }, [loadCompanies])

  return (
    <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
      <PageTabs
        tabs={[
          { key: 'pipeline', label: 'Pipeline' },
          { key: 'contacts', label: 'Contacts' },
          { key: 'companies', label: 'Companies' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'pipeline' && (
        <PipelineTab employees={employees} companies={companies} canManage={canManage} />
      )}
      {tab === 'contacts' && (
        <ContactsTab employees={employees} companies={companies} canManage={canManage} />
      )}
      {tab === 'companies' && (
        <CompaniesTab employees={employees} canManage={canManage} onChanged={loadCompanies} />
      )}
    </Panel>
  )
}

// ─── Pipeline tab ───
function PipelineTab({
  employees,
  companies,
  canManage,
}: {
  employees: Employee[]
  companies: Company[]
  canManage: boolean
}) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<DealStage | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getPipeline()
      .then(setPipeline)
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    getContacts().then(setContacts)
  }, [])

  const allDeals = pipeline?.stages.flatMap((s) => s.deals) ?? []
  const openDeal = allDeals.find((d) => d.id === openId) ?? null

  // drag a deal card between stage columns to change its stage
  const handleDropToColumn = async (id: string, newStage: DealStage) => {
    setDraggingId(null)
    setOverStage(null)
    if (!pipeline) return
    const moved = pipeline.stages.flatMap((s) => s.deals).find((d) => d.id === id)
    if (!moved || moved.stage === newStage) return
    const prev = pipeline
    setPipeline({
      ...pipeline,
      stages: pipeline.stages.map((s) => {
        let deals = s.deals.filter((d) => d.id !== id)
        let valuePaise = s.valuePaise
        // keep per-stage value totals consistent with the card move
        if (s.stage === moved.stage) valuePaise -= moved.valuePaise
        if (s.stage === newStage) {
          deals = [...deals, { ...moved, stage: newStage }]
          valuePaise += moved.valuePaise
        }
        return { ...s, deals, valuePaise }
      }),
    })
    try {
      await updateDeal(id, { stage: newStage })
      load() // reconcile stage values/summary totals
    } catch (e) {
      setPipeline(prev)
      alert((e as Error).message)
    }
  }

  return (
    <>
      <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-border p-4 sm:grid-cols-4">
        <StatCard label="Open pipeline" value={pipeline ? rupee(pipeline.summary.openValuePaise) : undefined} />
        <StatCard label="Open deals" value={pipeline?.summary.openCount} />
        <StatCard label="Won value" value={pipeline ? rupee(pipeline.summary.wonValuePaise) : undefined} accent />
        <StatCard label="Total deals" value={pipeline?.summary.totalCount} />
      </div>

      <div className="flex shrink-0 items-center border-b border-border px-4 py-3">
        <button
          onClick={() => setCreateOpen(true)}
          className="btn-3d ml-auto inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" /> New deal
        </button>
      </div>

      {loading ? (
        <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">Loading…</div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
          {(pipeline?.stages ?? []).map((col) => (
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
                <span className="flex items-center gap-1.5">
                  <StatusBadge tone={stageTone(col.stage)}>{STAGE_LABEL[col.stage]}</StatusBadge>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{col.deals.length}</span>
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{rupee(col.valuePaise)}</span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {col.deals.map((d) => (
                  <DealCard
                    key={d.id}
                    deal={d}
                    onClick={() => setOpenId(d.id)}
                    dragging={draggingId === d.id}
                    onDragStart={() => setDraggingId(d.id)}
                    onDragEnd={() => {
                      setDraggingId(null)
                      setOverStage(null)
                    }}
                  />
                ))}
                {col.deals.length === 0 && (
                  <div className="px-1 py-4 text-center text-[12px] text-muted-foreground">No deals</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <DealModal
          employees={employees}
          companies={companies}
          contacts={contacts}
          onClose={() => setCreateOpen(false)}
          onDone={() => {
            setCreateOpen(false)
            load()
          }}
        />
      )}
      {openDeal && (
        <DealDrawer
          deal={openDeal}
          employees={employees}
          companies={companies}
          contacts={contacts}
          canManage={canManage}
          onClose={() => setOpenId(null)}
          onChanged={load}
          onDeleted={() => {
            setOpenId(null)
            load()
          }}
        />
      )}
    </>
  )
}

function DealCard({
  deal,
  onClick,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  deal: Deal
  onClick: () => void
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
}) {
  return (
    <button
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', deal.id)
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
      <div className="text-[13px] font-medium leading-snug">{deal.title}</div>
      {deal.companyName && <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{deal.companyName}</div>}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold tabular-nums">{rupee(deal.valuePaise)}</span>
        {deal.ownerName && <EmployeeAvatar name={deal.ownerName} className="size-5" />}
      </div>
    </button>
  )
}

function DealDrawer({
  deal,
  employees,
  companies,
  contacts,
  canManage,
  onClose,
  onChanged,
  onDeleted,
}: {
  deal: Deal
  employees: Employee[]
  companies: Company[]
  contacts: Contact[]
  canManage: boolean
  onClose: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loadingAct, setLoadingAct] = useState(true)
  const [actType, setActType] = useState<ActivityType>('note')
  const [actNotes, setActNotes] = useState('')
  const [actDue, setActDue] = useState('')
  const [savingAct, setSavingAct] = useState(false)

  useEffect(() => {
    setLoadingAct(true)
    getActivities({ dealId: deal.id })
      .then(setActivities)
      .finally(() => setLoadingAct(false))
  }, [deal.id])

  const patch = async (data: Parameters<typeof updateDeal>[1]) => {
    setBusy(true)
    try {
      await updateDeal(deal.id, data)
      onChanged()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const addActivity = async () => {
    if (!actNotes.trim() && actType === 'note') return
    setSavingAct(true)
    try {
      const a = await createActivity({ dealId: deal.id, type: actType, notes: actNotes, dueDate: actDue })
      setActivities((prev) => [a, ...prev])
      setActNotes('')
      setActDue('')
      sound.success()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSavingAct(false)
    }
  }

  const toggleDone = async (a: Activity) => {
    try {
      const upd = await updateActivity(a.id, { done: !a.done })
      setActivities((prev) => prev.map((x) => (x.id === a.id ? upd : x)))
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const removeActivity = async (id: string) => {
    try {
      await deleteActivity(id)
      setActivities((prev) => prev.filter((x) => x.id !== id))
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const remove = async () => {
    if (!confirm('Delete this deal?')) return
    setBusy(true)
    try {
      await deleteDeal(deal.id)
      sound.success()
      onDeleted()
    } catch (e) {
      alert((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col border-l border-border bg-background shadow-2xl duration-200 animate-in slide-in-from-right">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <input
            defaultValue={deal.title}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== deal.title) patch({ title: v })
            }}
            className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold tracking-tight outline-none"
          />
          <div className="flex items-center gap-1">
            {canManage && (
              <button
                onClick={remove}
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

        <div className="min-h-0 flex-1 overflow-auto">
          <div className="grid grid-cols-2 gap-3 border-b border-border p-5">
            <Field label="Stage">
              <select value={deal.stage} onChange={(e) => patch({ stage: e.target.value as DealStage })} disabled={busy} className={inputCls}>
                {STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Value (₹)">
              <input
                type="number"
                min={0}
                defaultValue={Math.round(deal.valuePaise / 100)}
                onBlur={(e) => {
                  const paise = Math.max(0, Math.round(Number(e.target.value) || 0)) * 100
                  if (paise !== deal.valuePaise) patch({ valuePaise: paise })
                }}
                disabled={busy}
                className={inputCls}
              />
            </Field>
            <Field label="Owner">
              <select value={deal.ownerId ?? ''} onChange={(e) => patch({ ownerId: e.target.value || null })} disabled={busy} className={inputCls}>
                <option value="">Unassigned</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source">
              <select value={deal.source} onChange={(e) => patch({ source: e.target.value as DealSource })} disabled={busy} className={cn(inputCls, 'capitalize')}>
                <option value="">—</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Company">
              <select value={deal.companyId ?? ''} onChange={(e) => patch({ companyId: e.target.value || null })} disabled={busy} className={inputCls}>
                <option value="">—</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Contact">
              <select value={deal.contactId ?? ''} onChange={(e) => patch({ contactId: e.target.value || null })} disabled={busy} className={inputCls}>
                <option value="">—</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="col-span-2">
              <Field label="Expected close">
                <input type="date" value={deal.expectedClose} onChange={(e) => patch({ expectedClose: e.target.value })} disabled={busy} className={inputCls} />
              </Field>
            </div>
          </div>

          {/* activity timeline */}
          <div className="p-5">
            <div className="mb-3 text-[12px] font-medium text-muted-foreground">Activity</div>
            <div className="mb-4 space-y-2 rounded-xl border border-border bg-muted/30 p-3">
              <div className="grid grid-cols-2 gap-2">
                <select value={actType} onChange={(e) => setActType(e.target.value as ActivityType)} className={cn(inputCls, 'capitalize')}>
                  {ACTIVITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input type="date" value={actDue} onChange={(e) => setActDue(e.target.value)} className={inputCls} />
              </div>
              <textarea
                value={actNotes}
                onChange={(e) => setActNotes(e.target.value)}
                rows={2}
                placeholder="Add a note…"
                className={cn(inputCls, 'h-auto resize-none py-2')}
              />
              <div className="flex justify-end">
                <button
                  onClick={addActivity}
                  disabled={savingAct}
                  className="btn-3d inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-3 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-60"
                >
                  {savingAct ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Log activity
                </button>
              </div>
            </div>

            {loadingAct ? (
              <div className="py-4 text-center text-[13px] text-muted-foreground">Loading…</div>
            ) : activities.length === 0 ? (
              <div className="py-4 text-center text-[13px] text-muted-foreground">No activity yet.</div>
            ) : (
              <ul className="space-y-3">
                {activities.map((a) => (
                  <li key={a.id} className="flex gap-2.5">
                    <button
                      onClick={() => toggleDone(a)}
                      aria-label="Toggle done"
                      className={cn(
                        'mt-0.5 grid size-5 shrink-0 cursor-pointer place-items-center rounded-md border transition-colors',
                        a.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border bg-card hover:border-ring',
                      )}
                    >
                      {a.done && <Check className="size-3" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{a.type}</span>
                        {a.dueDate && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Calendar className="size-3" />
                            {fmtDate(a.dueDate)}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(a.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                        </span>
                        <button
                          onClick={() => removeActivity(a.id)}
                          aria-label="Delete activity"
                          className="ml-auto grid size-5 cursor-pointer place-items-center rounded text-muted-foreground hover:text-rose-600"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                      {a.notes && <p className={cn('whitespace-pre-wrap text-[13px] text-foreground/90', a.done && 'line-through')}>{a.notes}</p>}
                      <p className="text-[11px] text-muted-foreground">{a.createdByName}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DealModal({
  employees,
  companies,
  contacts,
  onClose,
  onDone,
}: {
  employees: Employee[]
  companies: Company[]
  contacts: Contact[]
  onClose: () => void
  onDone: () => void
}) {
  const [title, setTitle] = useState('')
  const [value, setValue] = useState('')
  const [stage, setStage] = useState<DealStage>('new')
  const [source, setSource] = useState<DealSource>('')
  const [ownerId, setOwnerId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [contactId, setContactId] = useState('')
  const [expectedClose, setExpectedClose] = useState('')
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
      await createDeal({
        title,
        valuePaise: Math.max(0, Math.round(Number(value) || 0)) * 100,
        stage,
        source,
        ownerId: ownerId || null,
        companyId: companyId || null,
        contactId: contactId || null,
        expectedClose,
      })
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title="New deal" onClose={onClose}>
      <Field label="Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Deal name" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Value (₹)">
          <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} placeholder="0" />
        </Field>
        <Field label="Stage">
          <select value={stage} onChange={(e) => setStage(e.target.value as DealStage)} className={inputCls}>
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Owner">
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputCls}>
            <option value="">Unassigned</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Source">
          <select value={source} onChange={(e) => setSource(e.target.value as DealSource)} className={cn(inputCls, 'capitalize')}>
            <option value="">—</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Company">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Contact">
          <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="Expected close">
            <input type="date" value={expectedClose} onChange={(e) => setExpectedClose(e.target.value)} className={inputCls} />
          </Field>
        </div>
      </div>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Create" />
    </ModalShell>
  )
}

// ─── Contacts tab ───
function ContactsTab({
  employees,
  companies,
  canManage,
}: {
  employees: Employee[]
  companies: Company[]
  canManage: boolean
}) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ contact: Contact | null } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getContacts()
      .then(setContacts)
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const lv = useListView<Contact>({
    rows: contacts,
    search: (c) => c.name,
    filters: [{ id: 'company', label: 'Company', get: (c) => c.companyName || '' }],
    sorts: [
      { key: 'name', label: 'Name', get: (c) => c.name },
      { key: 'company', label: 'Company', get: (c) => c.companyName || '' },
      { key: 'owner', label: 'Owner', get: (c) => c.ownerName || '' },
    ],
  })

  const columns: GridColumn<Contact>[] = [
    { id: 'name', title: 'Name', kind: 'person', width: 200, get: (c) => c.name },
    { id: 'title', title: 'Title', kind: 'text', width: 150, get: (c) => c.title || '—' },
    { id: 'company', title: 'Company', kind: 'text', width: 180, get: (c) => c.companyName || '—' },
    { id: 'email', title: 'Email', kind: 'text', width: 220, get: (c) => c.email || '—' },
    { id: 'phone', title: 'Phone', kind: 'text', width: 150, get: (c) => c.phone || '—' },
    { id: 'owner', title: 'Owner', kind: 'person', width: 160, get: (c) => c.ownerName || '—' },
  ]

  return (
    <>
      <GridToolbar
        total={contacts.length}
        {...lv.toolbar}
        searchPlaceholder="Search contacts…"
        primaryAction={{ label: 'New contact', onClick: () => setModal({ contact: null }) }}
      />

      {loading ? (
        <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">Loading…</div>
      ) : (
        <div className="min-h-0 flex-1 border-t border-border">
          <DataGrid
            rows={lv.view}
            columns={columns}
            getRowId={(c) => c.id}
            onRowClick={(c) => setModal({ contact: c })}
            emptyMessage="No contacts yet"
          />
        </div>
      )}

      {modal && (
        <ContactModal
          contact={modal.contact}
          employees={employees}
          companies={companies}
          canManage={canManage}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null)
            load()
          }}
        />
      )}
    </>
  )
}

function ContactModal({
  contact,
  employees,
  companies,
  canManage,
  onClose,
  onDone,
}: {
  contact: Contact | null
  employees: Employee[]
  companies: Company[]
  canManage: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [name, setName] = useState(contact?.name ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [title, setTitle] = useState(contact?.title ?? '')
  const [companyId, setCompanyId] = useState(contact?.companyId ?? '')
  const [ownerId, setOwnerId] = useState(contact?.ownerId ?? '')
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
      const payload = { name, email, phone, title, companyId: companyId || null, ownerId: ownerId || null }
      if (contact) await updateContact(contact.id, payload)
      else await createContact(payload)
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!contact || !confirm('Delete this contact?')) return
    setBusy(true)
    try {
      await deleteContact(contact.id)
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title={contact ? 'Edit contact' : 'New contact'} onClose={onClose}>
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. CTO" />
        </Field>
        <Field label="Company">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
        </Field>
        <div className="col-span-2">
          <Field label="Owner">
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputCls}>
              <option value="">Unassigned</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions
        busy={busy}
        onClose={onClose}
        onSubmit={submit}
        label={contact ? 'Save' : 'Create'}
        onDelete={contact && canManage ? remove : undefined}
      />
    </ModalShell>
  )
}

// ─── Companies tab ───
function CompaniesTab({
  employees,
  canManage,
  onChanged,
}: {
  employees: Employee[]
  canManage: boolean
  onChanged: () => void
}) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ company: Company | null } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getCompanies()
      .then(setCompanies)
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const lv = useListView<Company>({
    rows: companies,
    search: (c) => c.name,
    filters: [{ id: 'industry', label: 'Industry', get: (c) => c.industry || '' }],
    sorts: [
      { key: 'name', label: 'Name', get: (c) => c.name },
      { key: 'industry', label: 'Industry', get: (c) => c.industry || '' },
    ],
  })

  const columns: GridColumn<Company>[] = [
    { id: 'name', title: 'Name', kind: 'text', width: 220, get: (c) => c.name },
    { id: 'industry', title: 'Industry', kind: 'text', width: 180, get: (c) => c.industry || '—' },
    { id: 'owner', title: 'Owner', kind: 'person', width: 160, get: (c) => c.ownerName || '—' },
    { id: 'contacts', title: 'Contacts', kind: 'number', width: 110, get: (c) => c.contactCount },
    { id: 'deals', title: 'Deals', kind: 'number', width: 110, get: (c) => c.dealCount },
  ]

  return (
    <>
      <GridToolbar
        total={companies.length}
        {...lv.toolbar}
        searchPlaceholder="Search companies…"
        primaryAction={{ label: 'New company', onClick: () => setModal({ company: null }) }}
      />

      {loading ? (
        <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">Loading…</div>
      ) : (
        <div className="min-h-0 flex-1 border-t border-border">
          <DataGrid
            rows={lv.view}
            columns={columns}
            getRowId={(c) => c.id}
            onRowClick={(c) => setModal({ company: c })}
            emptyMessage="No companies yet"
          />
        </div>
      )}

      {modal && (
        <CompanyModal
          company={modal.company}
          employees={employees}
          canManage={canManage}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null)
            load()
            onChanged()
          }}
        />
      )}
    </>
  )
}

function CompanyModal({
  company,
  employees,
  canManage,
  onClose,
  onDone,
}: {
  company: Company | null
  employees: Employee[]
  canManage: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [name, setName] = useState(company?.name ?? '')
  const [industry, setIndustry] = useState(company?.industry ?? '')
  const [website, setWebsite] = useState(company?.website ?? '')
  const [phone, setPhone] = useState(company?.phone ?? '')
  const [ownerId, setOwnerId] = useState(company?.ownerId ?? '')
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
      const payload = { name, industry, website, phone, ownerId: ownerId || null }
      if (company) await updateCompany(company.id, payload)
      else await createCompany(payload)
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!company || !confirm('Delete this company? Its contacts and deals will be detached.')) return
    setBusy(true)
    try {
      await deleteCompany(company.id)
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title={company ? 'Edit company' : 'New company'} onClose={onClose}>
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Industry">
          <input value={industry} onChange={(e) => setIndustry(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
        </Field>
        <div className="col-span-2">
          <Field label="Website">
            <input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} placeholder="https://" />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Owner">
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputCls}>
              <option value="">Unassigned</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions
        busy={busy}
        onClose={onClose}
        onSubmit={submit}
        label={company ? 'Save' : 'Create'}
        onDelete={company && canManage ? remove : undefined}
      />
    </ModalShell>
  )
}

// ─── shared UI primitives ───
function StatCard({ label, value, accent }: { label: string; value?: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-2xl font-semibold tabular-nums', accent && 'text-emerald-600')}>{value ?? '—'}</div>
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
