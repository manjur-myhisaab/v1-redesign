import { cn } from '@/lib/utils'

export interface PageTab<K extends string = string> {
  key: K
  label: string
}

interface PageTabsProps<K extends string> {
  tabs: PageTab<K>[]
  active: K
  onChange: (key: K) => void
  className?: string
}

// Canonical admin tab bar — the underline style used by the Dashboard
// (Cockpit / Other metrics). Use this for every in-panel tab strip so the
// design system stays consistent across pages.
export default function PageTabs<K extends string>({
  tabs,
  active,
  onChange,
  className,
}: PageTabsProps<K>) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-5 border-b border-border px-5',
        className,
      )}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'relative -mb-px cursor-pointer py-3 text-[13px] font-medium transition-colors',
            active === t.key
              ? 'text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
