import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string
  delta?: string
  trend?: 'up' | 'down'
}

export default function MetricCard({
  label,
  value,
  delta,
  trend = 'up',
}: MetricCardProps) {
  const Arrow = trend === 'up' ? ArrowUpRight : ArrowDownRight
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="text-[28px] font-semibold leading-none tracking-tight">
          {value}
        </span>
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
