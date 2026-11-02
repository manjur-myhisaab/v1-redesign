import { genConfig, type AvatarFullConfig } from 'react-nice-avatar'

// react-nice-avatar's gendered visual cues are mostly hair + eyebrows. Setting
// only `sex` on a generated config leaves, e.g., a man with `womanLong` hair —
// so it still looks female. This generates a deterministic config from the seed
// and, when a sex is forced, fixes the hair/eyebrows to match.
const MAN_HAIR = ['normal', 'thick', 'mohawk'] as const
const WOMAN_HAIR = ['normal', 'womanLong', 'womanShort'] as const

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export function avatarConfig(
  seed: string,
  sex?: 'man' | 'woman',
): AvatarFullConfig {
  // normalise the seed so the SAME person always gets the SAME avatar
  // regardless of casing / surrounding whitespace at the call site
  const s = seed.trim().toLowerCase()
  const cfg = genConfig(s)
  if (!sex) return cfg
  cfg.sex = sex
  const allowed: readonly string[] = sex === 'man' ? MAN_HAIR : WOMAN_HAIR
  if (!allowed.includes(cfg.hairStyle as string)) {
    cfg.hairStyle = allowed[hash(s) % allowed.length] as typeof cfg.hairStyle
  }
  cfg.eyeBrowStyle = sex === 'man' ? 'up' : 'upWoman'
  return cfg
}
