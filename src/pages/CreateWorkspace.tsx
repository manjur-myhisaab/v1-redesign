import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { createWorkspace } from '@/lib/api'
import { useAuth } from '@/context/auth/AuthContext'

export default function CreateWorkspace() {
  const navigate = useNavigate()
  const { token, addWorkspace } = useAuth()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!token) {
    navigate('/login', { replace: true })
    return null
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const ws = await createWorkspace(name.trim())
      addWorkspace(ws)
      // navigate('/admin/dashboard', { replace: true })
      navigate('/admin/employees', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <div className="w-full max-w-sm">
        <img
          src="/payroll-logo-512.png"
          alt="myHisaab Payroll"
          className="size-10 rounded-lg"
        />
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight">
          Create your workspace
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up your company workspace to manage attendance and payroll.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="ws" className="block text-sm font-medium">
              Workspace name
            </label>
            <input
              id="ws"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Pvt Ltd"
              className="mt-1.5 w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
          {error && <p className="text-[13px] text-rose-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={!name.trim() || busy}>
            {busy ? 'Creating…' : 'Create workspace'}
          </Button>
        </form>
      </div>
    </div>
  )
}
