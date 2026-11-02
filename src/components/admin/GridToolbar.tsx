import { type ComponentType, type ReactNode, useState } from 'react'
import {
  Search,
  ChevronDown,
  ArrowUpDown,
  Filter,
  ListFilter,
  SlidersHorizontal,
  Plus,
  Check,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Shared list-view toolbar — extracted verbatim from the Employees gold
// standard so every entity list (Hiring, CRM, Sales, Expenses, …) renders an
// identical search / filter / sort / actions bar on top of a DataGrid.
// ---------------------------------------------------------------------------

export const ghostBtn =
  'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

export interface FilterOption {
  value: string
  label?: string
}

// A single multi-select filter section inside the Filter popover. The page owns
// the `selected` Set and the toggle handler.
export interface FilterGroup {
  id: string
  label: string
  options: FilterOption[]
  selected: Set<string>
  onToggle: (value: string) => void
}

export interface SortField {
  key: string
  label: string
}

// A bulk action shown when one or more rows are selected. Either a direct
// button (onClick) or a popover (menu) — e.g. "Set status".
export interface BulkAction {
  id: string
  label: string
  icon?: ComponentType<{ className?: string }>
  tone?: 'default' | 'danger'
  disabled?: boolean
  onClick?: () => void
  menu?: ReactNode // rendered inside a popover when provided
}

export interface GridToolbarProps {
  // left label / counts
  leftLabel?: string // default "All"
  total: number // unfiltered row count shown next to the label

  // search
  query: string
  onQueryChange: (value: string) => void
  searchPlaceholder?: string

  // filter (optional — omit to hide the Filter button)
  filterGroups?: FilterGroup[]

  // sort (optional — omit to hide the Sort button)
  sortFields?: SortField[]
  sortKey?: string | null
  sortDir?: 'asc' | 'desc'
  onSortKey?: (key: string) => void
  onSortDir?: (dir: 'asc' | 'desc') => void

  // reset view
  onReset?: () => void

  // primary action (e.g. "New record")
  primaryAction?: {
    label: string
    onClick: () => void
    icon?: ComponentType<{ className?: string }>
  }
  extraActions?: ReactNode // rendered just left of the primary action

  // bulk-selection bar (swaps in when selectedCount > 0)
  selectedCount?: number
  onClearSelection?: () => void
  bulkActions?: BulkAction[]
}

type MenuKey = 'filter' | 'sort' | 'options' | `bulk:${string}` | null

export default function GridToolbar({
  leftLabel = 'All',
  total,
  query,
  onQueryChange,
  searchPlaceholder = 'Search',
  filterGroups,
  sortFields,
  sortKey,
  sortDir = 'asc',
  onSortKey,
  onSortDir,
  onReset,
  primaryAction,
  extraActions,
  selectedCount = 0,
  onClearSelection,
  bulkActions,
}: GridToolbarProps) {
  const [openMenu, setOpenMenu] = useState<MenuKey>(null)

  const activeFilterCount = (filterGroups ?? []).reduce(
    (n, g) => n + g.selected.size,
    0,
  )

  // ---- bulk-action bar -----------------------------------------------------
  if (selectedCount > 0) {
    return (
      <div className="flex items-center gap-1 bg-primary/5 py-1.5 pl-2.5 pr-1.5">
        <button
          onClick={onClearSelection}
          className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Clear selection"
        >
          <X className="size-3.5" />
        </button>
        <span className="text-[13px] font-medium">{selectedCount} selected</span>

        <div className="ml-auto flex items-center gap-0.5">
          {(bulkActions ?? []).map((action) => {
            if (action.menu) {
              return (
                <Menu
                  key={action.id}
                  open={openMenu === `bulk:${action.id}`}
                  onOpenChange={(o) =>
                    setOpenMenu(o ? `bulk:${action.id}` : null)
                  }
                  trigger={
                    <button className={ghostBtn} disabled={action.disabled}>
                      {action.icon && <action.icon className="size-3.5" />}
                      {action.label}
                      <ChevronDown className="size-3.5" />
                    </button>
                  }
                >
                  {action.menu}
                </Menu>
              )
            }
            return (
              <button
                key={action.id}
                onClick={action.onClick}
                disabled={action.disabled}
                className={cn(
                  'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[13px] font-medium transition-colors disabled:opacity-50',
                  action.tone === 'danger'
                    ? 'text-rose-600 hover:bg-rose-50'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {action.icon && <action.icon className="size-3.5" />}
                {action.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ---- default toolbar -----------------------------------------------------
  return (
    <div className="flex items-center gap-1 py-1.5 pl-2.5 pr-1.5">
      <button className={ghostBtn}>
        <ListFilter className="size-3.5" />
        {leftLabel}
        <span className="text-muted-foreground">· {total}</span>
      </button>

      <div className="ml-auto flex items-center gap-0.5">
        <div className="flex h-7 w-40 items-center gap-1.5 rounded-md px-2 text-[13px]">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Filter */}
        {filterGroups && filterGroups.length > 0 && (
          <Menu
            open={openMenu === 'filter'}
            onOpenChange={(o) => setOpenMenu(o ? 'filter' : null)}
            trigger={
              <button
                className={cn(ghostBtn, activeFilterCount > 0 && 'text-primary')}
              >
                <Filter className="size-3.5" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="rounded bg-primary/10 px-1 text-[11px] text-primary">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            }
          >
            {filterGroups.map((group, gi) => (
              <div key={group.id} className={gi > 0 ? 'mt-2' : undefined}>
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                {group.options.map((opt) => {
                  const on = group.selected.has(opt.value)
                  return (
                    <button
                      key={opt.value}
                      onClick={() => group.onToggle(opt.value)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted"
                    >
                      <span
                        className={cn(
                          'grid size-4 place-items-center rounded border',
                          on
                            ? 'border-primary bg-primary text-white'
                            : 'border-border',
                        )}
                      >
                        {on && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      {opt.label ?? opt.value}
                    </button>
                  )
                })}
              </div>
            ))}
            {activeFilterCount > 0 && (
              <button
                onClick={() => filterGroups.forEach((g) => g.selected.forEach((v) => g.onToggle(v)))}
                className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-muted"
              >
                Clear filter
              </button>
            )}
          </Menu>
        )}

        {/* Sort */}
        {sortFields && sortFields.length > 0 && (
          <Menu
            open={openMenu === 'sort'}
            onOpenChange={(o) => setOpenMenu(o ? 'sort' : null)}
            trigger={
              <button className={cn(ghostBtn, sortKey && 'text-primary')}>
                <ArrowUpDown className="size-3.5" />
                Sort
              </button>
            }
          >
            {sortFields.map((f) => (
              <button
                key={f.key}
                onClick={() => onSortKey?.(f.key)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted"
              >
                {f.label}
                {sortKey === f.key && <Check className="size-3.5 text-primary" />}
              </button>
            ))}
            <div className="my-1 border-t border-border" />
            <button
              onClick={() => onSortDir?.(sortDir === 'asc' ? 'desc' : 'asc')}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted"
            >
              Direction
              <span className="text-muted-foreground">
                {sortDir === 'asc' ? 'A → Z' : 'Z → A'}
              </span>
            </button>
          </Menu>
        )}

        {/* Options */}
        {onReset && (
          <Menu
            open={openMenu === 'options'}
            onOpenChange={(o) => setOpenMenu(o ? 'options' : null)}
            trigger={
              <button className={ghostBtn}>
                <SlidersHorizontal className="size-3.5" />
                Options
              </button>
            }
          >
            <button
              onClick={() => {
                onReset()
                setOpenMenu(null)
              }}
              className="w-full rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted"
            >
              Reset view
            </button>
          </Menu>
        )}

        {extraActions}

        {primaryAction && (
          <button
            onClick={primaryAction.onClick}
            className="btn-3d ml-1 inline-flex h-7 cursor-pointer items-center gap-1 rounded-xl bg-primary px-2.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {primaryAction.icon ? (
              <primaryAction.icon className="size-3.5" />
            ) : (
              <Plus className="size-3.5" />
            )}
            {primaryAction.label}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lightweight popover menu with click-outside backdrop (same as Employees).
// ---------------------------------------------------------------------------
export function Menu({
  open,
  onOpenChange,
  trigger,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: ReactNode
  children: ReactNode
}) {
  return (
    <div className="relative">
      <div onClick={() => onOpenChange(!open)}>{trigger}</div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
          <div className="absolute right-0 top-9 z-50 min-w-44 rounded-xl border border-border bg-popover p-1 shadow-lg duration-150 animate-in fade-in zoom-in-95">
            {children}
          </div>
        </>
      )}
    </div>
  )
}
