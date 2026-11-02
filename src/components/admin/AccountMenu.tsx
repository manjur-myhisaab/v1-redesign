import { useEffect, useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User,
  Settings,
  CreditCard,
  Code,
  Contrast,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Volume2,
  VolumeX,
  Shield,
  LifeBuoy,
} from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'
import PersonAvatar from './PersonAvatar'
import ProfileModal from './ProfileModal'
import { useAuth } from '@/context/auth/AuthContext'
import { sound } from '@/lib/sound'
import { loadProfile } from '@/lib/profile'
import { createSupportTicket } from '@/lib/api'

export default function AccountMenu() {
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [soundOn, setSoundOn] = useState(!sound.isMuted())
  const navigate = useNavigate()
  const { user, activeWorkspace, logout } = useAuth()
  const displayName = user?.name || user?.phone || 'Account'
  const subtitle = activeWorkspace?.name ?? user?.phone ?? ''
  const avatar = user ? loadProfile(user.id).avatar : undefined

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Account"
        onClick={() => setOpen((o) => !o)}
        className="block cursor-pointer rounded-full ring-2 ring-transparent transition-shadow hover:ring-white/60"
      >
        <PersonAvatar name={displayName} config={avatar} className="size-7" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-xl duration-150 animate-in fade-in slide-in-from-top-1">
            {/* header */}
            <div className="flex items-center gap-2.5 p-3.5">
              <PersonAvatar name={displayName} config={avatar} className="size-10" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold tracking-tight">
                  {displayName}
                </div>
                <div className="truncate text-[13px] text-muted-foreground">
                  {subtitle}
                </div>
              </div>
            </div>

            {/* menu */}
            <div className="px-2 pb-2">
              <MenuItem
                icon={User}
                label="Profile"
                onClick={() => {
                  setOpen(false)
                  setProfileOpen(true)
                }}
              />
              <MenuItem icon={Settings} label="Settings" onClick={() => navigate('/admin/settings')} />
              <MenuItem icon={CreditCard} label="Subscriptions" />
              <MenuItem
                icon={LifeBuoy}
                label="Help & support"
                onClick={() => {
                  setOpen(false)
                  setSupportOpen(true)
                }}
              />
              {user?.isSuperAdmin && (
                <MenuItem icon={Shield} label="Platform admin" onClick={() => navigate('/superadmin')} />
              )}
              <MenuItem icon={Code} label="Developers" />

              <div className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-[13px]">
                <span className="flex items-center gap-2.5">
                  <Contrast className="size-4 text-muted-foreground" />
                  Appearance
                </span>
                <span className="flex items-center gap-0.5 rounded-full bg-muted p-0.5">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    aria-label="Light"
                    title="Light theme"
                    className={cn(
                      'grid size-5 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors',
                      theme === 'light' && 'bg-background text-foreground shadow-sm',
                    )}
                  >
                    <Sun className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    aria-label="Dark"
                    title="Dark theme"
                    className={cn(
                      'grid size-5 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors',
                      theme === 'dark' && 'bg-background text-foreground shadow-sm',
                    )}
                  >
                    <Moon className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('system')}
                    aria-label="System"
                    title="System theme"
                    className={cn(
                      'grid size-5 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors',
                      theme === 'system' && 'bg-background text-foreground shadow-sm',
                    )}
                  >
                    <Monitor className="size-3" />
                  </button>
                </span>
              </div>

              <button
                type="button"
                data-no-sound
                onClick={() => {
                  const next = !soundOn
                  setSoundOn(next)
                  sound.setMuted(!next)
                  if (next) sound.toggle()
                }}
                className="flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] transition-colors hover:bg-muted"
              >
                <span className="flex items-center gap-2.5">
                  {soundOn ? (
                    <Volume2 className="size-4 text-muted-foreground" />
                  ) : (
                    <VolumeX className="size-4 text-muted-foreground" />
                  )}
                  Sound
                </span>
                <span className="text-muted-foreground">{soundOn ? 'On' : 'Off'}</span>
              </button>

              <MenuItem
                icon={LogOut}
                label="Logout"
                danger
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
              />
            </div>
          </div>
        </>
      )}

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
      {supportOpen && <SupportModal onClose={() => setSupportOpen(false)} />}
    </div>
  )
}

function SupportModal({ onClose }: { onClose: () => void }) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!subject.trim() || !message.trim()) return
    setBusy(true)
    try {
      await createSupportTicket(subject.trim(), message.trim())
      sound.success()
      setSent(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl">
        <h2 className="font-display text-lg font-semibold tracking-tight">Help & support</h2>
        {sent ? (
          <div className="py-6 text-center">
            <p className="text-[14px] font-medium">Thanks — we've got your message.</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Our team will get back to you soon.</p>
            <button onClick={onClose} className="mt-4 cursor-pointer rounded-lg bg-foreground px-4 py-2 text-[13px] font-medium text-background hover:opacity-90">Done</button>
          </div>
        ) : (
          <>
            <p className="mt-1 text-[13px] text-muted-foreground">Tell us what's going on and we'll help.</p>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="mt-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-ring" />
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your issue…" rows={4} className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-ring" />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={onClose} className="h-9 cursor-pointer rounded-lg border border-border bg-card px-4 text-[13px] font-medium hover:bg-muted">Cancel</button>
              <button onClick={submit} disabled={busy || !subject.trim() || !message.trim()} className="h-9 cursor-pointer rounded-lg bg-foreground px-4 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-60">
                {busy ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  active,
  danger,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  active?: boolean
  danger?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
        danger
          ? 'text-rose-600 hover:bg-rose-50'
          : active
            ? 'bg-muted font-medium'
            : 'hover:bg-muted',
      )}
    >
      <Icon className={cn('size-4', !danger && 'text-muted-foreground')} />
      {label}
    </button>
  )
}
