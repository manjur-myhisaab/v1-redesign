import { type ComponentType } from 'react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  delta?: string
  trend?: 'up' | 'down'
  icon: ComponentType<{ className?: string }>
}

export default function StatCard({
  label,
  value,
  delta,
  trend = 'up',
  icon: Icon,
}: StatCardProps) {
  const Arrow = trend === 'up' ? ArrowUpRight : ArrowDownRight
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-[13px]">{label}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {delta && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              trend === 'up' ? 'text-emerald-600' : 'text-rose-600',
            )}
          >
            <Arrow className="size-3.5" />
            {delta}
          </span>
        )}
      </div>
    </div>
  )
}
