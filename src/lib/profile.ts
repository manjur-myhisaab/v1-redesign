import { type AvatarFullConfig } from 'react-nice-avatar'

// Extended profile fields kept client-side (no backend column yet), keyed by
// user id in localStorage. Name/email live on the session user; the rest here.
export interface Profile {
  title: string
  timezone: string
  workingHours: string
  avatar?: AvatarFullConfig
  updatedAt?: string
}

const KEY = 'mh.profiles'

export const TIMEZONES = [
  'GMT-8',
  'GMT-5',
  'GMT+0',
  'GMT+1',
  'GMT+5:30',
  'GMT+8',
]

const DEFAULT_PROFILE: Profile = {
  title: '',
  timezone: 'GMT+5:30',
  workingHours: '10 AM – 6 PM',
}

function readAll(): Record<string, Profile> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function loadProfile(userId: string): Profile {
  return { ...DEFAULT_PROFILE, ...readAll()[userId] }
}

export function saveProfile(userId: string, profile: Profile): void {
  const all = readAll()
  all[userId] = profile
  localStorage.setItem(KEY, JSON.stringify(all))
}
