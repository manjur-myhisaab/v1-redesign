import { cn } from '@/lib/utils'

// Shared building blocks for the self-service portal pages — keeps every page
// visually consistent with the admin design system (text-[13px], rounded-xl,
// border-border, bg-card).

export const inputCls =
  'h-9 w-full rounded-lg border border-border bg-card px-2.5 text-[13px] outline-none transition-colors focus:border-ring'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

export function PrimaryButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'btn-3d inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60',
        className,
      )}
    />
  )
}

export function GhostButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 text-[13px] font-medium transition-colors hover:bg-muted disabled:opacity-60',
        className,
      )}
    />
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
      <div>
        <h1 className="font-display text-base font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-[12px] text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid flex-1 place-items-center px-5 py-12 text-center text-[13px] text-muted-foreground">
      <div className="flex flex-col items-center gap-2">
        {icon}
        <span>{children}</span>
      </div>
    </div>
  )
}

export function Loading() {
  return <div className="grid flex-1 place-items-center py-12 text-[13px] text-muted-foreground">Loading…</div>
}

export const rupee = (paise: number | null | undefined) =>
  '₹' + Math.round((paise ?? 0) / 100).toLocaleString('en-IN')

export const fmtDate = (s: string) => {
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return s
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const fmtDateTime = (iso: string) => {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const STATUS_TONES: Record<string, string> = {
  submitted: 'bg-amber-50 text-amber-700',
  pending: 'bg-amber-50 text-amber-700',
  open: 'bg-amber-50 text-amber-700',
  draft: 'bg-muted text-muted-foreground',
  approved: 'bg-emerald-50 text-emerald-700',
  reimbursed: 'bg-emerald-50 text-emerald-700',
  resolved: 'bg-emerald-50 text-emerald-700',
  acknowledged: 'bg-emerald-50 text-emerald-700',
  issued: 'bg-emerald-50 text-emerald-700',
  done: 'bg-emerald-50 text-emerald-700',
  active: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-blue-50 text-blue-700',
  submitted_review: 'bg-blue-50 text-blue-700',
  assigned: 'bg-blue-50 text-blue-700',
  present: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
  cancelled: 'bg-rose-50 text-rose-700',
  closed: 'bg-muted text-muted-foreground',
  on_hold: 'bg-violet-50 text-violet-700',
  absent: 'bg-rose-50 text-rose-700',
  halfday: 'bg-amber-50 text-amber-700',
}

export function StatusPill({ status }: { status: string }) {
  const cls = STATUS_TONES[status] ?? 'bg-muted text-muted-foreground'
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-medium capitalize', cls)}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
