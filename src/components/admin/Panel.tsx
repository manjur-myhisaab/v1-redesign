import { cn } from '@/lib/utils'

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  children: React.ReactNode
}

export default function Panel({ className, children, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-background',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
