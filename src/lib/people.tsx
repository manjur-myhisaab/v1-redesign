import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AvatarFullConfig } from 'react-nice-avatar'
import PersonAvatar from '@/components/admin/PersonAvatar'
import { useAuth } from '@/context/auth/AuthContext'
import { genderSex } from '@/lib/employees'
import { listEmployees } from '@/lib/api'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// People directory — a single workspace-wide source of truth for how a person
// renders, so the SAME employee shows the SAME avatar wherever they're
// mentioned (grids, kanban cards, comments, detail panels, …). Records across
// the app usually only carry an employee *name*, so we resolve gender from the
// employee directory keyed by normalised name (and by id when available).
// ---------------------------------------------------------------------------

export interface ResolvedPerson {
  name: string
  sex?: 'man' | 'woman'
  config?: AvatarFullConfig
  avatar?: string | null
}

interface PeopleCtx {
  resolve: (key: { id?: string | null; name?: string | null }) => ResolvedPerson
}

const Ctx = createContext<PeopleCtx | null>(null)

const norm = (s: string) => s.trim().toLowerCase()

export function PeopleProvider({ children }: { children: ReactNode }) {
  const { activeWorkspace } = useAuth()
  const wsId = activeWorkspace?.id
  const [byId, setById] = useState<Map<string, ResolvedPerson>>(new Map())
  const [byName, setByName] = useState<Map<string, ResolvedPerson>>(new Map())

  useEffect(() => {
    if (!wsId) return
    let cancelled = false
    listEmployees()
      .then((employees) => {
        if (cancelled) return
        const ids = new Map<string, ResolvedPerson>()
        const names = new Map<string, ResolvedPerson>()
        for (const e of employees) {
          const rawAv = (e as any).avatar || (e as any).rawUser?.avatar
          const person: ResolvedPerson = {
            name: e.name,
            sex: genderSex(e.gender),
            avatar: typeof rawAv === 'string' ? rawAv : null,
          }
          ids.set(e.id, person)
          if (e.name) names.set(norm(e.name), person)
        }
        setById(ids)
        setByName(names)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [wsId])

  const value = useMemo<PeopleCtx>(
    () => ({
      resolve: ({ id, name }) => {
        if (id) {
          const p = byId.get(id)
          if (p) return p
        }
        if (name) {
          const p = byName.get(norm(name))
          if (p) return p
          return { name }
        }
        return { name: name ?? '' }
      },
    }),
    [byId, byName],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePeople(): PeopleCtx {
  // tolerate being used outside a provider (e.g. isolated previews): fall back
  // to identity resolution so avatars still render, just without directory gender
  return (
    useContext(Ctx) ?? {
      resolve: ({ name }) => ({ name: name ?? '' }),
    }
  )
}

// ---------------------------------------------------------------------------
// EmployeeAvatar — context-aware avatar.
// 1. If an actual avatar image exists (UUID, asset path, or URL), renders real photo.
// 2. If it fails to load or no image exists, cleanly falls back to PersonAvatar
//    (illustrated deterministic avatar based on name and gender).
// ---------------------------------------------------------------------------

export function EmployeeAvatar({
  name,
  employeeId,
  sex,
  config,
  avatar,
  avatarUrl,
  className,
}: {
  name?: string | null
  employeeId?: string | null
  sex?: 'man' | 'woman'
  config?: AvatarFullConfig
  avatar?: string | null
  avatarUrl?: string | null
  className?: string
}) {
  const { resolve } = usePeople()
  const p = resolve({ id: employeeId, name })
  const rawAvatar = avatarUrl || avatar || p.avatar

  const [hasError, setHasError] = useState(false)

  // Parse raw avatar if JSON or resolve to Directus / remote image URL
  const { parsedConfig, resolvedImgUrl } = useMemo(() => {
    let cfg: AvatarFullConfig | undefined = undefined
    let img: string | null = null

    if (rawAvatar && typeof rawAvatar === 'string') {
      const trimmed = rawAvatar.trim()
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          cfg = JSON.parse(trimmed)
        } catch {
          // not valid json
        }
      }
      if (!cfg) {
        if (
          trimmed.startsWith('http://') ||
          trimmed.startsWith('https://') ||
          trimmed.startsWith('data:') ||
          trimmed.startsWith('blob:')
        ) {
          img = trimmed
        } else {
          const cleanId = trimmed.replace(/^.*\/assets\//, '').replace(/^\/?assets\//, '')
          if (cleanId && cleanId.length > 2) {
            const base = (
              import.meta.env.VITE_ATTENDANCE_SERVER_URL ||
              import.meta.env.VITE_API_URL ||
              'https://cozybear.myhisaab.com'
            ).replace(/\/+$/, '')
            img = `${base}/assets/${cleanId}`
          }
        }
      }
    }

    return { parsedConfig: cfg, resolvedImgUrl: img }
  }, [rawAvatar])

  // Reset error flag if image source changes
  useEffect(() => {
    setHasError(false)
  }, [resolvedImgUrl])

  // If a valid image URL exists and hasn't errored, show the real photo
  if (resolvedImgUrl && !hasError) {
    return (
      <div
        className={cn(
          'size-6 shrink-0 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-gray-200/60 dark:border-border/60',
          className,
        )}
      >
        <img
          src={resolvedImgUrl}
          alt={p.name || name || 'Avatar'}
          className="size-full object-cover rounded-full"
          onError={() => setHasError(true)}
          loading="lazy"
        />
      </div>
    )
  }

  // Fallback to the illustrated deterministic avatar
  return (
    <PersonAvatar
      name={p.name || name || '?'}
      sex={sex ?? p.sex}
      config={config ?? parsedConfig ?? p.config}
      className={className}
    />
  )
}
