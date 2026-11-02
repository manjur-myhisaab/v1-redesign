import { useEffect, useState } from 'react'
import { Plus, X, Loader2, LifeBuoy, Send } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import { useAuth } from '@/context/auth/AuthContext'
import { sound } from '@/lib/sound'
import {
  getMyTickets,
  createTicket,
  getTicket,
  addTicketComment,
  getHelpdeskCategories,
  type MyTicketsPayload,
  type HelpdeskTicket,
  type HelpdeskTicketDetail,
  type HelpdeskCategory,
  type HelpdeskPriority,
} from '@/lib/api'
import { Loading, EmptyState, PrimaryButton, GhostButton, Field, inputCls, StatusPill, fmtDateTime } from './ui'

export default function Helpdesk() {
  const [data, setData] = useState<MyTicketsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    getMyTickets()
      .then(setData)
      .catch(() => setData({ raised: [], assigned: [] }))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  return (
    <Panel className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h1 className="font-display text-base font-semibold tracking-tight">Helpdesk</h1>
          <p className="text-[12px] text-muted-foreground">Your support tickets</p>
        </div>
        <PrimaryButton onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Raise ticket
        </PrimaryButton>
      </div>

      {loading ? (
        <Loading />
      ) : !data || (data.raised.length === 0 && data.assigned.length === 0) ? (
        <EmptyState icon={<LifeBuoy className="size-6 opacity-40" />}>No tickets yet.</EmptyState>
      ) : (
        <div className="space-y-6 p-5">
          <TicketList title="Raised by me" tickets={data.raised} onOpen={setOpenId} />
          {data.assigned.length > 0 && <TicketList title="Assigned to me" tickets={data.assigned} onOpen={setOpenId} />}
        </div>
      )}

      {createOpen && (
        <CreateTicketModal
          onClose={() => setCreateOpen(false)}
          onDone={() => {
            setCreateOpen(false)
            load()
          }}
        />
      )}
      {openId && <TicketModal id={openId} onClose={() => setOpenId(null)} />}
    </Panel>
  )
}

function TicketList({ title, tickets, onOpen }: { title: string; tickets: HelpdeskTicket[]; onOpen: (id: string) => void }) {
  if (tickets.length === 0) return null
  return (
    <div>
      <h2 className="mb-2 text-[13px] font-semibold">{title}</h2>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {tickets.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onOpen(t.id)}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-mono text-muted-foreground">{t.ticketNo}</span>
                  <span className="text-[13px] font-medium">{t.subject}</span>
                </div>
                <div className="text-[12px] capitalize text-muted-foreground">
                  {t.priority}
                  {t.categoryName && ` · ${t.categoryName}`}
                  {t.assigneeName && ` · ${t.assigneeName}`}
                </div>
              </div>
              <StatusPill status={t.status} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CreateTicketModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [cats, setCats] = useState<HelpdeskCategory[]>([])
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [priority, setPriority] = useState<HelpdeskPriority>('medium')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getHelpdeskCategories()
      .then((c) => setCats(c.filter((x) => x.active)))
      .catch(() => {})
  }, [])

  const submit = async () => {
    if (!subject.trim()) {
      setError('Enter a subject')
      return
    }
    setBusy(true)
    setError('')
    try {
      // requesterId omitted → server sets the caller's own employee as requester
      await createTicket({ subject: subject.trim(), description, categoryId: categoryId || null, priority })
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
          <h2 className="font-display text-lg font-semibold tracking-tight">Raise a ticket</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <Field label="Subject"><input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} /></Field>
          <Field label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls + ' h-auto py-2'} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                <option value="">— None —</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select value={priority} onChange={(e) => setPriority(e.target.value as HelpdeskPriority)} className={inputCls}>
                {(['low', 'medium', 'high', 'urgent'] as HelpdeskPriority[]).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>
          </div>
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

function TicketModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { user } = useAuth()
  const [ticket, setTicket] = useState<HelpdeskTicketDetail | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    getTicket(id)
      .then(setTicket)
      .catch((e) => setError((e as Error).message))
  }
  useEffect(load, [id])

  const send = async () => {
    if (!comment.trim()) return
    setBusy(true)
    try {
      await addTicketComment(id, { body: comment.trim() })
      setComment('')
      sound.success()
      load()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl duration-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-semibold tracking-tight">{ticket?.subject ?? 'Ticket'}</h2>
            {ticket && <p className="text-[12px] text-muted-foreground">{ticket.ticketNo}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        {error ? (
          <p className="p-5 text-[13px] text-rose-600">{error}</p>
        ) : !ticket ? (
          <p className="p-5 text-[13px] text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-border px-5 py-3 text-[12px] text-muted-foreground">
              <StatusPill status={ticket.status} />
              <span className="capitalize">{ticket.priority}</span>
              {ticket.categoryName && <span>· {ticket.categoryName}</span>}
              {ticket.assigneeName && <span>· {ticket.assigneeName}</span>}
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-auto px-5 py-4">
              {ticket.description && <p className="text-[13px] text-foreground">{ticket.description}</p>}
              {ticket.comments.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">No comments yet.</p>
              ) : (
                ticket.comments.map((c) => {
                  const mine = c.authorId === user?.id
                  return (
                    <div key={c.id} className={mine ? 'flex flex-col items-end' : 'flex flex-col items-start'}>
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[13px] ${mine ? 'bg-foreground text-background' : 'bg-muted'}`}>
                        {c.body}
                      </div>
                      <span className="mt-0.5 text-[11px] text-muted-foreground">
                        {c.authorName} · {fmtDateTime(c.createdAt)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-border p-3">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Add a comment…"
                className={inputCls}
              />
              <PrimaryButton onClick={send} disabled={busy || !comment.trim()} className="px-3">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
