import { useEffect, useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import PersonAvatar from '@/components/admin/PersonAvatar'
import { useAuth } from '@/context/auth/AuthContext'
import { sound } from '@/lib/sound'
import { getMe, updateMe, type MeProfile } from '@/lib/api'
import { loadProfile } from '@/lib/profile'
import { type AvatarFullConfig } from 'react-nice-avatar'
import { Loading, PrimaryButton, Field, inputCls } from './ui'

export default function Profile() {
  const { user, updateUser } = useAuth()
  const [me, setMe] = useState<MeProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const avatar: AvatarFullConfig | undefined = me?.avatar
    ? (JSON.parse(me.avatar) as AvatarFullConfig)
    : user
      ? loadProfile(user.id).avatar
      : undefined

  useEffect(() => {
    getMe()
      .then(setMe)
      .catch((e) => setError((e as Error).message))
  }, [])

  const set = (patch: Partial<MeProfile>) => setMe((m) => (m ? { ...m, ...patch } : m))

  const save = async () => {
    if (!me) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const updated = await updateMe({
        name: me.name,
        email: me.email,
        title: me.title,
        timezone: me.timezone,
        workingHours: me.workingHours,
        phone: me.phone,
      })
      setMe(updated)
      updateUser({ name: updated.name, email: updated.email, phone: updated.phone })
      sound.success()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!me) {
    return (
      <Panel className="flex min-w-0 flex-1 flex-col">
        {error ? <p className="p-5 text-[13px] text-rose-600">{error}</p> : <Loading />}
      </Panel>
    )
  }

  return (
    <Panel className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="border-b border-border px-5 py-4">
        <h1 className="font-display text-base font-semibold tracking-tight">Profile</h1>
        <p className="text-[12px] text-muted-foreground">Manage your account details</p>
      </div>

      <div className="max-w-lg space-y-4 p-5">
        <div className="flex items-center gap-3">
          <PersonAvatar name={me.name || 'Me'} config={avatar} className="size-14" />
          <div>
            <div className="text-[15px] font-semibold">{me.name || 'Unnamed'}</div>
            <div className="text-[12px] text-muted-foreground">{me.phone}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><input value={me.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} /></Field>
          <Field label="Phone"><input value={me.phone} onChange={(e) => set({ phone: e.target.value })} className={inputCls} placeholder="+91…" /></Field>
        </div>
        <Field label="Email"><input value={me.email} onChange={(e) => set({ email: e.target.value })} className={inputCls} /></Field>
        <Field label="Title"><input value={me.title} onChange={(e) => set({ title: e.target.value })} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Timezone"><input value={me.timezone} onChange={(e) => set({ timezone: e.target.value })} className={inputCls} /></Field>
          <Field label="Working hours"><input value={me.workingHours} onChange={(e) => set({ workingHours: e.target.value })} className={inputCls} /></Field>
        </div>

        {error && <p className="text-[13px] text-rose-600">{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
            {saved ? 'Saved' : 'Save changes'}
          </PrimaryButton>
        </div>
      </div>
    </Panel>
  )
}
