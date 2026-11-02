// Workspace branding kept client-side (no DB columns yet), keyed by workspace id.
export interface WorkspaceSettings {
  logo?: string // data URL
  slug?: string
  onboarded?: boolean
}

const KEY = 'mh.workspaceSettings'

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

function readAll(): Record<string, WorkspaceSettings> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function loadWorkspaceSettings(id: string): WorkspaceSettings {
  return readAll()[id] ?? {}
}

export function saveWorkspaceSettings(id: string, patch: WorkspaceSettings): void {
  const all = readAll()
  all[id] = { ...all[id], ...patch }
  localStorage.setItem(KEY, JSON.stringify(all))
}
