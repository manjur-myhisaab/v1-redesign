import Panel from '@/components/admin/Panel'
import EmptyIllustration from '@/components/admin/EmptyIllustration'
import { useShell } from '@/components/admin/shell-context'
import { cn } from '@/lib/utils'

export default function NewTab() {
  const { firstTabActive } = useShell()
  return (
    <Panel
      className={cn(
        'grid min-w-0 flex-1 place-items-center p-6 rounded-tl-none rounded-bl-none',
        firstTabActive && 'rounded-tl-none rounded-bl-none',
      )}
    >
      <div className="max-w-sm text-center">
        <EmptyIllustration className="mx-auto size-44" />
        <h1 className="mt-6 font-display text-xl font-semibold tracking-tight">
          A fresh start
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Pick a section from the sidebar to get going — your dashboard,
          employees, attendance or payroll all live a click away.
        </p>
      </div>
    </Panel>
  )
}
