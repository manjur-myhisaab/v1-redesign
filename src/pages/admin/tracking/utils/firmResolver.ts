import { formatDistanceToNow } from 'date-fns'

/**
 * Extracts firm ID from nested structures or primitive values
 */
export const extractFirmId = (obj: any): string | null => {
  if (!obj) return null
  if (typeof obj === 'string' || typeof obj === 'number') return String(obj)
  if (typeof obj === 'object') {
    if (obj.firm_id) return extractFirmId(obj.firm_id)
    if (obj.id) return String(obj.id)
  }
  return null
}

/**
 * Robust fallback resolution for firm ID across user context, workspace, and localStorage
 */
export const resolveFirmId = (user: any, activeWorkspace?: any, fetchedUsers: any[] = []): string | null => {
  let id = extractFirmId(user?.firm_id) || extractFirmId(user?.firm) || extractFirmId(activeWorkspace?.id)
  if (id) return id

  try {
    const localUserData = JSON.parse(localStorage.getItem('userData') || '{}')
    id = extractFirmId(localUserData?.firm_id) || extractFirmId(localUserData?.firm)
    if (id) return id
  } catch {}

  try {
    const localUser = JSON.parse(localStorage.getItem('user') || '{}')
    id = extractFirmId(localUser?.firm_id) || extractFirmId(localUser?.firm)
    if (id) return id
  } catch {}

  if (Array.isArray(fetchedUsers) && fetchedUsers.length > 0) {
    for (const u of fetchedUsers) {
      id = extractFirmId(u?.firm_id) || extractFirmId(u?.firm)
      if (id) return id
    }
  }

  return null
}

/**
 * Robust fallback resolution for firm name across user, workspace, and localStorage
 */
export const resolveFirmName = (user: any, activeWorkspace?: any, fetchedUsers: any[] = []): string => {
  if (user?.firm_id?.firm_name) return user.firm_id.firm_name
  if (user?.firm_name) return user.firm_name
  if (user?.firm?.firm_name) return user.firm.firm_name

  if (activeWorkspace?.name) return activeWorkspace.name

  try {
    const ud = JSON.parse(localStorage.getItem('userData') || '{}')
    if (ud?.firm_id?.firm_name) return ud.firm_id.firm_name
    if (ud?.firm_name) return ud.firm_name
    if (ud?.firm?.firm_name) return ud.firm.firm_name
  } catch {}

  try {
    const mu = JSON.parse(localStorage.getItem('mh.user') || '{}')
    if (mu?.firm_id?.firm_name) return mu.firm_id.firm_name
    if (mu?.firm_name) return mu.firm_name
    if (mu?.firm?.firm_name) return mu.firm.firm_name
  } catch {}

  try {
    const ws = JSON.parse(localStorage.getItem('mh.workspaces') || '[]')
    if (Array.isArray(ws) && ws.length > 0 && ws[0]?.name) return ws[0].name
  } catch {}

  if (Array.isArray(fetchedUsers) && fetchedUsers.length > 0) {
    for (const u of fetchedUsers) {
      if (u?.firm_id?.firm_name) return u.firm_id.firm_name
      if (u?.firm_name) return u.firm_name
      if (u?.firm?.firm_name) return u.firm.firm_name
    }
  }

  return 'RRV Softech PVT LTD'
}

/**
 * Human-friendly last seen formatting using date-fns with fallback
 */
export const formatLastSeen = (timestamp: number | string | null | undefined): string => {
  if (!timestamp) return 'Offline'
  try {
    const parsed =
      typeof timestamp === 'number' && timestamp < 1e11
        ? timestamp * 1000
        : Number(timestamp) || new Date(timestamp).getTime()
    const d = new Date(parsed)
    if (isNaN(d.getTime())) return 'Recently'
    const diffMs = Date.now() - d.getTime()
    if (diffMs < 60_000) return 'Just now'
    return `${formatDistanceToNow(d, { addSuffix: true })}`
  } catch {
    return 'Recently'
  }
}
