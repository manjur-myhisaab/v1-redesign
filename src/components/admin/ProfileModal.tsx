import { useEffect, useState } from 'react'
import { X, Clock, Pencil, ChevronDown } from 'lucide-react'
import { genConfig, type AvatarFullConfig } from 'react-nice-avatar'
import PersonAvatar from './PersonAvatar'
import { useAuth } from '@/context/auth/AuthContext'
import { loadProfile, saveProfile, TIMEZONES } from '@/lib/profile'
import { updateMe } from '@/lib/api'
import { sound } from '@/lib/sound'
import { COUNTRIES, DEFAULT_COUNTRY } from '@/lib/countries'
import { cn } from '@/lib/utils'

// split a stored E.164 number into a country + national part (longest dial match)
function splitPhone(e164?: string): { iso: string; national: string } {
  if (!e164) return { iso: DEFAULT_COUNTRY.iso, national: '' }
  const match = [...COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => e164.startsWith(c.dial))
  if (match) return { iso: match.iso, national: e164.slice(match.dial.length) }
  return { iso: DEFAULT_COUNTRY.iso, national: e164.replace(/^\+/, '') }
}

interface ProfileModalProps {
  onClose: () => void
}

const labelCls = 'text-[13px] font-medium text-muted-foreground'
const fieldCls =
  'h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none transition-colors focus:border-ring'

export default function ProfileModal({ onClose }: ProfileModalProps) {
  const { user, updateUser } = useAuth()
  const userId = user?.id ?? 'me'
  const initial = loadProfile(userId)

  const parsedPhone = splitPhone(user?.phone)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [iso, setIso] = useState(parsedPhone.iso)
  const [phoneNum, setPhoneNum] = useState(parsedPhone.national)
  const [timezone, setTimezone] = useState(initial.timezone)
  const [workingHours, setWorkingHours] = useState(initial.workingHours)
  const [title, setTitle] = useState(initial.title)
  const [avatar, setAvatar] = useState<AvatarFullConfig>(
    initial.avatar ?? genConfig(user?.name || userId),
  )
  const [closing, setClosing] = useState(false)

  const lastUpdated = initial.updatedAt
    ? new Date(initial.updatedAt)
    : null

  const requestClose = () => setClosing(true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const country = COUNTRIES.find((c) => c.iso === iso) ?? DEFAULT_COUNTRY
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (saving) return
    setSaving(true)
    const now = new Date().toISOString()
    const phone = phoneNum ? `${country.dial}${phoneNum}` : user?.phone ?? ''
    // write-through local cache for instant UI
    saveProfile(userId, { title, timezone, workingHours, avatar, updatedAt: now })
    updateUser({ name, email, phone })
    // persist to the server (source of truth)
    try {
      await updateMe({
        name,
        email,
        phone,
        title,
        timezone,
        workingHours,
        avatar: JSON.stringify(avatar),
      })
    } catch {
      /* local cache still holds the change */
    }
    sound.success()
    requestClose()
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div
        onClick={requestClose}
        className={cn(
          'absolute inset-0 bg-black/40 duration-200',
          closing ? 'animate-out fade-out' : 'animate-in fade-in',
        )}
      />

      <div
        onAnimationEnd={() => closing && onClose()}
        className={cn(
          'relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl duration-200 ease-out',
          closing
            ? 'animate-out fade-out zoom-out-95 slide-out-to-bottom-2'
            : 'animate-in fade-in zoom-in-95 slide-in-from-bottom-2',
        )}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Edit your profile
          </h2>
          <button
            onClick={requestClose}
            aria-label="Close"
            className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* body: form | preview */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_240px]">
          {/* form */}
          <div className="space-y-4 p-5">
            <div className="space-y-1.5">
              <label className={labelCls}>Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Phone number</label>
              <div className="flex gap-2">
                <div className="relative shrink-0">
                  <div className="flex h-10 items-center gap-1.5 rounded-xl border border-input bg-card px-3 text-sm">
                    <span>{country.flag}</span>
                    <span className="text-muted-foreground">{country.dial}</span>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </div>
                  <select
                    aria-label="Country"
                    value={iso}
                    onChange={(e) => {
                      const next =
                        COUNTRIES.find((c) => c.iso === e.target.value) ?? DEFAULT_COUNTRY
                      setIso(next.iso)
                      setPhoneNum((p) => p.slice(0, next.maxLen))
                    }}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.iso} value={c.iso}>
                        {c.name} ({c.dial})
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  inputMode="numeric"
                  value={phoneNum}
                  maxLength={country.maxLen}
                  onChange={(e) =>
                    setPhoneNum(e.target.value.replace(/\D/g, '').slice(0, country.maxLen))
                  }
                  placeholder="Phone number"
                  className={`${fieldCls} flex-1`}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls}>Timezone</label>
                <div className="relative">
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className={`${fieldCls} cursor-pointer appearance-none pr-8`}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz}>{tz}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Working hours</label>
                <div className="relative">
                  <input
                    value={workingHours}
                    onChange={(e) => setWorkingHours(e.target.value)}
                    className={`${fieldCls} pr-8`}
                  />
                  <Clock className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldCls} />
            </div>
          </div>

          {/* preview */}
          <div className="flex flex-col items-center gap-2 border-t border-border p-5 text-center sm:border-l sm:border-t-0">
            <span className={`${labelCls} self-center`}>Preview</span>
            <div className="relative mt-1">
              <PersonAvatar name={name || 'You'} config={avatar} className="size-20" />
              <button
                type="button"
                onClick={() => setAvatar(genConfig())}
                aria-label="Change avatar"
                className="absolute -bottom-0.5 -right-0.5 grid size-7 cursor-pointer place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
            <div className="mt-1 text-base font-semibold tracking-tight">
              {name || 'Your name'}
            </div>
            {title && <div className="text-[13px] text-muted-foreground">{title}</div>}
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              {workingHours}
            </span>
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-4">
          <span className="text-[13px] text-muted-foreground">
            {lastUpdated
              ? `Last updated: ${lastUpdated.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}`
              : 'Not saved yet'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={requestClose}
              className="h-9 cursor-pointer rounded-full border border-border bg-card px-4 text-[13px] font-medium transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="btn-3d h-9 cursor-pointer rounded-full bg-foreground px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
