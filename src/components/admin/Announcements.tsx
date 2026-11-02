import { useEffect, useState } from 'react'
import { Megaphone, Pin, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import { getAnnouncements, postAnnouncement, deleteAnnouncement, type Announcement } from '@/lib/api'

const ago = (s: string) => {
  const diff = Date.now() - new Date(s).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d > 0) return `${d}d ago`
  const h = Math.floor(diff / 3_600_000)
  if (h > 0) return `${h}h ago`
  const m = Math.floor(diff / 60_000)
  return m > 0 ? `${m}m ago` : 'just now'
}

export default function Announcements() {
  const { activeWorkspace } = useAuth()
  const canPost = ['Owner', 'Admin', 'Manager'].includes(activeWorkspace?.role ?? '')
  const [items, setItems] = useState<Announcement[]>([])
  const [open, setOpen] = useState(false)

  const load = () => getAnnouncements().then(setItems).catch(() => {})
  useEffect(() => { load() }, [])

  const remove = async (id: string) => { await deleteAnnouncement(id); load() }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-medium"><Megaphone className="size-4 text-[#2f63d8]" /> Notice board</h2>
        {canPost && (
          <button onClick={() => setOpen(true)} className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border bg-card px-2 text-[12px] font-medium transition-colors hover:bg-muted">
            <Plus className="size-3" /> Post
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-muted-foreground">No announcements yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 5).map((a) => (
            <li key={a.id} className="group rounded-lg border border-border px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[13px] font-medium">
                    {a.pinned && <Pin className="size-3 text-amber-500" />}
                    {a.title}
                  </div>
                  {a.body && <p className="mt-0.5 text-[12px] text-muted-foreground">{a.body}</p>}
                  <div className="mt-0.5 text-[11px] text-muted-foreground/70">{ago(a.createdAt)}</div>
                </div>
                {canPost && (
                  <button onClick={() => remove(a.id)} className="grid size-6 shrink-0 cursor-pointer place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"><Trash2 className="size-3" /></button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && <PostModal onClose={() => setOpen(false)} onDone={() => { setOpen(false); load() }} />}
    </div>
  )
}

function PostModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pinned, setPinned] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!title.trim()) return
    setBusy(true)
    try { await postAnnouncement({ title: title.trim(), body: body.trim(), pinned }); sound.success(); onDone() }
    finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">New announcement</h2>
          <button onClick={onClose} className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="mb-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-ring" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message (optional)" rows={4} className="mb-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-ring" />
        <label className="mb-3 flex cursor-pointer items-center gap-2 text-[13px]">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="size-3.5 cursor-pointer accent-[#2f63d8]" /> Pin to top
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-9 cursor-pointer rounded-lg border border-border bg-card px-4 text-[13px] font-medium hover:bg-muted">Cancel</button>
          <button onClick={submit} disabled={busy || !title.trim()} className={cn('h-9 cursor-pointer rounded-lg bg-foreground px-4 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-60')}>Post</button>
        </div>
      </div>
    </div>
  )
}
