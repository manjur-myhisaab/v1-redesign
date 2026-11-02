export interface Country {
  name: string
  iso: string
  dial: string
  flag: string
  /** national (significant) number digit length — min/max to allow variance */
  minLen: number
  maxLen: number
}

// Curated list, India first (primary market). Extend as needed.
export const COUNTRIES: Country[] = [
  { name: 'India', iso: 'IN', dial: '+91', flag: '🇮🇳', minLen: 10, maxLen: 10 },
  { name: 'United States', iso: 'US', dial: '+1', flag: '🇺🇸', minLen: 10, maxLen: 10 },
  { name: 'United Kingdom', iso: 'GB', dial: '+44', flag: '🇬🇧', minLen: 10, maxLen: 10 },
  { name: 'United Arab Emirates', iso: 'AE', dial: '+971', flag: '🇦🇪', minLen: 9, maxLen: 9 },
  { name: 'Singapore', iso: 'SG', dial: '+65', flag: '🇸🇬', minLen: 8, maxLen: 8 },
  { name: 'Australia', iso: 'AU', dial: '+61', flag: '🇦🇺', minLen: 9, maxLen: 9 },
  { name: 'Canada', iso: 'CA', dial: '+1', flag: '🇨🇦', minLen: 10, maxLen: 10 },
  { name: 'Germany', iso: 'DE', dial: '+49', flag: '🇩🇪', minLen: 10, maxLen: 11 },
  { name: 'France', iso: 'FR', dial: '+33', flag: '🇫🇷', minLen: 9, maxLen: 9 },
  { name: 'Saudi Arabia', iso: 'SA', dial: '+966', flag: '🇸🇦', minLen: 9, maxLen: 9 },
  { name: 'Nepal', iso: 'NP', dial: '+977', flag: '🇳🇵', minLen: 10, maxLen: 10 },
  { name: 'Bangladesh', iso: 'BD', dial: '+880', flag: '🇧🇩', minLen: 10, maxLen: 10 },
  { name: 'Sri Lanka', iso: 'LK', dial: '+94', flag: '🇱🇰', minLen: 9, maxLen: 9 },
  { name: 'Malaysia', iso: 'MY', dial: '+60', flag: '🇲🇾', minLen: 9, maxLen: 10 },
  { name: 'Indonesia', iso: 'ID', dial: '+62', flag: '🇮🇩', minLen: 9, maxLen: 12 },
  { name: 'Japan', iso: 'JP', dial: '+81', flag: '🇯🇵', minLen: 10, maxLen: 10 },
  { name: 'China', iso: 'CN', dial: '+86', flag: '🇨🇳', minLen: 11, maxLen: 11 },
  { name: 'South Africa', iso: 'ZA', dial: '+27', flag: '🇿🇦', minLen: 9, maxLen: 9 },
  { name: 'Qatar', iso: 'QA', dial: '+974', flag: '🇶🇦', minLen: 8, maxLen: 8 },
  { name: 'Kuwait', iso: 'KW', dial: '+965', flag: '🇰🇼', minLen: 8, maxLen: 8 },
]

export const DEFAULT_COUNTRY = COUNTRIES[0]
