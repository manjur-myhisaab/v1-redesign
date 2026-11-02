import Avatar, { type AvatarFullConfig } from 'react-nice-avatar'
import { cn } from '@/lib/utils'
import { avatarConfig } from '@/lib/avatarConfig'

interface PersonAvatarProps {
  /** seed for a deterministic avatar (used when `config` is not given) */
  name: string
  /** explicit avatar config (e.g. a user's saved/edited avatar) */
  config?: AvatarFullConfig
  /** force the avatar's sex (from an employee's gender) */
  sex?: 'man' | 'woman'
  className?: string
}

// Friendly illustrated avatars via react-nice-avatar. Deterministic per `name`
// unless an explicit `config` (a saved avatar) is supplied. An optional `sex`
// (from the employee's gender) overrides the generated sex.
export default function PersonAvatar({ name, config, sex, className }: PersonAvatarProps) {
  const cfg = config ?? avatarConfig(name, sex)
  return (
    <div className={cn('size-6 shrink-0 overflow-hidden rounded-full', className)}>
      <Avatar style={{ width: '100%', height: '100%' }} shape="circle" {...cfg} />
    </div>
  )
}
