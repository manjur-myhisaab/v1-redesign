import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Trash2, Shield, X, Pencil, Check } from 'lucide-react'
import { EmployeeAvatar } from '@/lib/people'
import UpgradeModal from '@/components/admin/UpgradeModal'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import {
  listMembers, addMember, updateMemberRole, removeMember,
  getRoles, createRole, updateRole, deleteRole,
  type Member, type Paywall, type RolesPayload, type RoleDef, type PermAction,
} from '@/lib/api'

export default function TeamMembers() {
  const { activeWorkspace } = useAuth()
  const wsId = activeWorkspace?.id ?? ''
  const canManage = activeWorkspace?.role === 'Owner' || activeWorkspace?.role === 'Admin'

  const [members, setMembers] = useState<Member[]>([])
  const [roles, setRoles] = useState<RolesPayload | null>(null)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('Member')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [paywall, setPaywall] = useState<Paywall | null>(null)
  const [rolesOpen, setRolesOpen] = useState(false)

  const reloadMembers = () => { if (wsId) listMembers(wsId).then(setMembers).catch(() => {}) }
  const reloadRoles = () => { if (wsId) getRoles(wsId).then(setRoles).catch(() => {}) }
  useEffect(() => { reloadMembers(); reloadRoles() }, [wsId])

  const roleNames = [
    ...(roles?.builtin.map((r) => r.name).filter((n) => n !== 'Owner') ?? ['Admin', 'Manager', 'Member']),
    ...(roles?.custom.map((r) => r.name) ?? []),
  ]

  const doAdd = async (): Promise<boolean> => {
    const e164 = phone.startsWith('+') ? phone : `+${phone}`
    if (e164.length <= 3) return false
    try {
      await addMember(wsId, { phone: e164, name, role })
      reloadMembers()
      setPhone(''); setName('')
      return true
    } catch (err) {
      const e = err as Error & { status?: number; payload?: { paywall?: Paywall } }
      if (e.status === 402 && e.payload?.paywall) setPaywall(e.payload.paywall)
      else setError(e.message)
      return false
    }
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('')
    if (busy) return
    setBusy(true); await doAdd(); setBusy(false)
  }
  const changeRole = async (m: Member, r: string) => {
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, role: r } : x)))
    await updateMemberRole(wsId, m.id, r).catch(reloadMembers)
  }
  const remove = async (m: Member) => {
    if (!confirm(`Remove ${m.name || m.phone}?`)) return
    await removeMember(wsId, m.id).then(reloadMembers).catch((e) => alert((e as Error).message))
  }

  return (
    <div className="max-w-3xl space-y-5">
      {/* members */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Team members</h2>
          {canManage && (
            <button onClick={() => setRolesOpen(true)} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12px] font-medium transition-colors hover:bg-muted">
              <Shield className="size-3.5" /> Roles & permissions
            </button>
          )}
        </div>
        <div className="divide-y divide-border rounded-xl border border-border">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <EmployeeAvatar name={m.name || m.phone} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.name || '—'}</div>
                <div className="truncate text-xs text-muted-foreground">{m.phone}</div>
              </div>
              {m.role === 'Owner' || !canManage ? (
                <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', m.role === 'Owner' ? 'bg-violet-50 text-violet-700 ring-violet-600/15' : 'bg-blue-50 text-blue-700 ring-blue-600/15')}>{m.role}</span>
              ) : (
                <>
                  <select value={m.role} onChange={(e) => changeRole(m, e.target.value)} className="h-8 cursor-pointer rounded-md border border-border bg-card px-2 text-[12px] outline-none focus:border-ring">
                    {!roleNames.includes(m.role) && <option value={m.role}>{m.role}</option>}
                    {roleNames.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button onClick={() => remove(m)} className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-rose-600" aria-label="Remove">
                    <Trash2 className="size-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
          {members.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">No members yet.</div>}
        </div>
      </div>

      {canManage && (
        <form onSubmit={submit}>
          <h2 className="text-sm font-semibold">Add a team member</h2>
          <p className="text-[13px] text-muted-foreground">Free plan includes the owner + 1 member. Beyond that, ₹365 + GST per member.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+9198…" className="h-9 w-40 rounded-md border border-input bg-card px-3 text-[13px] outline-none focus:border-ring" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="h-9 w-40 rounded-md border border-input bg-card px-3 text-[13px] outline-none focus:border-ring" />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-[13px] outline-none focus:border-ring">
              {roleNames.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button type="submit" disabled={busy || !phone} className="btn-3d inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground disabled:opacity-50">
              <Plus className="size-4" /> Add member
            </button>
          </div>
          {error && <p className="mt-2 text-[13px] text-rose-600">{error}</p>}
        </form>
      )}

      {rolesOpen && roles && (
        <RolesModal wsId={wsId} roles={roles} onClose={() => setRolesOpen(false)} onChanged={reloadRoles} />
      )}

      {paywall && (
        <UpgradeModal
          workspaceId={wsId} workspaceName={activeWorkspace?.name} paywall={paywall}
          onClose={() => setPaywall(null)}
          onSuccess={async () => { setPaywall(null); setError(''); await doAdd() }}
        />
      )}
    </div>
  )
}

function RolesModal({ wsId, roles, onClose, onChanged }: { wsId: string; roles: RolesPayload; onClose: () => void; onChanged: () => void }) {
  const [editing, setEditing] = useState<RoleDef | 'new' | null>(null)

  const del = async (r: RoleDef) => {
    if (!r.id || !confirm(`Delete role "${r.name}"?`)) return
    await deleteRole(wsId, r.id)
    sound.click()
    onChanged()
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">Roles & permissions</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-4" /></button>
        </div>

        {editing ? (
          <RoleEditor
            wsId={wsId}
            resources={roles.resources}
            role={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); onChanged() }}
          />
        ) : (
          <div className="space-y-4 p-5">
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Built-in roles</div>
              <div className="space-y-1.5">
                {roles.builtin.map((r) => (
                  <div key={r.name} className="rounded-lg border border-border px-3 py-2">
                    <div className="text-[13px] font-medium">{r.name}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{summarize(r, roles.resources)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Custom roles</span>
                <button onClick={() => setEditing('new')} className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md bg-foreground px-2.5 text-[12px] font-medium text-background hover:opacity-90"><Plus className="size-3" /> New role</button>
              </div>
              {roles.custom.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-6 text-center text-[13px] text-muted-foreground">No custom roles yet.</div>
              ) : (
                <div className="space-y-1.5">
                  {roles.custom.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium">{r.name}</div>
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{summarize(r, roles.resources)}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditing(r)} className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="size-3.5" /></button>
                        <button onClick={() => del(r)} className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-rose-600"><Trash2 className="size-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function summarize(r: RoleDef, resources: { key: string; label: string }[]): string {
  const manage = resources.filter((res) => (r.permissions[res.key] ?? []).includes('manage')).map((res) => res.label)
  const view = resources.filter((res) => (r.permissions[res.key] ?? []).includes('view') && !(r.permissions[res.key] ?? []).includes('manage')).map((res) => res.label)
  const parts: string[] = []
  if (manage.length) parts.push(`Manage: ${manage.join(', ')}`)
  if (view.length) parts.push(`View: ${view.join(', ')}`)
  return parts.join(' · ') || 'No access'
}

function RoleEditor({ wsId, resources, role, onClose, onSaved }: {
  wsId: string
  resources: { key: string; label: string }[]
  role: RoleDef | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(role?.name ?? '')
  const [perms, setPerms] = useState<Record<string, PermAction[]>>(role?.permissions ?? {})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const has = (res: string, a: PermAction) => (perms[res] ?? []).includes(a)
  const toggle = (res: string, a: PermAction) => setPerms((p) => {
    const cur = new Set(p[res] ?? [])
    if (cur.has(a)) cur.delete(a)
    else { cur.add(a); if (a === 'manage') cur.add('view') } // manage implies view
    if (a === 'view' && !cur.has('view')) cur.delete('manage') // unview removes manage
    return { ...p, [res]: [...cur] as PermAction[] }
  })

  const save = async () => {
    if (!name.trim()) { setError('Name the role'); return }
    setBusy(true); setError('')
    try {
      if (role?.id) await updateRole(wsId, role.id, { name: name.trim(), permissions: perms })
      else await createRole(wsId, name.trim(), perms)
      sound.success()
      onSaved()
    } catch (e) { setError((e as Error).message); setBusy(false) }
  }

  return (
    <div className="space-y-4 p-5">
      <label className="block space-y-1">
        <span className="text-[12px] font-medium text-muted-foreground">Role name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HR Manager, Finance" className="h-9 w-full max-w-xs rounded-lg border border-border bg-card px-2.5 text-[13px] outline-none focus:border-ring" />
      </label>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-2 text-left font-medium">Module</th><th className="px-3 py-2 text-center font-medium">View</th><th className="px-3 py-2 text-center font-medium">Manage</th></tr>
          </thead>
          <tbody>
            {resources.map((res) => (
              <tr key={res.key} className="border-t border-border">
                <td className="px-3 py-2">{res.label}</td>
                <td className="px-3 py-2 text-center"><input type="checkbox" checked={has(res.key, 'view')} onChange={() => toggle(res.key, 'view')} className="size-4 cursor-pointer accent-[#2f63d8]" /></td>
                <td className="px-3 py-2 text-center"><input type="checkbox" checked={has(res.key, 'manage')} onChange={() => toggle(res.key, 'manage')} className="size-4 cursor-pointer accent-[#2f63d8]" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="h-9 cursor-pointer rounded-lg border border-border bg-card px-4 text-[13px] font-medium hover:bg-muted">Cancel</button>
        <button onClick={save} disabled={busy} className="btn-3d inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-60">
          <Check className="size-4" /> Save role
        </button>
      </div>
    </div>
  )
}
