import type { FirmHoliday, PublicHoliday } from '../api/holidaysApi.types'

/**
 * Extracts a unique string ID from any holiday object.
 * Checks id, holiday_id, _id.
 */
export function getHolidayId(holiday?: FirmHoliday | PublicHoliday | null): string {
  if (!holiday) return ''
  return (
    (holiday as any).holiday_id ||
    holiday.id ||
    (holiday as any)._id ||
    ''
  )
}

/**
 * Extracts holiday name safely.
 */
export function getHolidayName(holiday?: FirmHoliday | PublicHoliday | null): string {
  if (!holiday) return 'Holiday'
  return (
    holiday.holiday_name ||
    (holiday as any).name ||
    'Holiday'
  )
}

/**
 * Extracts raw date string safely.
 */
export function getHolidayRawDate(holiday?: FirmHoliday | PublicHoliday | null): string {
  if (!holiday) return ''
  return (
    holiday.holiday_date ||
    (holiday as any).date ||
    (holiday as any).start_date ||
    ''
  )
}

/**
 * Robust date parser supporting YYYY-MM-DD, ISO timestamp, epoch, and Date objects.
 */
export function parseHolidayDate(dateInput?: string | Date | number | null) {
  if (!dateInput) {
    return {
      day: '--',
      month: '---',
      weekday: '',
      full: '-',
      ymd: '',
      year: new Date().getFullYear(),
      monthNum: '01',
    }
  }

  let dateObj: Date
  if (typeof dateInput === 'string') {
    // If it's formatted like "2026-11-08" or "2026-11-08T..."
    const match = dateInput.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (match) {
      const y = parseInt(match[1], 10)
      const m = parseInt(match[2], 10)
      const d = parseInt(match[3], 10)
      dateObj = new Date(y, m - 1, d)
    } else {
      dateObj = new Date(dateInput)
    }
  } else {
    dateObj = new Date(dateInput)
  }

  if (isNaN(dateObj.getTime())) {
    return {
      day: '--',
      month: '---',
      weekday: '',
      full: String(dateInput),
      ymd: String(dateInput),
      year: new Date().getFullYear(),
      monthNum: '01',
    }
  }

  const d = dateObj.getDate()
  const m = dateObj.getMonth() + 1
  const y = dateObj.getFullYear()

  const dayStr = d < 10 ? `0${d}` : `${d}`
  const monthNumStr = m < 10 ? `0${m}` : `${m}`
  const monthShort = dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const weekdayShort = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
  const fullStr = dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const ymdStr = `${y}-${monthNumStr}-${dayStr}`

  return {
    day: dayStr,
    month: monthShort,
    weekday: weekdayShort,
    full: fullStr,
    ymd: ymdStr,
    year: y,
    monthNum: monthNumStr,
  }
}

export interface HolidayTypeOption {
  id: string
  name: string
  tone: string
  description?: string
}

export const HOLIDAY_TYPES: HolidayTypeOption[] = [
  {
    id: 'PUBLIC_HOLIDAY',
    name: 'Public Holiday',
    tone: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    description: 'Official gazetted / government public holiday',
  },
  {
    id: 'NATIONAL_HOLIDAY',
    name: 'National Holiday',
    tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    description: 'Republic Day, Independence Day, Gandhi Jayanti',
  },
  {
    id: 'FESTIVAL',
    name: 'Festival',
    tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    description: 'Diwali, Holi, Eid, Christmas and cultural celebrations',
  },
  {
    id: 'RELIGIOUS_HOLIDAY',
    name: 'Religious Holiday',
    tone: 'bg-[#6f9ff1]/10 text-[#6f9ff1] dark:text-orange-400 border-[#6f9ff1]/20',
    description: 'Observance of religious importance',
  },
  {
    id: 'COMPANY_HOLIDAY',
    name: 'Company Holiday',
    tone: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    description: 'Organization foundation day, annual retreat off',
  },
  {
    id: 'OPTIONAL_HOLIDAY',
    name: 'Optional Holiday',
    tone: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    description: 'Floating / restricted holiday selectable by employees',
  },
  {
    id: 'SPECIAL_HOLIDAY',
    name: 'Special Holiday',
    tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    description: 'Special off or emergency declared non-working day',
  },
]

/**
 * Returns normalized label and tone styles for any given holiday type string.
 */
export function getHolidayTypeConfig(typeKey?: string): { label: string; tone: string } {
  if (!typeKey) {
    return {
      label: 'Public Holiday',
      tone: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    }
  }

  const normalized = typeKey.toUpperCase().replace(/\s+/g, '_')

  const match = HOLIDAY_TYPES.find(
    (t) => t.id === normalized || t.id.replace(/_/g, '') === normalized.replace(/_/g, '')
  )

  if (match) {
    return {
      label: match.name,
      tone: match.tone,
    }
  }

  // Fallbacks for legacy/common values
  if (normalized.includes('MANDATORY') || normalized.includes('NATIONAL')) {
    return {
      label: 'National Holiday',
      tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    }
  }
  if (normalized.includes('RESTRICTED') || normalized.includes('OPTIONAL')) {
    return {
      label: 'Optional Holiday',
      tone: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    }
  }
  if (normalized.includes('COMPANY')) {
    return {
      label: 'Company Holiday',
      tone: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    }
  }

  // Format whatever unknown type is passed
  const formatted = typeKey
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return {
    label: formatted,
    tone: 'bg-muted text-muted-foreground border-border',
  }
}
