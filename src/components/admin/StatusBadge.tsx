import { cn } from '@/lib/utils'

export type StatusTone = 'green' | 'amber' | 'blue' | 'gray' | 'rose' | 'violet'

const TONES: Record<StatusTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/15',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/15',
  gray: 'bg-muted text-muted-foreground ring-border',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/15',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15',
}

interface StatusBadgeProps {
  tone: StatusTone
  children: React.ReactNode
  className?: string
}

export default function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
