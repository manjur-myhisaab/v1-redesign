import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from '@/lib/api'

const POLL_MS = 60_000

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // poll the unread badge in the background
  useEffect(() => {
    let alive = true
    const tick = () => getUnreadCount().then((n) => alive && setUnread(n)).catch(() => {})
    tick()
    const id = setInterval(tick, POLL_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  // close on outside click
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      setLoading(true)
      getNotifications()
        .then((rows) => {
          setItems(rows)
          setUnread(rows.filter((r) => !r.read).length)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }

  const openItem = async (n: Notification) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      setUnread((u) => Math.max(0, u - 1))
      markNotificationRead(n.id).catch(() => {})
    }
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  const markAll = () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })))
    setUnread(0)
    markAllNotificationsRead().catch(() => {})
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={toggle}
        className="relative grid size-7 cursor-pointer place-items-center rounded-md text-white/90 transition-colors hover:bg-white/15 hover:text-white"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[15px] place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold leading-[15px] text-white ring-2 ring-white/70">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-80 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-[13px] font-medium">Notifications</span>
            {items.some((i) => !i.read) && (
              <button
                type="button"
                onClick={markAll}
                className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Check className="size-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                You're all caught up.
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openItem(n)}
                  className={cn(
                    'flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/50',
                    !n.read && 'bg-blue-50/60',
                  )}
                >
                  {!n.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-blue-500" />}
                  <span className={cn('min-w-0 flex-1', n.read && 'pl-3.5')}>
                    <span className="block text-[13px] font-medium leading-snug">{n.title}</span>
                    {n.body && (
                      <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                        {n.body}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
