import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import ImageUpload from '@/components/admin/ImageUpload'
import { useAuth } from '@/context/auth/AuthContext'
import { updateWorkspace } from '@/lib/api'

// Workspace logo + name — General tab.
export default function WorkspaceBranding() {
  const { activeWorkspace, addWorkspace } = useAuth()
  const wsId = activeWorkspace?.id ?? ''
  const isOwner = activeWorkspace?.role === 'Owner'

  const [wsName, setWsName] = useState(activeWorkspace?.name ?? '')
  const [savedName, setSavedName] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setWsName(activeWorkspace?.name ?? '')
  }, [activeWorkspace?.name])

  const saveBranding = async (patch: { name?: string; logo?: string }) => {
    if (!wsId || !isOwner) return
    try {
      const updated = await updateWorkspace(wsId, patch)
      addWorkspace(updated)
      if (patch.name !== undefined) {
        setSavedName(true)
        setTimeout(() => setSavedName(false), 1500)
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!isOwner) {
    return (
      <div className="rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold">Workspace</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{activeWorkspace?.name}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <h2 className="text-sm font-semibold">Workspace</h2>
      <p className="text-[13px] text-muted-foreground">
        Your logo and name appear in the sidebar and on payslips.
      </p>
      <div className="mt-3">
        <ImageUpload
          label="Company logo"
          hint="PNG, JPG or SVG · up to 5 MB"
          value={activeWorkspace?.logo || undefined}
          onChange={(url) => saveBranding({ logo: url })}
          prefix={`workspaces/${wsId}/logo`}
        />
      </div>
      <div className="mt-4">
        <label className="text-[11px] font-medium text-muted-foreground">
          Workspace name
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            value={wsName}
            onChange={(e) => setWsName(e.target.value)}
            className="h-9 w-64 rounded-md border border-input bg-card px-3 text-[13px] outline-none focus:border-ring"
          />
          <button
            onClick={() => saveBranding({ name: wsName.trim() })}
            disabled={!wsName.trim() || wsName.trim() === activeWorkspace?.name}
            className="btn-3d inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {savedName ? <Check className="size-4" /> : null}
            {savedName ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-[13px] text-rose-600">{error}</p>}
    </div>
  )
}
