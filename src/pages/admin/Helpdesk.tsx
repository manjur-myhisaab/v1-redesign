import { useCallback, useEffect, useState } from 'react'
import { Loader2, X, Plus, Trash2, Check, Ban, Send, Lock } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import PageTabs from '@/components/admin/PageTabs'
import MetricCard from '@/components/admin/MetricCard'
import StatusBadge, { type StatusTone } from '@/components/admin/StatusBadge'
import { EmployeeAvatar } from '@/lib/people'
import DetailPanel, { Field as PanelField } from '@/components/admin/DetailPanel'
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
  getTickets,
  getTicketSummary,
  getTicket,
  createTicket,
  updateTicket,
  setTicketStatus,
  addTicketComment,
  deleteTicket,
  getHelpdeskCategories,
  createHelpdeskCategory,
  updateHelpdeskCategory,
  type HelpdeskTicket,
  type HelpdeskTicketDetail,
  type HelpdeskCategory,
  type HelpdeskSummary,
  type HelpdeskPriority,
  type HelpdeskStatus,
  type Paywall,
} from '@/lib/api'
import { type Employee } from '@/lib/employees'

// ─── shared constants / helpers ───
const PRIORITIES: HelpdeskPriority[] = ['low', 'medium', 'high', 'urgent']
const PRIORITY_LABEL: Record<HelpdeskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}
function priorityTone(p: HelpdeskPriority): StatusTone {
  return p === 'urgent' ? 'rose' : p === 'high' ? 'amber' : p === 'medium' ? 'blue' : 'gray'
}

const STATUSES: HelpdeskStatus[] = ['open', 'in_progress', 'on_hold', 'resolved', 'closed']
const STATUS_LABEL: Record<HelpdeskStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  on_hold: 'On hold',
  resolved: 'Resolved',
  closed: 'Closed',
}
function statusTone(s: HelpdeskStatus): StatusTone {
  return s === 'open'
    ? 'blue'
    : s === 'in_progress'
      ? 'violet'
      : s === 'on_hold'
        ? 'amber'
        : s === 'resolved'
          ? 'green'
          : 'gray'
}

const today = () => new Date().toISOString().slice(0, 10)
const isOverdue = (t: { dueAt: string; status: HelpdeskStatus }) =>
  !!t.dueAt && t.dueAt < today() && t.status !== 'resolved' && t.status !== 'closed'
const fmtDate = (s: string) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return s
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}
const fmtTime = (s: string) =>
  new Date(s).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

const inputCls =
  'h-9 w-full rounded-lg border border-border bg-card px-2.5 text-[13px] outline-none transition-colors focus:border-ring'

type Tab = 'all' | 'mine' | 'categories'

export default function Helpdesk() {
  const { firstTabActive } = useShell()
  const { activeWorkspace } = useAuth()
  const canManage =
    activeWorkspace?.role === 'Owner' || activeWorkspace?.role === 'Admin' || activeWorkspace?.role === 'Manager'

  const [tab, setTab] = useState<Tab>(canManage ? 'all' : 'mine')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [categories, setCategories] = useState<HelpdeskCategory[]>([])
  const [paywall, setPaywall] = useState<Paywall | null>(null)

  useEffect(() => {
    listEmployees().then(setEmployees).catch(() => {})
  }, [])
  const loadCategories = useCallback(() => {
    getHelpdeskCategories().then(setCategories).catch(() => {})
  }, [])
  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  // shared in-panel header (sub-tabs) rendered inside each tab's list Panel so
  // the detail panel can sit beside it as a flex sibling
  const header = (
    <PageTabs
      tabs={[
        { key: 'all', label: 'All tickets' },
        { key: 'mine', label: 'My tickets' },
        { key: 'categories', label: 'Categories' },
      ]}
      active={tab}
      onChange={setTab}
    />
  )

  return (
    <>
      {tab === 'all' && (
        <TicketsTab key="all" header={header} firstTabActive={firstTabActive} mine={false} employees={employees} categories={categories} canManage={canManage} />
      )}
      {tab === 'mine' && (
        <TicketsTab key="mine" header={header} firstTabActive={firstTabActive} mine employees={employees} categories={categories} canManage={canManage} />
      )}
      {tab === 'categories' && (
        <CategoriesTab header={header} firstTabActive={firstTabActive} categories={categories} canManage={canManage} onChanged={loadCategories} onPaywall={setPaywall} />
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

// ─── Tickets tab (shared by "All" and "My tickets") ───
function TicketsTab({
  header,
  firstTabActive,
  mine,
  employees,
  categories,
  canManage,
}: {
  header: React.ReactNode
  firstTabActive: boolean
  mine: boolean
  employees: Employee[]
  categories: HelpdeskCategory[]
  canManage: boolean
}) {
  const [tickets, setTickets] = useState<HelpdeskTicket[]>([])
  const [summary, setSummary] = useState<HelpdeskSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getTickets({ mine: mine || undefined }), getTicketSummary()])
      .then(([t, s]) => {
        setTickets(t)
        setSummary(s)
      })
      .finally(() => setLoading(false))
  }, [mine])
  useEffect(() => {
    load()
  }, [load])

  // shared search + filter (status / priority / category) + sort, identical to Employees
  const lv = useListView<HelpdeskTicket>({
    rows: tickets,
    search: (t) => `${t.ticketNo} ${t.subject} ${t.requesterName} ${t.assigneeName}`,
    filters: [
      { id: 'status', label: 'Status', get: (t) => STATUS_LABEL[t.status] },
      { id: 'priority', label: 'Priority', get: (t) => PRIORITY_LABEL[t.priority] },
      { id: 'category', label: 'Category', get: (t) => t.categoryName },
    ],
    sorts: [
      { key: 'ticketNo', label: 'Ticket #', get: (t) => t.ticketNo },
      { key: 'subject', label: 'Subject', get: (t) => t.subject },
      { key: 'status', label: 'Status', get: (t) => STATUS_LABEL[t.status] },
      { key: 'priority', label: 'Priority', get: (t) => PRIORITIES.indexOf(t.priority) },
      { key: 'assignee', label: 'Assignee', get: (t) => t.assigneeName },
      { key: 'created', label: 'Created', get: (t) => t.createdAt },
      { key: 'updated', label: 'Updated', get: (t) => t.updatedAt },
    ],
  })

  const columns: GridColumn<HelpdeskTicket>[] = [
    { id: 'ticketNo', title: 'Ticket #', kind: 'text', width: 100, get: (r) => r.ticketNo },
    { id: 'subject', title: 'Subject', kind: 'text', width: 240, get: (r) => r.subject },
    {
      id: 'category',
      title: 'Category',
      kind: 'badge',
      width: 130,
      get: (r) => r.categoryName,
      badgeTone: () => 'violet' as BadgeTone,
    },
    {
      id: 'priority',
      title: 'Priority',
      kind: 'badge',
      width: 110,
      get: (r) => PRIORITY_LABEL[r.priority],
      badgeTone: (r) => priorityTone(r.priority) as BadgeTone,
    },
    {
      id: 'status',
      title: 'Status',
      kind: 'badge',
      width: 120,
      get: (r) => STATUS_LABEL[r.status],
      badgeTone: (r) => statusTone(r.status) as BadgeTone,
    },
    { id: 'requester', title: 'Requester', kind: 'person', width: 160, get: (r) => r.requesterName || '—' },
    { id: 'assignee', title: 'Assignee', kind: 'person', width: 160, get: (r) => r.assigneeName || '—' },
    {
      id: 'due',
      title: 'Due',
      kind: 'badge',
      width: 130,
      get: (r) => (r.dueAt ? fmtDate(r.dueAt) : ''),
      badgeTone: (r) => (isOverdue(r) ? 'rose' : 'gray') as BadgeTone,
    },
  ]

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
        {header}

        <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-border p-4 lg:grid-cols-4">
          <MetricCard label="Open" value={summary ? String(summary.open) : '—'} />
          <MetricCard label="In progress" value={summary ? String(summary.in_progress) : '—'} />
          <MetricCard label="Overdue" value={summary ? String(summary.overdue) : '—'} />
          <MetricCard label="Unassigned" value={summary ? String(summary.unassigned) : '—'} />
        </div>

        <GridToolbar
          total={tickets.length}
          {...lv.toolbar}
          searchPlaceholder="Search subject…"
          primaryAction={{ label: 'New ticket', onClick: () => setCreateOpen(true), icon: Plus }}
        />

        {loading ? (
          <div className="grid flex-1 place-items-center border-t border-border text-[13px] text-muted-foreground">
            Loading…
          </div>
        ) : tickets.length === 0 ? (
          <div className="grid flex-1 place-items-center border-t border-border px-4 text-center text-[13px] text-muted-foreground">
            {mine ? 'You have not raised any tickets yet.' : 'No tickets yet.'} Click “New ticket” to raise one.
          </div>
        ) : (
          <div className="min-h-0 flex-1 border-t border-border">
            <DataGrid
              rows={lv.view}
              columns={columns}
              getRowId={(r) => r.id}
              onRowClick={(r) => setOpenId(r.id)}
              onAddRow={() => setCreateOpen(true)}
              emptyMessage="No tickets"
            />
          </div>
        )}

        {createOpen && (
          <TicketModal
            categories={categories}
            onClose={() => setCreateOpen(false)}
            onDone={() => {
              setCreateOpen(false)
              load()
            }}
          />
        )}
      </Panel>

      <TicketDetail
        ticketId={openId}
        employees={employees}
        categories={categories}
        canManage={canManage}
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

// ─── Ticket detail panel ───
function TicketDetail({
  ticketId,
  employees,
  categories,
  canManage,
  onClose,
  onChanged,
  onDeleted,
}: {
  ticketId: string | null
  employees: Employee[]
  categories: HelpdeskCategory[]
  canManage: boolean
  onClose: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const [ticket, setTicket] = useState<HelpdeskTicketDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const [internal, setInternal] = useState(false)

  const load = useCallback(() => {
    if (!ticketId) return
    getTicket(ticketId)
      .then(setTicket)
      .catch((e) => setError((e as Error).message))
  }, [ticketId])
  useEffect(() => {
    setComment('')
    setInternal(false)
    setError('')
    if (ticketId) load()
  }, [ticketId, load])

  const triage = async (patch: Parameters<typeof updateTicket>[1]) => {
    if (!ticketId) return
    setBusy(true)
    setError('')
    try {
      await updateTicket(ticketId, patch)
      sound.success()
      load()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (s: HelpdeskStatus) => {
    if (!ticketId) return
    setBusy(true)
    setError('')
    try {
      await setTicketStatus(ticketId, s)
      sound.success()
      load()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const postComment = async () => {
    if (!ticketId || !comment.trim()) return
    setBusy(true)
    setError('')
    try {
      await addTicketComment(ticketId, { body: comment, internal: canManage ? internal : undefined })
      setComment('')
      setInternal(false)
      sound.success()
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!ticketId) return
    if (!confirm('Delete this ticket?')) return
    setBusy(true)
    setError('')
    try {
      await deleteTicket(ticketId)
      sound.success()
      onDeleted()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  // confidentiality: never surface internal comments to non-managers
  const visibleComments = ticket ? ticket.comments.filter((c) => canManage || !c.internal) : []

  const footer =
    ticket && canManage ? (
      <button
        onClick={remove}
        disabled={busy}
        className="ml-auto inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
      >
        <Trash2 className="size-3.5" /> Delete
      </button>
    ) : undefined

  return (
    <DetailPanel
      open={!!ticketId}
      onClose={onClose}
      width="w-80"
      title={ticket?.subject ?? 'Ticket'}
      subtitle={ticket?.ticketNo}
      avatar={{ name: ticket?.requesterName ?? '' }}
      footer={footer}
    >
      {!ticket ? (
        <p className="text-[13px] text-muted-foreground">Loading…</p>
      ) : (
        <>
          {/* ticket meta */}
          <PanelField label="Status">
            <StatusBadge tone={statusTone(ticket.status)}>{STATUS_LABEL[ticket.status]}</StatusBadge>
          </PanelField>
          <PanelField label="Priority">
            <StatusBadge tone={priorityTone(ticket.priority)}>{PRIORITY_LABEL[ticket.priority]}</StatusBadge>
          </PanelField>
          <PanelField label="Category">
            {ticket.categoryName ? <StatusBadge tone="violet">{ticket.categoryName}</StatusBadge> : '—'}
          </PanelField>
          <PanelField label="Requester">{ticket.requesterName || '—'}</PanelField>
          <PanelField label="Assignee">{ticket.assigneeName || '—'}</PanelField>
          <PanelField label="Due">
            <span className={isOverdue(ticket) ? 'text-rose-600' : undefined}>{fmtDate(ticket.dueAt)}</span>
          </PanelField>
          <PanelField label="Raised">{fmtDate(ticket.createdAt.slice(0, 10))}</PanelField>
          {ticket.description && (
            <div className="pt-1">
              <div className="mb-1 text-[12px] text-muted-foreground">Description</div>
              <div className="whitespace-pre-wrap text-foreground/90">{ticket.description}</div>
            </div>
          )}

          {/* triage (managers only) */}
          {canManage && (
            <div className="space-y-3 border-t border-border pt-3">
              <div className="text-[12px] font-medium text-muted-foreground">Triage</div>
              <Field label="Assignee">
                <select
                  value={ticket.assigneeId ?? ''}
                  onChange={(e) => triage({ assigneeId: e.target.value || null })}
                  disabled={busy}
                  className={inputCls}
                >
                  <option value="">Unassigned</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Priority">
                <select
                  value={ticket.priority}
                  onChange={(e) => triage({ priority: e.target.value as HelpdeskPriority })}
                  disabled={busy}
                  className={inputCls}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Category">
                <select
                  value={ticket.categoryId ?? ''}
                  onChange={(e) => triage({ categoryId: e.target.value || null })}
                  disabled={busy}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex flex-wrap items-center gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    disabled={busy || s === ticket.status}
                    className={cn(
                      'inline-flex h-7 cursor-pointer items-center rounded-lg border px-3 text-[12px] font-medium transition-colors disabled:cursor-default',
                      s === ticket.status
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* conversation */}
          <div className="border-t border-border pt-3">
            <div className="mb-3 text-[12px] font-medium text-muted-foreground">Conversation</div>
            {visibleComments.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No comments yet.</p>
            ) : (
              <ul className="space-y-3">
                {visibleComments.map((c) => (
                  <li key={c.id} className="flex gap-2.5">
                    <EmployeeAvatar name={c.authorName} className="mt-0.5" />
                    <div
                      className={cn(
                        'min-w-0 flex-1 rounded-xl border px-3 py-2',
                        c.internal ? 'border-amber-200 bg-amber-50' : 'border-border bg-card',
                      )}
                    >
                      <div className="flex items-center gap-2 text-[12px]">
                        <span className="font-medium">{c.authorName}</span>
                        {c.internal && (
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <Lock className="size-3" /> Internal
                          </span>
                        )}
                        <span className="ml-auto text-muted-foreground">{fmtTime(c.createdAt)}</span>
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-[13px] text-foreground/90">{c.body}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* add a reply */}
          <div className="space-y-2 border-t border-border pt-3">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Write a reply…"
              className={cn(inputCls, 'h-auto resize-none py-2')}
            />
            <div className="flex items-center gap-3">
              {canManage && (
                <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted-foreground">
                  <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                  Internal note
                </label>
              )}
              <button
                onClick={postComment}
                disabled={busy || !comment.trim()}
                className="btn-3d ml-auto inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-4" />} Send
              </button>
            </div>
          </div>

          {error && <p className="text-[13px] text-rose-600">{error}</p>}
        </>
      )}
    </DetailPanel>
  )
}

// ─── New ticket modal ───
function TicketModal({
  categories,
  onClose,
  onDone,
}: {
  categories: HelpdeskCategory[]
  onClose: () => void
  onDone: () => void
}) {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [priority, setPriority] = useState<HelpdeskPriority>('medium')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const activeCategories = categories.filter((c) => c.active)

  // adopt the selected category's default priority
  const onCategory = (id: string) => {
    setCategoryId(id)
    const cat = categories.find((c) => c.id === id)
    if (cat) setPriority(cat.defaultPriority)
  }

  const submit = async () => {
    if (!subject.trim()) {
      setError('Subject is required')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createTicket({ subject, description, categoryId: categoryId || null, priority })
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title="New ticket" onClose={onClose}>
      <Field label="Subject">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={inputCls}
          placeholder="e.g. Laptop won't boot"
          autoFocus
        />
      </Field>
      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe the issue or request…"
          className={cn(inputCls, 'h-auto resize-none py-2')}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select value={categoryId} onChange={(e) => onCategory(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select value={priority} onChange={(e) => setPriority(e.target.value as HelpdeskPriority)} className={inputCls}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Raise ticket" />
    </ModalShell>
  )
}

// ─── Categories tab ───
function CategoriesTab({
  header,
  firstTabActive,
  categories,
  canManage,
  onChanged,
  onPaywall,
}: {
  header: React.ReactNode
  firstTabActive: boolean
  categories: HelpdeskCategory[]
  canManage: boolean
  onChanged: () => void
  onPaywall: (p: Paywall) => void
}) {
  const [name, setName] = useState('')
  const [sla, setSla] = useState('24')
  const [priority, setPriority] = useState<HelpdeskPriority>('medium')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const add = async () => {
    if (!name.trim()) return
    setBusy(true)
    setError('')
    try {
      await createHelpdeskCategory({
        name,
        slaHours: Math.max(0, Math.round(Number(sla) || 0)),
        defaultPriority: priority,
      })
      setName('')
      setSla('24')
      setPriority('medium')
      sound.success()
      onChanged()
    } catch (e) {
      const err = e as Error & { status?: number; payload?: { paywall?: Paywall } }
      if (err.status === 402 && err.payload?.paywall) {
        onPaywall(err.payload.paywall)
        return
      }
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (c: HelpdeskCategory) => {
    try {
      await updateHelpdeskCategory(c.id, { active: !c.active })
      onChanged()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
        {header}
        <div className="min-h-0 flex-1 overflow-auto p-5">
      <div className="mx-auto max-w-xl">
        {canManage && (
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <label className="flex-1 space-y-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder="e.g. IT, HR, Payroll, Facilities"
                className={inputCls}
              />
            </label>
            <label className="w-28 space-y-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">SLA (hours)</span>
              <input type="number" min={0} value={sla} onChange={(e) => setSla(e.target.value)} className={inputCls} />
            </label>
            <label className="w-32 space-y-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">Priority</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value as HelpdeskPriority)} className={inputCls}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={add}
              disabled={busy || !name.trim()}
              className="btn-3d inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-4" />} Add
            </button>
          </div>
        )}
        {error && <p className="mb-3 text-[13px] text-rose-600">{error}</p>}

        {categories.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-[13px] text-muted-foreground">
            No categories yet.
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-2 text-[13px]">
                  {c.name}
                  <StatusBadge tone={priorityTone(c.defaultPriority)}>{PRIORITY_LABEL[c.defaultPriority]}</StatusBadge>
                  <span className="text-[12px] text-muted-foreground">SLA {c.slaHours}h</span>
                  {!c.active && <StatusBadge tone="gray">Inactive</StatusBadge>}
                </span>
                {canManage && (
                  <button
                    onClick={() => toggle(c)}
                    className={cn(
                      'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium transition-colors',
                      c.active
                        ? 'border-border bg-card text-muted-foreground hover:bg-muted'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                    )}
                  >
                    {c.active ? <Ban className="size-3.5" /> : <Check className="size-3.5" />}
                    {c.active ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
        </div>
      </Panel>
    </div>
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
