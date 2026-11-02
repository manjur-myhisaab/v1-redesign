import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Send, Users, Plus, X, Check, MessageSquare } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import { EmployeeAvatar } from '@/lib/people'
import { useShell } from '@/components/admin/shell-context'
import { cn } from '@/lib/utils'
import {
  getConversations,
  getMessages,
  getMessagePeople,
  sendMessage,
  openDm,
  createGroup,
  type Conversation,
  type ChatMessage,
  type MessagePerson,
} from '@/lib/api'

const POLL_MS = 15000

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

export default function Messages() {
  const { firstTabActive } = useShell()
  const [params, setParams] = useSearchParams()
  const activeId = params.get('c')

  const [convs, setConvs] = useState<Conversation[]>([])
  const [people, setPeople] = useState<MessagePerson[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const setActive = useCallback(
    (id: string | null) => {
      setParams(id ? { c: id } : {}, { replace: true })
    },
    [setParams],
  )

  const loadConvs = useCallback(() => {
    getConversations().then(setConvs).catch(() => {})
  }, [])

  const loadMessages = useCallback(
    (id: string) => {
      getMessages(id)
        .then((m) => {
          setMessages(m)
          // a fetch marks-read server side; refresh the inbox unread badges
          loadConvs()
        })
        .catch(() => {})
    },
    [loadConvs],
  )

  // initial + people
  useEffect(() => {
    loadConvs()
    getMessagePeople().then(setPeople).catch(() => {})
  }, [loadConvs])

  // load thread when the active conversation changes
  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    loadMessages(activeId)
  }, [activeId, loadMessages])

  // poll inbox + open thread every ~15s
  useEffect(() => {
    const t = setInterval(() => {
      loadConvs()
      if (activeId) getMessages(activeId).then(setMessages).catch(() => {})
    }, POLL_MS)
    return () => clearInterval(t)
  }, [activeId, loadConvs])

  // autoscroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, activeId])

  const activeConv = convs.find((c) => c.id === activeId) ?? null

  const filteredConvs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return convs
    return convs.filter((c) => c.title.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q))
  }, [convs, query])

  // people not already in a 1:1 conversation, matching the search
  const peopleResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return people.filter((p) => (p.name || p.phone).toLowerCase().includes(q))
  }, [people, query])

  async function startDm(userId: string) {
    try {
      const { id } = await openDm(userId)
      setQuery('')
      loadConvs()
      setActive(id)
    } catch {
      /* ignore */
    }
  }

  async function handleSend() {
    const body = draft.trim()
    if (!body || !activeId || sending) return
    setSending(true)
    setDraft('')
    try {
      await sendMessage(activeId, body)
      await getMessages(activeId).then(setMessages)
      loadConvs()
    } catch {
      setDraft(body) // restore on failure
    } finally {
      setSending(false)
    }
  }

  function onComposerKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Panel className={cn('flex min-w-0 flex-1 overflow-hidden', firstTabActive && 'rounded-tl-none')}>
      {/* left: conversation list */}
      <div className="flex w-72 shrink-0 flex-col border-r border-border">
        <div className="flex items-center gap-2 border-b border-border p-2.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or start a chat"
              className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-2 text-[13px] outline-none placeholder:text-muted-foreground focus:border-foreground/30"
            />
          </div>
          <button
            type="button"
            onClick={() => setGroupOpen(true)}
            title="New group"
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Users className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* people search results (start a DM) */}
          {peopleResults.length > 0 && (
            <div className="border-b border-border py-1">
              <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Start a chat
              </p>
              {peopleResults.map((p) => (
                <button
                  key={p.userId}
                  onClick={() => startDm(p.userId)}
                  className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted"
                >
                  <EmployeeAvatar name={p.name || p.phone} className="size-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{p.name || p.phone}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">{p.role}</span>
                  </span>
                  <Plus className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          {filteredConvs.length === 0 && peopleResults.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
              <MessageSquare className="size-6" />
              <p className="text-[13px]">No conversations yet.</p>
              <p className="text-[12px]">Search a teammate above to start a chat.</p>
            </div>
          ) : (
            filteredConvs.map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted',
                  c.id === activeId && 'bg-muted',
                )}
              >
                {c.kind === 'group' ? (
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Users className="size-4" />
                  </span>
                ) : (
                  <EmployeeAvatar name={c.title} className="size-9" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium">{c.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {c.lastMessageAt ? fmtTime(c.lastMessageAt) : ''}
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] text-muted-foreground">
                      {c.lastMessage || (c.kind === 'group' ? `${c.participantCount} members` : 'No messages yet')}
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                        {c.unreadCount}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* right: thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!activeConv ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <MessageSquare className="size-8" />
            <p className="text-[13px]">Select a conversation to start messaging.</p>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-2.5">
              {activeConv.kind === 'group' ? (
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Users className="size-4" />
                </span>
              ) : (
                <EmployeeAvatar name={activeConv.title} className="size-8" />
              )}
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold">{activeConv.title}</p>
                <p className="text-[12px] text-muted-foreground">
                  {activeConv.kind === 'group'
                    ? `${activeConv.participantCount} members`
                    : 'Direct message'}
                </p>
              </div>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-muted-foreground">
                  No messages yet. Say hello.
                </p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[70%] rounded-xl px-3 py-2 text-[13px]',
                        m.mine
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border bg-card text-foreground',
                      )}
                    >
                      {!m.mine && activeConv.kind === 'group' && (
                        <p className="mb-0.5 text-[11px] font-semibold text-muted-foreground">
                          {m.senderName}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p
                        className={cn(
                          'mt-0.5 text-right text-[10px]',
                          m.mine ? 'text-primary-foreground/70' : 'text-muted-foreground',
                        )}
                      >
                        {fmtTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex shrink-0 items-end gap-2 border-t border-border p-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onComposerKey}
                rows={1}
                placeholder="Type a message…"
                className="max-h-32 min-h-9 flex-1 resize-none rounded-md border border-border bg-card px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground focus:border-foreground/30"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="size-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {groupOpen && (
        <NewGroupModal
          people={people}
          onClose={() => setGroupOpen(false)}
          onCreated={(id) => {
            setGroupOpen(false)
            loadConvs()
            setActive(id)
          }}
        />
      )}
    </Panel>
  )
}

function NewGroupModal({
  people,
  onClose,
  onCreated,
}: {
  people: MessagePerson[]
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return people
    return people.filter((p) => (p.name || p.phone).toLowerCase().includes(q))
  }, [people, search])

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit() {
    if (!title.trim() || picked.size === 0 || busy) return
    setBusy(true)
    try {
      const { id } = await createGroup(title.trim(), [...picked])
      onCreated(id)
    } catch {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[14px] font-semibold">New group</h2>
          <button
            onClick={onClose}
            className="grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Group name"
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-[13px] outline-none placeholder:text-muted-foreground focus:border-foreground/30"
          />
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people"
              className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[13px] outline-none placeholder:text-muted-foreground focus:border-foreground/30"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-[13px] text-muted-foreground">No members found.</p>
          ) : (
            filtered.map((p) => {
              const on = picked.has(p.userId)
              return (
                <button
                  key={p.userId}
                  onClick={() => toggle(p.userId)}
                  className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-muted"
                >
                  <EmployeeAvatar name={p.name || p.phone} className="size-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{p.name || p.phone}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">{p.role}</span>
                  </span>
                  <span
                    className={cn(
                      'grid size-5 shrink-0 place-items-center rounded-md border',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                    )}
                  >
                    {on && <Check className="size-3.5" />}
                  </span>
                </button>
              )
            })
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <span className="text-[12px] text-muted-foreground">{picked.size} selected</span>
          <button
            onClick={submit}
            disabled={!title.trim() || picked.size === 0 || busy}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create group
          </button>
        </div>
      </div>
    </div>
  )
}
