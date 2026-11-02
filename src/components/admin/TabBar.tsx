import { Plus, X, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navMeta } from './nav'
import AccountMenu from './AccountMenu'
// import NotificationBell from './NotificationBell'
import NetworkStatusIndicator from '@/components/NetworkStatusIndicator'

interface Tab {
  id: string
  path: string
}

interface TabBarProps {
  tabs: Tab[]
  activeId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
}

export default function TabBar({
  tabs,
  activeId,
  onSelect,
  onClose,
  onNew,
}: TabBarProps) {
  return (
    <div className="flex h-11 shrink-0 items-end gap-1 pr-3">
      {/* tabs */}
      <div className="flex min-w-0 flex-1 items-end gap-1">
        {tabs.map((tab, i) => {
          const meta = navMeta(tab.path)
          const Icon = meta?.icon ?? LayoutDashboard
          const isActive = tab.id === activeId
          const isFirst = i === 0
          return (
            <div
              key={tab.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(tab.id)}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(tab.id)}
              className={cn(
                'group relative flex h-9 flex-1 max-w-44 min-w-[70px] cursor-pointer items-center gap-1.5 rounded-t-xl px-2.5 text-[13px] tracking-tight transition-colors',
                isActive
                  ? 'z-10 -mb-px border border-b-0 border-border bg-background text-foreground tab-shoulder-r'
                  : 'text-muted-foreground dark:bg-black/80 hover:bg-background/50 dark:hover:bg-black/40',
                isActive && !isFirst && 'tab-shoulder-l',
              )}
            >
              <>
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{meta?.label ?? 'Untitled'}</span></>
              {tabs.length > 1 && (
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label="Close tab"
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose(tab.id)
                  }}
                  className={cn(
                    'ml-0.5 grid size-4 place-items-center rounded transition-colors hover:bg-muted',
                    isActive ? 'opacity-70' : 'opacity-0 group-hover:opacity-70',
                  )}
                >
                  <X className="size-3" />
                </span>
              )}
            </div>
          )
        })}

        <button
          type="button"
          onClick={onNew}
          aria-label="New tab"
          className="mb-1 grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {/* right: network status + notifications + account */}
      <div className="mb-1.5 flex shrink-0 items-center gap-1.5 self-center pl-2">
        <NetworkStatusIndicator />
        {/* <NotificationBell /> */}
        <AccountMenu />
      </div>
    </div>
  )
}
