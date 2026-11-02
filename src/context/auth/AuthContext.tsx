import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'

import { authApi } from '@/features/auth/api/authApi'

export interface WorkspaceRef {
  id: string
  name: string
  role: string
  plan?: string
  logo?: string
  slug?: string
}

export interface SessionUser {
  id: string
  phone: string
  name: string
  email?: string
  isSuperAdmin?: boolean
  role?: string[] | string
  roles?: any[]
  firm_name?: string
  firm_id?: string
  [key: string]: any
}

interface AuthState {
  token: string | null
  user: SessionUser | null
  workspaces: WorkspaceRef[]
  activeWorkspaceId: string | null
}

interface AuthContextValue extends AuthState {
  activeWorkspace: WorkspaceRef | null
  setSession: (token: string, user: SessionUser, workspaces: WorkspaceRef[]) => void
  setActiveWorkspace: (id: string) => void
  addWorkspace: (ws: WorkspaceRef) => void
  updateUser: (patch: Partial<SessionUser>) => void
  logout: () => void | Promise<void>
}

// localStorage keys (also read by src/lib/api.ts for request headers)
const K = {
  token: 'mh.token',
  user: 'mh.user',
  workspaces: 'mh.workspaces',
  activeWs: 'mh.activeWs',
}

function load(): AuthState {
  try {
    const token = localStorage.getItem(K.token)
    const user = JSON.parse(localStorage.getItem(K.user) ?? 'null')
    const workspaces = JSON.parse(localStorage.getItem(K.workspaces) ?? '[]')
    const activeWorkspaceId = localStorage.getItem(K.activeWs)
    return { token, user, workspaces, activeWorkspaceId }
  } catch {
    return { token: null, user: null, workspaces: [], activeWorkspaceId: null }
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(load)

  const setSession = useCallback(
    (token: string, user: SessionUser, workspaces: WorkspaceRef[]) => {
      const activeWorkspaceId = workspaces[0]?.id ?? null
      localStorage.setItem(K.token, token)
      localStorage.setItem(K.user, JSON.stringify(user))
      localStorage.setItem(K.workspaces, JSON.stringify(workspaces))
      if (activeWorkspaceId) localStorage.setItem(K.activeWs, activeWorkspaceId)
      else localStorage.removeItem(K.activeWs)

      // Sync user and workspace data with the mock database so mock queries return correct details
      try {
        const mockDbStr = localStorage.getItem('mh.mock.db')
        if (mockDbStr) {
          const db = JSON.parse(mockDbStr)
          if (db && db.me) {
            db.me.id = user.id || db.me.id
            db.me.name = user.name || db.me.name
            db.me.phone = user.phone || db.me.phone
            db.me.email = user.email || db.me.email

            if (workspaces && workspaces.length > 0) {
              db.workspaces = workspaces.map((w) => ({
                id: w.id,
                name: w.name,
                role: w.role.toLowerCase(),
                plan: w.plan || 'pro',
                logo: w.logo || '',
                slug: w.slug || w.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
              }))
            }
            localStorage.setItem('mh.mock.db', JSON.stringify(db))
          }
        }
      } catch (err) {
        console.error('Failed to sync mock db with session:', err)
      }

      setState({ token, user, workspaces, activeWorkspaceId })
    },
    [],
  )

  const setActiveWorkspace = useCallback((id: string) => {
    localStorage.setItem(K.activeWs, id)
    setState((s) => ({ ...s, activeWorkspaceId: id }))
  }, [])

  const addWorkspace = useCallback((ws: WorkspaceRef) => {
    setState((s) => {
      const workspaces = [...s.workspaces.filter((w) => w.id !== ws.id), ws]
      localStorage.setItem(K.workspaces, JSON.stringify(workspaces))
      localStorage.setItem(K.activeWs, ws.id)
      return { ...s, workspaces, activeWorkspaceId: ws.id }
    })
  }, [])

  const updateUser = useCallback((patch: Partial<SessionUser>) => {
    setState((s) => {
      if (!s.user) return s
      const user = { ...s.user, ...patch }
      localStorage.setItem(K.user, JSON.stringify(user))
      return { ...s, user }
    })
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
      toast.success('Logged out successfully')
    } catch (err) {
      console.error('Logout API failed:', err)
    } finally {
      Object.values(K).forEach((k) => localStorage.removeItem(k))
      localStorage.removeItem('mh.mock.db') // reset mock db on logout to prevent caching old state
      setState({ token: null, user: null, workspaces: [], activeWorkspaceId: null })
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      activeWorkspace:
        state.workspaces.find((w) => w.id === state.activeWorkspaceId) ?? null,
      setSession,
      setActiveWorkspace,
      addWorkspace,
      updateUser,
      logout,
    }),
    [state, setSession, setActiveWorkspace, addWorkspace, updateUser, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
